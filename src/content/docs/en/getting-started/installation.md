---
title: Installation
description: Prerequisites and install paths for Rust, Python, Node.js and C/C++ hosts.
---

## Prerequisites

| Host language | Requirement |
|---|---|
| Rust | Rust 2021 edition, `cargo`, and the workspace's target toolchain |
| Python | Python 3.10+ — **no third-party packages**, the SDK is stdlib only |
| Node.js | Node 18+ and `npm install koffi` inside `examples/nodejs/` |
| C / C++ | any C11 compiler; include `include/uda.h` and link the shared library |

Building from source additionally needs the Rust toolchain. Every SDK loads a prebuilt library if one exists, so a host application needs no Rust toolchain at runtime.

## Building the library

```bash
git clone https://github.com/UniDesktop/SDK.git
cd SDK
cargo build -p uda-ffi --release
```

That produces `libuda_ffi.so` on Linux or `uda_ffi.dll` on Windows. Cross-compiling the Windows target from Linux:

```bash
cargo build -p uda-ffi --release --target x86_64-pc-windows-gnu
```

The SDKs look for the library in this order:

1. the `UDA_LIBRARY` environment variable,
2. the target directory reported by `cargo metadata` (both `debug` and `release`),
3. common in-repo build directories,
4. the system dynamic-library search path.

An explicit path can always be passed to the SDK's constructor.

## Linux runtime dependencies

| Feature | Package |
|---|---|
| Everything D-Bus | `dbus` (the session bus must be reachable) |
| Portal features | `xdg-desktop-portal` |
| Notifications | any `org.freedesktop.Notifications` implementation (`dunst`, `mako`, …) |
| System tray | a StatusNotifierWatcher — GNOME needs the AppIndicator extension |
| Wallpaper on X11 | `feh` or `nitrogen` (only if no portal or DE IPC is available) |

There is no hard dependency on any of these: UDA probes for each and degrades to a typed error when none is present.

## Windows runtime dependencies

None beyond Windows 10 / 11 itself. Toasts, tray, media and power all use built-in platform APIs, and UDA registers the AppUserModelID an unpackaged process needs.

## Verifying the install

```bash
cargo run -p uda-cli
```

The diagnostic CLI walks every subsystem and prints what it found and which backend tier answered. It is the fastest confirmation that the session is usable.

See [Troubleshooting](/en/guides/troubleshooting/) when something reports unexpected.

## Next steps

- [Build the library](/en/getting-started/build-the-library/) — what the workspace produces
- [Hello, desktop](/en/getting-started/hello-desktop/) — a first working example
