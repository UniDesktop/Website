---
title: Wallpaper
description: Setting and reading the desktop background with fill modes, multi-monitor targeting and dark/light pairing.
---

## Setting a wallpaper

```python
from uda import Uda, FillMode

with Uda() as uda:
    uda.wallpaper = "~/Pictures/a.png"                    # defaults to fill
    uda.set_wallpaper("b.png", FillMode.FIT)              # explicit mode
    print(uda.wallpaper)                                  # the configured path, or None
```

```javascript
uda.setWallpaper('~/Pictures/a.png', 'fill');
console.log(uda.wallpaper);
```

## Fill modes

| Mode | Behaviour |
|---|---|
| `crop` | scale to fill, preserving the aspect ratio; the overflow is cropped |
| `fill` | scale to fill, ignoring the aspect ratio |
| `fit` | scale to fit inside, preserving the aspect ratio; letterbox if needed |
| `stretch` | stretch to fill, ignoring the aspect ratio |

`crop` and `fit` preserve the aspect ratio; `fill` and `stretch` do not — which one is "correct" depends on the artwork.

## Dark / light pairing

GNOME keeps two values — `picture-uri` and `picture-uri-dark` — so the background can follow the system colour scheme. UDA writes both when the backend supports it, falling back to a single value otherwise.

Check `Capability::FOLLOW_SYSTEM_THEME` or the backend's own support level before assuming the pairing took.

## Multi-monitor

Where the backend exposes per-monitor state (GNOME monitors via the portal, KDE via plasmashell), UDA targets all screens by default. Per-monitor selection is part of the Display Topology work; until then the set value applies to every screen the backend covers.

## Per-desktop backends

Tier 1 tries the XDG Desktop Portal first, then native DE IPC, then CLI tools, then a typed error:

| Desktop | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| GNOME 42+ | Portal background | GSettings `picture-uri` | — |
| KDE Plasma 5 / 6 | — | `org.kde.plasmashell` → `/PlasmaShell` → `evaluateScript` | — |
| Hyprland | — | IPC socket → `hyprpaper` | `swww` |
| Sway | — | IPC socket | `swww` |
| Generic X11 | — | — | `feh` → `nitrogen` |
| Windows | — | `SystemParametersInfoW(SPI_SETDESKWALLPAPER)` | — |

Reading the wallpaper goes through the same chain in reverse and reports what is *configured*, which may differ from what is currently rendered.

## Errors

| Outcome | Error |
|---|---|
| No portal, no DE IPC, no CLI tool | `UdaError::Unsupported` |
| The file is missing or unreadable | `UDA_ERR_IO` |
| An empty path, or an unknown fill mode | `UDA_ERR_INVALID_ARGUMENT` |

Reading returns `None` when no wallpaper is configured, or when the platform cannot report one — that is not a failure, so check the returned value rather than the status.

## See also

- [Capability and fallback](/en/guides/capability-and-fallback/) — the tier chain in detail
- [`docs/internals/wallpaper_specs.md`](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/wallpaper_specs.md) — the full protocol mapping
