---
title: "House of Water — Forging Fake Chunks in the tcache_perthread_struct"
ctf: "leakless"
category: "pwn"
difficulty: "easy"
points: null
date: "2026-05-21"
lat: -9.71
lng: 1200
summary: "Overlapping large heap bins directly with the tcache_perthread_struct by bypassing the victim->bk->fd safety checks, successfully forcing a fake 0x10000-sized chunk allocation to control target tcache bucket counts and heads."
tags:
  - "heap"
  - "largebins"
  - "house-of-water"
  - "tcache_perthread_struct"
  - "partial-overwrite"
  - "glibc-2.40"
---

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./vuln_patched_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.40.so")

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
def malloc(size):
    global count
    r.sendlineafter(b"> ",b"1")
    r.sendlineafter(b"Size?\n",f"{size}".encode())
    count+=1
    return count

def free(idx):
    r.sendlineafter(b"> ",b"2")
    r.sendlineafter(b"Index?\n",f"{idx}".encode())

def edit(idx,data,offset=0):
    r.sendlineafter(b"> ",b"3")
    r.sendlineafter(b"Index?\n",f"{idx}".encode())
    r.sendlineafter(b"Offset?\n",f"{offset}".encode())
    r.send(data)

def leak_():
    r.sendlineafter(b"> ",b"4")
    r.recvuntil(b"heap: ")
    heap = r.recv(1)
    return heap 
    
def main():
    global r
    r = conn()
```
  
    Ok, let's start some magic with the heap! We will share an amazing explanation for this 
    tactic. For a few reasons, I will not start directly by solving this challenge. First, I need 
    to present a foundational puzzle: can we create two chunks, free them, and simultaneously 
    populate the exact same chunk address into both a tcache entry and the unsorted bin?
    
    Is this possible? Actually, yes! We can do this kind of thing like this:
    
    chunk_1 = malloc(size > 0x88)  -> size > 0x88 to completely avoid the fastbins limits 
    chunk_2 = malloc(size > 0x88)
    chunk_3 = malloc(size > 0x88)  
    free(chunk_1)                  -> we manage to force this chunk straight into the unsorted bin
    
    --------------------
    |   prev  |  size  |  
    |_________|________|  ->  now this chunks into unosrted bin with fd/bk points to main arena
    |   fd    |    bk  |
    --------------------
    
    free(chunk_2)
    free(chunk_3)
    
             ____________________________________________
            V _________________      __________________  |  _________________
             | prev  |  size  |      | prev  |  size  |  |  | prev  | size  |
             |-------|--------|      |-------|--------|  |  |-------|-------|
             |  Fd   |        |      |  fd   |  bk    |  |  |       |   bk  |
             ------------------      ------------------  |  -----------------
                 |                  ^   |        |_______| ^             |
                 |__________________|   |__________________|             |
                                    |____________________________________|


```python
    entry_a = []
    for i in range(7):
        entry_a.append(malloc(0x98))
    
    chunks_1 = malloc(0x98)
    #guard    = malloc(0x10)
    #chunks_2 = malloc(0x98)
    #guard    = malloc(0x10)
    #chunks_3 = malloc(0x500)
    #guard    = malloc(0x10)

    #for i in entry_a:
    #    free(i)

    #free(chunks_1)
    #free(chunks_2)
    #free(chunks_3)
``` 

      
    Think of it like this: every time we free a chunk, we push it to the bins and link it.
    
    &chunk_1 < &chunk_2
    
    free(chunk_1) -> in this order, we push it to the bins first.
    free(chunk_2) -> pushes this chunk to the bins above chunk_1, and it will link using |chunk_2->fd|,
                     which will point to |chunk_1 - 0x10| as we see in the metadata layout.

    What if I free them in this order instead?
    
    free(chunk_2)
    free(chunk_1)

    Yes, this will change things. Now chunk_2 is pushed first to the bins,
    and next, chunk_1 will link to chunk_2, meaning |chunk_1->fd|
    points to |chunk_2 - 0x10|.
    
    So yes, the free order directly changes how the bins look and how chunks are linked.
    And of course, the |chunk_2->bk| pointer will point back to |chunk_1 - 0x10|.
    
    Now that we are familiar with how bins and the unsorted bin link and free chunks, let's look at 
    how bins unlink during a malloc() request.

    Let's assume we execute malloc(0x98).

    malloc will search the tcache first. If there is an entry with a matching 
    freed size, it will return that address to us and unlink it from the tcache list. 
    It behaves like a standard pop from the tcache entry; the current top chunk is returned to us, 
    and since the tcache is a singly-linked list, there is no heavy unlinking process. 
    The head of the tcache entry simply updates to the next item in the chain.

    You can track how this works in gef or pwndbg by inspecting 'p mp_' or using 'vmmap', and then examining the 
    tcache_perthread_struct. You will see how the size 0xa0 entry head changes during 
    the pop operation. One special detail you may notice is when the tcache entry gets 
    a new head for this size 0xa0 bucket, the address points directly to chunk_1's user data.
    
    entry[0xa] -> points to the top (last freed chunk)

    malloc(0x98) -> requests from entry[0xa]
    malloc returns the current top chunk from entry[0xa]

    Now:
    entry[0xa] -> updates to old_top->fd. This address points directly to the user data, 
                  unlike the unsorted bin where 'fd' points to the chunk start (-0x10 offset).

    It behaves exactly like a stack pop operation.
    
```python
    #pause()
    #unlink = malloc(0x98)
    #free(unlink) # push it again to head of entry 
