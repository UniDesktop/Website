---
title: XDG Desktop Portal
description: "The Tier-1 interface every UDA Linux feature tries first: what it covers, and where it stops being enough."
---

XDG Desktop Portal is freedesktop's standard sandboxed interface layer. The desktop environment implements it itself and applications call it over D-Bus, so a caller never needs to know whether GNOME or KDE is behind it. It is the **Tier 1** rung of UDA's fallback chain, because it is the only interface that behaves identically across GNOME, KDE and any compliant compositor.

## Portal versus native IPC

| | Portal | Native DE IPC |
|---|---|---|
| Consistency | one interface everywhere | one per desktop |
| Consent | the desktop asks the user | silent, if the session allows it |
| Availability | needs `xdg-desktop-portal` installed | always present on that DE |
| Latency | one extra daemon hop | direct |
| Richness | the lowest common denominator | the full DE feature set |

UDA uses the portal wherever it exists and falls back to native IPC where it does not.

## Fixed endpoints

```text
Bus       : Session Bus
Dest      : org.freedesktop.portal.Desktop
Path      : /org/freedesktop/portal/desktop
Interfaces: org.freedesktop.portal.<Feature>
```

## Interfaces UDA consumes

| Interface | Used for | Notes |
|---|---|---|
| `org.freedesktop.portal.Settings` | Appearance: `Read("org.freedesktop.appearance", "color-scheme")`, and the accent colour on desktops that expose it | The only portal interface UDA currently calls |

`color-scheme` takes three values:

```text
Read("org.freedesktop.appearance", "color-scheme")
  0 = Default / Unknown
  1 = Prefer Dark
  2 = Prefer Light
```

Changes are announced through the `SettingChanged(namespace, key, value)` signal. UDA reads a snapshot only and does not expose a listener yet.

## Where the portal stops

The portal deliberately does **not** cover everything, and UDA goes around it rather than pretending otherwise:

- **System tray** has no portal interface. UDA implements SNI directly and registers with `org.kde.StatusNotifierWatcher`.
- **Media control** has no portal. UDA speaks MPRIS v2 over the session bus.
- **Session & power** have no portal interface for lock/logout/reboot; UDA uses `systemd-logind` and `org.freedesktop.ScreenSaver`.
- **Wallpaper** has a portal interface (`org.freedesktop.portal.Wallpaper`) but UDA does not call it: the Linux wallpaper backend goes straight to GNOME `gsettings`, then KDE `plasmashell`, then the `hyprpaper` / `swww` / `feh` / `nitrogen` CLI tools. See [wallpaper specifications](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/wallpaper_specs.md) for the per-desktop mapping.
- **Wake locks** have a portal interface (`org.freedesktop.portal.Inhibit`), but the backend calls `org.freedesktop.ScreenSaver.Inhibit` on the session bus instead, because that service is present on every desktop that runs a screen saver.

## The consent dialog problem

The portal may present a dialog asking the user to allow the action. That means a portal call can take arbitrarily long, or never return. Every UDA portal call therefore runs inside a `tokio::time::timeout`, and a timeout is reported as a typed error rather than leaving the caller blocked forever — the concrete timeout and the mapping live in the relevant `*_specs.md` file under `docs/internals/`.

## See also

- [Fallback engine](/en/internals/fallback-engine/) — the full four-tier chain
- [Capability and fallback](/en/guides/capability-and-fallback/) — how a host queries what is available
