---
title: Appearance
description: Detecting light/dark mode and reading the system accent colour, with live-follow support.
---

## Reading the colour scheme

```python
from uda import Uda

with Uda() as uda:
    print(uda.theme)          # 'dark' | 'light' | 'unknown'
```

```javascript
const { Uda } = require('./uda');
console.log(new Uda().theme);
```

```rust
let mode = uda_platform_linux::LinuxAppearanceManager::new().detect_theme()?;
```

`'unknown'` is a legitimate answer: a compositor with no colour-scheme concept (a bare window manager, some Wayland tilers) genuinely cannot tell, and guessing would be worse. Treat it as "cannot tell" and let the user choose.

:::note[Theme changes are a snapshot read]
`detect_theme` returns a **one-shot snapshot**. UDA does not currently expose a change listener, so a UI that tracks the user's choice must poll — an interval of at least one second is recommended. Subscribing to the native signals (`SettingChanged` on the portal, `WM_SETTINGCHANGE` with `ImmersiveColorSet` on Windows) and exposing that through the trait is planned for a later version.
:::

## Reading the accent colour

```python
color = uda.accent_color      # (r, g, b, a) or None
```

The four channels are written into a caller-supplied buffer, and a platform with no system-wide accent concept (KDE, XFCE, most Wayland tilers) leaves the slot untouched and still returns success. A zeroed slot therefore means "no accent", which is **not** an error — check the returned status only for hard failures.

## Following the system

UDA does not provide a change listener; the read is a snapshot. To follow the user's choice, poll `detect_theme` at a sensible interval:

```python
import time
from uda import Uda

with Uda() as uda:
    last = None
    while True:
        theme = uda.theme
        if theme != last:
            apply_theme(theme)
            last = theme
        time.sleep(1.0)
```

If your toolkit already handles theme changes, prefer its own signal — a UI framework that emits a theme-changed event is both cheaper and more accurate than polling.

## Per-desktop behaviour

| Desktop | Source | Notes |
|---|---|---|
| GNOME 42+ | `org.freedesktop.portal.Settings` | the modern standard answer |
| KDE Plasma 5 / 6 | `org.freedesktop.portal.Settings` → `kreadconfig6` / `kreadconfig5` reading `Colors:Scheme` | full support |
| XFCE | `xfconf-query -c xsettings -p /Net/ThemeName` | no system-wide scheme; often answers `unknown` |
| Hyprland / Sway | GSettings | tiling composers rarely publish a scheme |
| Windows 10 / 11 | Registry `AppsUseLightTheme` | full support, including live changes |

Note that the accent colour is a separate query from the colour scheme, with its own support profile:

| Platform | Accent colour |
|---|---|
| Windows | ✅ registry `HKCU\...\DWM\AccentColor`, unpacked to RGBA |
| GNOME | ✅ `gsettings get org.gnome.desktop.interface accent-color` |
| KDE / XFCE | best-effort; returns `None` when absent |
| Wayland tilers | ❌ no system-wide accent concept |

The capability bit `Capability::DETECT_THEME` says whether *any* source answered. `Capability::FOLLOW_SYSTEM_THEME` is defined in the flag set but is **not currently set by any backend**, because no backend publishes change events yet; do not gate a "follow system" toggle on it.

## Design note

Reading the colour scheme is a **read-only, side-effect-free** query with no D-Bus write, so a UI can call it freely — on startup, on every window shown, or on every signal. It never modifies the desktop's own theme; it only observes.

## See also

- [Capability and fallback](/en/guides/capability-and-fallback/) — how the tier chain resolves here
- [Platform support](/en/reference/platform-support/) — the per-desktop matrix