```  
    Now, as we have seen, when we call malloc it goes to the tcache first. How do we force malloc to search the 
    unsorted bin instead? 
    We just make entry[0xa] point to 0. This means nothing is left in the tcache bucket—simulating what happens 
    when you have already popped from it 7 times.
    
    Then, the next time malloc(0x98) is requested, it searches tcache entry[0xa] and sees that it points 
    to 0. Next, it looks at the fastbins. After all, a chunk of this size cannot be placed into the fastbins, so malloc 
    falls through to the unsorted bin. It will scan the unsorted bin from head to tail looking for a 0x98 chunk. 
    If it finds a matching chunk size, it unlinks it and returns it to the user. Furthermore, if there are other chunks of a 
    stashable size left over, malloc will perform a tcache stashing operation—pivoting them into the tcache bucket. 
    If the size is greater than 0x410, they cannot be stashed and will instead be sorted into the large or small bins 
    depending on their exact boundaries. I added chunk_3 to show how this happens: it gets sorted into the large bins, 
    while the remaining 0x98 chunks get moved into the tcache entry.
    
    However, malloc performs a safety validation check when unlinking from the unsorted bin that looks like this:
    
    victim->bk->fd == victim (and victim->fd->bk == victim)

    I think it looks straightforward at first glance, but we want to know exactly how malloc handles this routine.
    
    Let's visualize three chunks sitting in the unsorted bin like this:

    chunk_3   | 0x510 |
       fd         bk
        |
        |
        V
                  
                  ^
                  |__
    chunk_2   | 0xa0  |
       fd         bk -
        |
        |
        V         
            
                  ^
                  |__
    chunk_1   | 0xa0  | 
       fd         bk -

    
    When malloc scans chunk_2, it attempts to unlink it. Before doing so, the safety checks are performed:
    Does (chunk_2->fd)->bk point back to chunk_2? Yes, so it passes.

    The next related check:
    Does (chunk_2->bk)->fd point back to chunk_2? Yes, so it passes.

    Because there is no integrity violation, the program does not abort. We successfully receive our allocation from 
    malloc(0x98), and any subsequent stashing or main bin sorting operations will be completed right after that.
    
```python

    #for i in entry_a:
    #    malloc(0x98)
    
    #unlink_unsorted = malloc(0x98)
```    
       
    Now we know how the unsorted bin gets unlinked and what safety checks are performed there. We also know how 
    the tcache gets unlinked and how that routine works. With this foundation, can we solve the challenge of 
    making a single memory address point to both the unsorted bin and a tcache entry at the same time? Yes, we can! Let's do it. 

    Remember, the address stored in the 'fd' pointer for a tcache entry points to metadata+0x10 (the actual user data address 
    returned to the user). On the other hand, the 'fd' and 'bk' pointers used in the unsorted bin point directly to the base 
    of the chunk metadata.

    Let's malloc some large chunks first. We will carve out and create our own custom chunks inside the unsorted bin from these 
    larger allocations. Let's see how that looks.
```python
 
    big   = malloc(0x550 + 0x98+0x98 + 0x40)
    guard = malloc(0x10)
    free(big)
    big_p = malloc(0x550 + 0x98+0x98 + 0x40)
    free(big)
    guard = malloc(0x10)
    
    top        = malloc(0x500)
    chunks_2_p = malloc(0x98)
    guard      = malloc(0x20)
    chunks_3_p = malloc(0x98)
    left       = malloc(0x20)

    edit(big,p64(0x6b1),0x18)
    free(top)

    top        = malloc(0x500+0x10)
    chunks_2   = malloc(0x98)
    guard      = malloc(0x20)
    chunks_3   = malloc(0x98)
    left       = malloc(0x10)
