---
title: Build the library
description: Building and cross-compiling uda-ffi, and how the target directory is resolved.
---

## Ordinary builds

```bash
cargo build -p uda-ffi            # debug, at target/debug/
cargo build -p uda-ffi --release  # release, at target/release/
```

## Cross-compiling for Windows

On a Linux host targeting Windows, install the toolchain first:

```bash
rustup target add x86_64-pc-windows-gnu    # or x86_64-pc-windows-msvc

# MinGW linker (needed for the gnu target only)
sudo apt install mingw-w64

cargo build -p uda-ffi --release --target x86_64-pc-windows-gnu
```

`crates/uda-platform-windows` is gated whole-crate with `#![cfg(windows)]`, so `cargo check --workspace` on Linux does not compile it and the host build is never interrupted. That gate is also why the cross-compile check belongs in CI: without it a Windows-only compile error stays invisible.

## Where the target directory is

The SDK queries the **real** target directory through `cargo metadata` instead of hard-coding `./target`, which lets you redirect it elsewhere — to a faster disk, for instance:

```toml
# .cargo/config.toml
[build]
target-dir = "/mnt/fast/target"
```

Or override it per shell:

```bash
CARGO_TARGET_DIR=/tmp/uda-target cargo build -p uda-ffi
```

Because the SDKs resolve the path the same way, a custom target directory needs no extra configuration on their side. When `cargo` is unavailable (a packaged application, say), they fall back to the common in-repo build directories and then to the system search path — and `UDA_LIBRARY` always wins over every automatic path.

## Verifying the result

```bash
cargo run -p uda-cli
```

The diagnostic CLI reports, per subsystem, which backend answered — which is also the quickest way to confirm the library loads from wherever it was built.

## What the workspace produces

| Artifact | Consumer |
|---|---|
| `libuda_ffi.so` / `uda_ffi.dll` | Python (`ctypes`), Node.js (`koffi`), any C host |
| The Rust crates | native Rust applications using the traits directly |
| `uda-cli` | humans, for diagnostics |

## Next steps

- [Installation](/en/getting-started/installation/) — prerequisites per host language
- [Hello, desktop](/en/getting-started/hello-desktop/) — a first working example
