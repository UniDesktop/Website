---
title: Platform support
description: Per-desktop capability matrix, the tier each backend uses, and how to interpret the ⚠️ entries.
---

## Matrix

| Platform / DE | Theme | Wallpaper | Notification | WakeLock | Tray | Media | Session |
|---|---|---|---|---|---|---|---|
| **Windows 10 / 11** | ✅ | ✅ | ✅ [^toast] | ✅ | ✅ | ✅ | ✅ |
| **GNOME 42+** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **KDE Plasma 5 / 6** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **XFCE** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Hyprland** | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| **Sway** | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| **Generic X11** | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |

`✅` verified against the real backend · `⚠️` best-effort fallback.

[^toast]: See the [Windows notification limitations](/en/guides/notification/#windows-limitations).

## Tier used per feature

| Feature | Windows | GNOME | KDE | Hyprland / Sway | Generic X11 |
|---|---|---|---|---|---|
| Theme | Registry | Portal | Portal | ⚠️ GSettings | ⚠️ GSettings |
| Wallpaper | `SystemParametersInfoW` | Portal → GSettings | D-Bus `plasmashell` | compositor IPC / `swww` | Tier 3: `feh` → `nitrogen` |
| Notification | WinRT toast | portal | `org.freedesktop.Notifications` | `org.freedesktop.Notifications` | `org.freedesktop.Notifications` |
| WakeLock | `SetThreadExecutionState` | portal | ScreenSaver | ScreenSaver | Tier 3: `xdg-screensaver` |
| Tray | `Shell_NotifyIconW` | SNI via watcher | SNI via watcher | SNI via watcher | SNI via watcher |
| Media | SMTC | MPRIS v2 | MPRIS v2 | MPRIS v2 | MPRIS v2 |
| Session | Win32 | logind / ScreenSaver | logind / ScreenSaver | logind | logind / Tier 3 |

## What ⚠️ means in practice

The exact answer is always available at runtime through `capabilities()` / `support_level()` — never assume from this table.

| Entry | What the fallback does | Reported as |
|---|---|---|
| Theme on Hyprland / Sway / X11 | No system-wide colour scheme; reads GSettings if a GTK app has written a value | `Restricted("no system-wide theme source")` |
| Notifications on tilers / X11 | `org.freedesktop.Notifications` works, but actions and images depend on the installed daemon | `Restricted` when the daemon is old |
| WakeLock on tilers / X11 | Falls back to `xdg-screensaver` if the ScreenSaver service is absent | `Restricted` when only the CLI tier answers |
| Tray on XFCE | SNI works through the AppIndicator-compatible watcher, but no native double-click event | `Partial` for `DoubleClick` only |

## Reporting from a host application

```rust
let manager = uda_platform_linux::LinuxTrayManager::new();
let level = TrayManager::support_level(&manager, TrayFeature::DoubleClick);

match level {
    SupportLevel::Full => { /* draw the double-click action */ }
    SupportLevel::Restricted(reason) => { warn!("double click is {reason}") }
    SupportLevel::Unsupported => { /* hide it */ }
}
```

From a C host the same information is available through `uda_session_capabilities` and the module `capabilities()` functions.

## Not yet covered (Phase 3)

Global shortcuts, the multi-format clipboard with change listening, audio endpoint routing and display brightness are in progress — see [`plans/phase3_plan.md`](https://github.com/UniDesktop/SDK/blob/develop/plans/phase3_plan.md).

## See also

- [Capability and fallback](/en/guides/capability-and-fallback/) — how the tier chain works
- [Troubleshooting](/en/guides/troubleshooting/) — what to do when a feature reports `Unsupported`