```    

    future fake chunk's  prev_size / size 
```python

    malloc(0xf3b0-0x1a0-0x18-0x10)
    size = malloc(0x18)
    edit(size,p64(0x10000)+p64(0x30))
```
        
    Now we have the indices we want! Our goal is to free a chunk location two times: one to go to the unsorted bin 
    and return an fd pointer, and the second to go to the tcache and return that exact same address space. We can 
    achieve this by manipulating chunk sizes later, but here we are abusing the shrinking mechanism of a large 
    unsorted bin chunk. This acts like a write primitive and gives us the matching overlapping entries we want: 
    index 1 and index 2 pointing to the exact same address range, where:
    index 1 -> chunk base address (-0x10 offset)
    index 2 -> chunk user data address

    Now, we need to remember something highly interesting. 
    We must first understand the structural memory layout of the tcache_perthread_struct. Look at this source definition:
    ---------------------------------------------------
    typedef struct tcache_perthread_struct
    {
    uint16_t counts[64];       // Array 1: 64 entries, 2 bytes each (Total 128 bytes)
    tcache_entry *entries[64]; // Array 2: 64 entries, 8 bytes each (Total 512 bytes)
    } tcache_perthread_struct;
    ---------------------------------------------------

    So, each entry slot contains the head pointer of a freed tcache singly-linked list, and they are ordered 
    from the smallest bin size to the largest. For example, if we call free() on a chunk containing 0x18 bytes, 
    glibc adds 8 bytes for metadata alignment. If I allocate 0x10 bytes, glibc will add 8 bytes for prev_size 
    and 8 bytes for the size/flags. Inside the user data area, it will use 8 bytes for the tcache safe-linking keys, 
    leaving nothing left for real user data space! Because of this, glibc expands the slot allocation by another 
    8 bytes so the user data space is at least 16 bytes upon the next malloc. Anyway, that isn't the most critical 
    part right now, but it feels great to understand these internal quirks.

    Now, looking closely at this struct, it occupies continuous memory. What do I mean by that? 
    Look at how counts[64] sits right behind entry[0] in physical memory mapping.
    entry 0 to 64 maps sizes from 0x20 up to 0x410 (32 to 1040 bytes).

    [0000000000000000] [00000000 0000 0000] 
                              ___'''' ''''
                             |
                             |           |
                             |           V 
                             V      count[61]
                         count[62]

    [0000000000000000] [0000000000000000]

             |                  |
             V                  V
          entry[0]           entry[1]


    So if there is a freed chunk sitting in entry[61], count[61] will read as 0000 0000 0000 0001.
    If there is one in entry[62], it reads as 0000 0000 0001 0001. So yes, what's the point? If we have a free chunk 
    assigned to entry[0] and entry[1], the head addresses align side-by-side just like they do when freeing entry[61] and entry[62]:


    [00000000 0001 0001]  .................

               |     |
               V     V
            count[1] count[0]
    .......................................
    .......................................
    [0000000000000000] [00000000 0001 0001] 
                              ___'''' ''''
                             |
                             |           |
                             |           V 
                             V      count[61]
                         count[62]

    [0x000065336bccc2a0] [0x000065336bccc2c0]

             |                  |
             V                  V
          entry[0]           entry[1]
    .........................................
    .......................................
    [0x000065336bccc2f0] [0x000065336bccc6d0]

             |                  |
             V                  V
          entry[61]          entry[62]
    .........................................

    
    Now we understand deeply how this works, and we have achieved it above in our code by freeing specific entries.
    What is the point now? When we do that, look at the memory space mapping out at the heap_base + (64 * 2):
    0x0000000000000000  0x0000000000010001                               V
    0x000065336bccc2a0  0x000065336bccc2c0               skip the metadata chunk and 60 bins 

    This structure looks exactly like a valid heap chunk definition complete with an fd pointer, a bk pointer, and a prev_size field! 
    If we execute a large allocation like malloc(0x10000 - 0x10), what do you think will happen, huh? 
    That is the core attack vector! Let me try it, hang on...
    
```python

    ent61 = malloc(0x3d8)
    ent62 = malloc(0x3e8)
    free(ent61)
    free(ent62)
```

    Here, right before we set the size for our fake chunk that we mapped out earlier, 
    let's initialize and create its fd/bk pointers.

```python

    edit(big,p64(0x31),0x528)
    free(chunks_2_p) 
    edit(big,p64(0xa1),0x528+0x10)

    edit(big,p64(0x21),0x5f8)
    free(chunks_3_p)
    edit(big,p64(0xa1),0x5f8+0x10)
