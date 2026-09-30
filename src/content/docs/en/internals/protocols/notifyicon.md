---
title: Shell_NotifyIconW (Windows)
description: The Win32 tray mechanism, its message-only window, the 16-bit command-id table, and why every call must come from one thread.
---

The Windows system-tray API used by UDA in `crates/uda-platform-windows/src/tray.rs`.

## A tray icon is a window

Unlike the Linux SNI item — a plain D-Bus object — a Windows tray icon is attached to a **window**. The shell posts callback messages to the `hWnd` recorded in `NOTIFYICONDATAW`, so that window must belong to a thread running a message loop.

UDA therefore creates a message-only window (`HWND_MESSAGE` parent) on a dedicated worker thread and never touches the host's message queue. That keeps the host free of any requirement to pump messages itself — the same reason the Linux backend runs a tokio runtime on its own thread.

## Registration sequence

1. Register a per-process-unique window class (`UDA_TrayMessageWindow-<pid>-<n>`).
2. Create the hidden window and store a pointer to the shared state in its user-data slot.
3. Call `Shell_NotifyIconW(NIM_ADD)` with `NIF_MESSAGE | NIF_ICON | NIF_TIP`, giving the callback message id `WM_APP` (0x8000).
4. Call `NIM_SETVERSION` with `NOTIFYICON_VERSION_4`, which enables the richer callback layout.

The callback id is `WM_APP` rather than `WM_USER` because it leaves the whole `WM_USER` range free for a host application should it ever share the window.

## Callback layout under version 4

| Slot | Contents |
|---|---|
| `lParam` low 16 bits | the mouse message (`WM_LBUTTONUP`, `WM_RBUTTONUP`, …) |
| `lParam` high 16 bits | the icon id, from `NOTIFYICONDATAW::uID` |
| `wParam` | the cursor position, `x` low / `y` high, each signed 16-bit |

`wParam` is an `isize` on 64-bit Windows, so it must be truncated to its low word *before* the high half is read as `y`.

## Menu command ids

`TrackPopupMenuEx` with `TPM_RETURNCMD` returns a command id, and returns `0` when the user dismisses the menu. Real ids therefore start at `1`.

`WM_COMMAND` carries a 16-bit id, which is far too small to encode a path or a tree position. UDA keeps a flat `id → row` table rebuilt on every menu mutation, so a stale id can never fire an outdated callback. The table is treated as disposable: every mutation produces a fresh one.

Each row's callback is cloned out of the host menu at build time, so a click never reaches back into the live `TrayMenu` while the shell menu is open.

A separator still consumes an id so positions line up; a submenu row claims one id so its position is stable, and its children are allocated afterwards.

## Disabled and checked rows

A disabled row gets both `MF_DISABLED` and `MF_GRAYED`: the first stops it firing, the second is what actually greys it out. A checked checkbox gets `MF_CHECKED`.

## Icon construction

| Source | Path taken |
|---|---|
| File path | `LoadImageW` with `LR_LOADFROMFILE \| LR_DEFAULTSIZE`, which understands `.ico`, `.cur` and `.bmp`, including multi-image entries packed for several DPI levels |
| RGBA pixels | A 32bpp **top-down** DIB section (`biHeight` negative) fed to `CreateIconIndirect` with an opaque 1bpp mask |

The alpha channel in the colour bitmap carries the shape, so the mask is all zeros — "leave the colour bitmap visible".

`tray_icon_extent()` reads `GetSystemMetrics(SM_CXSMICON)` lazily rather than caching it in a constant, because a DPI change or a theme switch can move it while the process lives. The same pair is handed to `LoadImageW`, so a multi-resolution `.ico` picks the entry closest to what the shell will actually draw.

## Thread affinity

`Shell_NotifyIconW`, `CreatePopupMenu` and `TrackPopupMenuEx` must all be issued from the thread that owns the window. The host's mutations are therefore **forwarded** to the worker as user messages and applied under the worker's own lock — there is no shared-state mirror like the Linux backend.

This is also what keeps a `Drop` racing a menu open from corrupting the window: both go through the same message queue, so they cannot interleave inside a Win32 call.

## See also

- [StatusNotifierItem](/en/internals/protocols/statusnotifieritem/) — the Linux counterpart
- [System tray guide](/en/guides/tray/) — the cross-platform API on top
