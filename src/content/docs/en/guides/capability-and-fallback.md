---
title: Capability and fallback
description: The SupportLevel tri-state, the four-tier fallback chain, and how to query capabilities from a host.
---

## Why query capabilities at all

Linux desktops are heavily fragmented, and Wayland strictly restricts some capabilities outright. Code that assumes a feature exists crashes on the next machine.

UDA's answer: **every feature reports how well it can do something**, so the application branches *before* it breaks.

## SupportLevel tri-state

| Level | Meaning | What your app should do |
|---|---|---|
| `SupportLevel::Full` | fully supported | use it normally |
| `SupportLevel::Restricted(reason)` | partially supported, with a reason | degrade the UI or tell the user, but keep it usable |
| `SupportLevel::Unsupported` | not available at all | hide the entry, or explain why |

## Capability bit flags

Underneath, capabilities are a set of `bitflags`, one bit per feature:

```rust
use uda_core::capability::Capability;

let caps = manager.capabilities()?;

if caps.contains(Capability::SET_WALLPAPER) {
    // show the "change wallpaper" button
}
```

A Rust trait's `capabilities()` returns a `Capability`; the C-ABI exposes the same information as plain integer bits (see [session capability bits](/en/guides/session/#capability-bits) for that module's table).

## The four-tier chain

Every OS desktop action on Linux strictly follows:

```text
Tier 1  XDG Desktop Portal       is org.freedesktop.portal.* available?
   ↓ no
Tier 2  Native DE IPC            read $XDG_CURRENT_DESKTOP, call GNOME/KDE
                                 D-Bus methods, or Hyprland/Sway sockets
   ↓ no
Tier 3  CLI tools                probe PATH for swww / hyprpaper / feh /
                                 nitrogen / xfconf-query
   ↓ no
Tier 4  Typed error              UdaError::Unsupported("...")
```

When all three service tiers fail there is **no panic** and no bare `io::Error` — the caller gets a `UdaError::Unsupported` carrying a diagnosis.

The real chain for wallpaper:

| Desktop | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| GNOME 42+ | Portal | GSettings `picture-uri` | — |
| KDE Plasma | — | `org.kde.plasmashell` `evaluateScript` | — |
| Hyprland | — | IPC socket → `hyprpaper` / `swww` | — |
| Sway | — | IPC socket | `swww` |
| Generic X11 | — | — | `feh` → `nitrogen` |

## Querying from a host

```rust
let manager = uda_platform_linux::LinuxTrayManager::new();

// Cheap, always answers.
let level = TrayManager::support_level(&manager, TrayFeature::Tooltip);

match level {
    SupportLevel::Full => { /* draw the tooltip field */ }
    SupportLevel::Restricted(reason) => { warn!("tooltip is {reason}") }
    SupportLevel::Unsupported => { /* hide it */ }
}
```

`support_level` answers from the capability set the backend published at registration, so the value always describes *this* icon's environment. Before a backend publishes, the answer stays `Unsupported` — the honest default when no tray mechanism could be reached.

## One extra rule: `Partial` is reserved

A backend publishes `Partial` only when it can genuinely do something degraded — Linux double-click synthesis, or a tooltip longer than the soft cap. An absent flag is a plain `None`, never a guess. That is what keeps "advertised" meaning "deliverable".

## See also

- [Fallback engine](/en/internals/fallback-engine/) — how each tier probes and decides
- [Platform support](/en/reference/platform-support/) — the per-desktop matrix
- [Troubleshooting](/en/guides/troubleshooting/) — what to do when something reports `Unsupported`