```
    Now it's all done. We have set, as we mentioned before, the fake chunk's fd/bk pointers,
    and we configured the fake size and prev_size fields at fake_chunk + 0x10000.
    Now we need to create a duplicate for the fd pointer as we planned, allowing us to 
    take full control of tcache entry[0xa].
    
```python

    for i in entry_a:
        free(i)

    free(chunks_3)
    free(chunks_1)
    free(chunks_2)
```
    Everything is looking good now. We have the exact chain we want: 3 chunks sitting in the unsorted bin.
    Our fake chunk satisfies all the requirements and will successfully pass the validation checks if we link it.
    To perform the link without a full address leak, we will use a partial overwrite on the lowest byte, which requires 
    a small amount of byte-level brute-forcing. Thankfully, the challenge grants us a 4-bit leak, making this incredibly reliable!
    
```python

    th4bit = int(leak_(),16)
    edit(big,p16((th4bit<<12) +0x80),0x528+0x10+0x08)
    edit(big,p16((th4bit<<12) +0x80),0x5f8+0x10+0x10)
```  
    
    This is to link the chunks, setting chunk_2->fd and chunk_3->bk to make them point directly to our fake chunk.
    And yes, it works perfectly. The fake chunk with a size of 0x10000 is now linked into our unsorted bin list, 
    and it should be returned to us when we request a matching malloc because all sanity checks pass: 
    (fake_chunk->fd)->bk points back to us, and (fake_chunk->bk)->fd also points back to us. Thus, we will successfully 
    bypass the constraints and have the allocation completed!
    
```python

    fake_chunks = malloc(0xfff0)
    edit(fake_chunks,b"AAAAAAA")
```
      
    0x58381da8d080: 0x0000000000000000      0x0000000000010001
    0x58381da8d090: 0x0041414141414141      0x000058381da8dcd0

    Finally, we successfully got a fake chunk directly into the tcache_perthread_struct! Ohhhhhhhhh!
    I'm officially done with this stage of the approach. We have successfully performed House of Water! 
    So, in the next post, I will share exactly how I will get shell access. ;D
    That is the easy part; I was just struggling with the initial layout setup of this tactic.
    -----------------------------------------------------------------
    pid 8958
    idx=0 -> malloc(0x98)
    idx=1 -> malloc(0x98)
    idx=2 -> malloc(0x98)
    idx=3 -> malloc(0x98)
    idx=4 -> malloc(0x98)
    idx=5 -> malloc(0x98)
    idx=6 -> malloc(0x98)
    idx=7 -> malloc(0x98)
    idx=8 -> malloc(0x6c0)
    idx=9 -> malloc(0x10)
    free(8)
    idx=10 -> malloc(0x6c0)
    free(8)
    idx=11 -> malloc(0x10)
    idx=12 -> malloc(0x500)
    idx=13 -> malloc(0x98)
    idx=14 -> malloc(0x20)
    idx=15 -> malloc(0x98)
    idx=16 -> malloc(0x20)
    edit idx=8 offset=0x18 data=b'\xb1\x06\x00\x00\x00\x00\x00\x00'
    free(12)
    idx=17 -> malloc(0x510)
    idx=18 -> malloc(0x98)
    idx=19 -> malloc(0x20)
    idx=20 -> malloc(0x98)
    idx=21 -> malloc(0x10)
    idx=22 -> malloc(0xf1e8)
    idx=23 -> malloc(0x18)
    edit idx=23 offset=0x0 data=b'\x00\x00\x01\x00\x00\x00\x00\x000\x00\x00\x00\x00\x00\x00\x00'
    idx=24 -> malloc(0x3d8)
    idx=25 -> malloc(0x3e8)
    free(24)
    free(25)
    edit idx=8 offset=0x528 data=b'1\x00\x00\x00\x00\x00\x00\x00'
    free(13)
    edit idx=8 offset=0x538 data=b'\xa1\x00\x00\x00\x00\x00\x00\x00'
    edit idx=8 offset=0x5f8 data=b'!\x00\x00\x00\x00\x00\x00\x00'
    free(15)
    edit idx=8 offset=0x608 data=b'\xa1\x00\x00\x00\x00\x00\x00\x00'
    free(0)
    free(1)
    free(2)
    free(3)
    free(4)
    free(5)
    free(6)
    free(20)
    free(7)
    free(18)
    edit idx=8 offset=0x540 data=b'\x80p'
    edit idx=8 offset=0x618 data=b'\x80p'
    idx=26 -> malloc(0xfff0)
    edit idx=26 offset=0x0 data=b'AAAAAAA'
    -----------------------------------------------------------------