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

## Reading the accent colour

```python
color = uda.accent_color      # (r, g, b, a) or None
```

The four channels are written into a caller-supplied buffer, and a platform with no system-wide accent concept (KDE, XFCE, most Wayland tilers) leaves the slot untouched and still returns success. A zeroed slot therefore means "no accent", which is **not** an error — check the returned status only for hard failures.

## Following the system

A UI that wants to track the user's choice registers a listener rather than polling:

- **Linux** listens to the portal's `SettingChanged` signal for `org.freedesktop.appearance/color-scheme`, falling back to the GNOME GSettings key.
- **Windows** listens to `WM_SETTINGCHANGE` for `ImmersiveColorSet`, backed by the registry value `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\AppsUseLightTheme`.

If your toolkit already handles theme changes, prefer its own signal — UDA's listener is there for hosts with no such integration.

## Per-desktop behaviour

| Desktop | Source | Notes |
|---|---|---|
| GNOME 42+ | `org.freedesktop.portal.Settings` | the modern standard answer |
| KDE Plasma 5 / 6 | portal / GSettings | reports `Restricted` when only GSettings answers |
| XFCE | GSettings if a GTK app wrote a value | no system-wide scheme; often `Restricted` |
| Hyprland / Sway | GSettings | tiling composers rarely publish a scheme |
| Windows 10 / 11 | Registry `AppsUseLightTheme` | full support, including live changes |

The capability bit `Capability::DETECT_THEME` says whether *any* source answered; `Capability::FOLLOW_SYSTEM_THEME` says whether change events are available. Query them before drawing a "follow system" toggle.

## Design note

Reading the scheme is a **read-only, side-effect-free** query with no D-Bus write, so a UI can call it freely — on startup, on every window shown, or on every signal. It never touches the desktop's own theme; it only observes.

## See also

- [Capability and fallback](/en/guides/capability-and-fallback/) — how the tier chain resolves here
- [Platform support](/en/reference/platform-support/) — the per-desktop matrix
