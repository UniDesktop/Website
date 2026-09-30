---
title: StatusNotifierItem (SNI)
description: "The org.kde.StatusNotifierItem protocol: registration, properties, icons, and the missing double-click."
---

The Linux system-tray protocol used on GNOME, KDE, XFCE and every freedesktop-compliant Wayland compositor. UDA implements it in `crates/uda-platform-linux/src/tray.rs`.

## Registration order

The watcher must exist before the item announces itself, otherwise the shell never notices it:

1. Connect to the session bus and own a unique well-known name (`org.kde.StatusNotifierItem-<app>-<pid>-<n>`).
2. Export the item object at `/StatusNotifierItem` and the menu at `/MenuBar`.
3. Call `RegisterStatusNotifierItem` on `org.kde.StatusNotifierWatcher` (falling back to `org.freedesktop.StatusNotifierWatcher`).

A missing watcher is **not fatal** — the item stays exported, so a watcher that starts later can still find it through `NameOwnerChanged`.

## Item interface

| Member | Direction | Payload |
|---|---|---|
| `Activate(x, y)` | shell → item | primary click |
| `SecondaryActivate(x, y)` | shell → item | middle click |
| `ContextMenu(x, y)` | shell → item | dbusmenu carries the geometry, so UDA only logs it |
| `Scroll(delta, orientation)` | shell → item | no cross-platform event, logged only |
| `ProvideXDGActivationToken(token)` | shell → item | Wayland handshake, accepted and discarded |
| `Category` | item → shell | always `ApplicationStatus` |
| `Id` | item → shell | the registered application name |
| `Title` | item → shell | tooltip title line |
| `ToolTip` | item → shell | `(icon name, icon pixmap, title, description)` |
| `Status` | item → shell | `Active` when visible, `Passive` when hidden |
| `ItemIsMenu` | item → shell | always `false` — `Activate` fires events, not a menu |
| `Menu` | item → shell | the object path of the dbusmenu implementation |
| `NewStatus` / `NewIcon` / `NewTitle` | item → shell (signal) | emitted only for the field that changed |

## Icon byte order

`IconPixmap` is typed `a(iiay)` and documented as "ARGB32 rows", which in practice means **byte order B, G, R, A** — not A, R, G, B. Writing the channels as A, R, G, B swaps red and blue, so a red icon arrives blue.

Rows are also **bottom-up**: source row 0 lands at the end of the destination buffer, and `stride` padding is skipped rather than copied.

A `Path` value is interpreted as a **freedesktop icon-theme name**, not a filesystem path. That is why the Python and Node.js SDKs decode a PNG into RGBA and submit pixels instead of handing over a path.

## Double click

SNI has no double-click signal. UDA synthesises one from two `Activate` calls inside a 500 ms window — the same window as Windows' `GetDoubleClickTime()` — and **deliberately does not advertise** `TRAY_DOUBLE_CLICK`, because claiming a capability the protocol cannot deliver would break the honest-capability contract.

The window always restarts on each click, so a triple click reads as click-then-double rather than one long double.

## See also

- [dbusmenu](/en/internals/protocols/dbusmenu/) — the companion menu protocol
- [System tray guide](/en/guides/tray/) — the cross-platform API on top
