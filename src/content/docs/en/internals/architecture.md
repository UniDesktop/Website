---
title: Architecture
description: The crate layering, what lives where, and the rules that keep the layers honest.
---

## The layering

```text
        ┌─────────────────────────────────────────────┐
        │                uda-core                      │
        │  traits · enums · Capability · UdaError      │  no OS knowledge
        └───────────────┬─────────────────┬────────────┘
                        │                 │
        ┌───────────────▼──────┐  ┌───────▼────────────────┐
        │  uda-platform-linux  │  │  uda-platform-windows  │  OS backends
        │  zbus · Wayland · X11│  │  windows-rs · COM · WinRT│
        └──────────────────────┘  └────────────────────────┘
                        │                 │
        ┌───────────────▼─────────────────▼────────────┐
        │                  uda-ffi                     │
        │  C-ABI exports · status codes · ownership    │  the stable surface
        └───────────────┬─────────────────┬────────────┘
                        │                 │
              examples/python/uda.py   examples/nodejs/uda.js
              (ctypes, stdlib only)    (koffi, zero compile)
```

## What belongs where

| Crate | Owns | Must not contain |
|---|---|---|
| `uda-core` | traits, enums, `Capability` bit flags, `UdaError`, pure logic | any D-Bus, Win32 or WinRT call |
| `uda-platform-linux` | D-Bus (zbus), Wayland IPC, X11, sysfs | anything Windows |
| `uda-platform-windows` | Win32, COM, WinRT, registry | anything Linux |
| `uda-ffi` | the `extern "C"` surface, status codes, ownership rules | business logic or backend selection |
| `uda-cli` | diagnostic output for humans | library behaviour |
| `examples/` | demos, one capability each | shared abstractions |

## The rule that makes the core testable

Any decision that both platforms must agree on lives in **`uda-core`, not in a backend**. The consequence is that it is unit-testable on the machine that runs CI, without a session bus or a Windows host.

Three examples that follow from it:

- **Icon normalisation** (`image_source`, `file_uri`, `has_uri_scheme`) is in `uda-core/src/notification.rs`. The Windows toast needs a `file://` URI, the FreeDesktop backend accepts a plain path, but the *syntax decision* is shared — and a Linux CI runner can then test the Windows form.
- **Absolute-path detection** (`is_absolute_path`) is host-independent on purpose. `std::path::Path::is_absolute()` reports `C:/pics/a.png` as relative on the Linux host that runs CI, so using it would silently break the Windows case everywhere except on Windows.
- **The capability guard** (`uda_core::session::perform`) lives in the core so the C-ABI layer, a Rust host and the unit tests all get the identical "unsupported" answer, and so it can be tested without a D-Bus session.

## Threading model

| Feature | Where the work happens |
|---|---|
| Tray | a worker thread — tokio runtime on Linux, a Win32 message pump on Windows |
| Media | short-lived runtimes per call; the SDK stays synchronous without parking a runtime |
| Notifications | the caller's thread; `send` is async only because the traits are |
| Wake locks | the caller's thread |

The host never needs to pump messages, run a GLib main loop, or spin a runtime for UDA to work. Callbacks always arrive on UDA's own thread and must forward into the host's loop rather than touching host UI state.

## The C-ABI boundary

Every export:

- returns an `int32_t` status code ([see the table](/en/reference/status-codes/));
- runs inside `catch_unwind`, so a panic can never unwind across `extern "C"`;
- validates every pointer before dereferencing it;
- hands out only integers or owned pointers the caller must free.

This is why the ABI is safe to bind from any language, and why the Python and Node.js SDKs can be thin.

## Zero-bloat

`uda-core` has no OS dependency at all. The Linux backend uses pure-Rust `zbus`; the Windows backend uses official `windows-rs`. No Qt, no GTK, no bundled toolkit — so a host that already has a GUI framework pays nothing for UDA.

## See also

- [Fallback engine](/en/internals/fallback-engine/) — how the tiers resolve
- [Contributing](/en/internals/contributing/) — the verification gates every change must pass
