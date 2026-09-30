---
title: XDG Desktop Portal
description: "The Tier-1 interface every UDA Linux feature tries first: what it covers, and where it stops being enough."
---

A D-Bus API (`org.freedesktop.portal.*`) that lets sandboxed and unsandboxed applications reach privileged desktop functions through the *desktop's own* consent UI. It is the first rung of the UDA fallback chain because it is the only interface that behaves identically across GNOME, KDE, and any compliant compositor.

## Portal vs. native

| | Portal | Native DE IPC |
|---|---|---|
| Consistency | One interface everywhere | One per desktop |
| Consent | The desktop asks the user | Silent, if the session allows it |
| Availability | Needs `xdg-desktop-portal` installed | Always present on that DE |
| Latency | One extra daemon hop | Direct |
| Richness | Lowest common denominator | Full DE feature set |

UDA uses the portal where it exists and falls back to native IPC when it does not, which is why a feature can be `Full` on GNOME and `Restricted` on a bare WLR compositor.

## Interfaces UDA consumes

| Interface | Used for | Notes |
|---|---|---|
| `org.freedesktop.portal.Settings` | Appearance: `Read("org.freedesktop.appearance", "color-scheme")` | Also carries the accent-colour read on desktops that expose it |
| `org.freedesktop.portal.Background` | Wallpaper: `SetWallpaper` with a `file://` URI | Requires a parent window handle on some backends |
| `org.freedesktop.portal.Inhibit` | Wake locks: `Inhibit` / `UnInhibit` | Session-wide, not per-display |
| `org.freedesktop.portal.Clipboard` | Clipboard (Phase 3) | Mainly relevant for remote-desktop sessions |

## Where the portal stops

The portal deliberately does **not** cover everything, and UDA goes around it rather than pretending otherwise:

- **System tray** has no portal interface. UDA implements SNI directly and registers with `org.kde.StatusNotifierWatcher`.
- **Media control** has no portal. UDA speaks MPRIS v2 over the session bus.
- **Session & power** have no portal interface for lock/logout/reboot; UDA uses `systemd-logind` and `org.freedesktop.ScreenSaver`, which is also what the portal itself would call underneath.
- **Global shortcuts** only gained a portal (`org.freedesktop.portal.GlobalShortcuts`) recently, and many compositors still have no implementation — hence the X11 `XGrabKey` Tier 2.

## The consent dialog problem

The portal may present a dialog asking the user to allow the action. That means a portal call can take arbitrarily long, or never return. Every UDA portal call therefore runs inside a `tokio::time::timeout`, and a timeout is reported as a typed error rather than leaving the caller blocked forever — the concrete timeout and the mapping live in the relevant `*_specs.md` file under `docs/internals/`.

## See also

- [Fallback engine](/en/internals/fallback-engine/) — the full four-tier chain
- [Capability and fallback](/en/guides/capability-and-fallback/) — how a host queries what is available
