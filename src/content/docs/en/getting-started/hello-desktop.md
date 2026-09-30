---
title: Hello, desktop
description: Ten lines to detect the theme and send a notification.
---

## The shortest working example

```python
from uda import Uda

with Uda() as uda:
    print("主题:", uda.theme)
    uda.notify("你好，桌面", "这是通过 UDA 发出的第一条系统通知。")
```

Leaving the `with` block releases every resource this object holds — wake locks, tray icons, menus — automatically.

From Node.js:

```javascript
const { Uda } = require('./uda');

const uda = new Uda();
console.log(uda.theme);
uda.notify('你好，桌面', '这是通过 UDA 发出的第一条系统通知。');
uda.dispose();
```

## Line by line

| Fragment | What it does |
|---|---|
| `Uda()` | Loads the shared library and declares the prototypes for every export. Library resolution: explicit argument → `UDA_LIBRARY` → the target directory reported by `cargo metadata` |
| `uda.theme` | Attribute-style read, returning `"dark"` / `"light"` / `"unknown"` |
| `uda.notify(...)` | Method-style call, returning the id the notification server assigned |
| `with` / `release_all()` | The resource-release convention, described below |

## The release convention

Three kinds of object hold system resources in the Python SDK:

```python
with Uda() as uda:
    with uda.wakelock(reason="视频播放") as lock:      # released on exit
        ...

    icon = uda.create_tray_icon("我的应用")            # destroyed manually
    try:
        icon.wait()
    finally:
        icon.destroy()                                 # unregistered from the tray
```

- `Uda`, `WakeLock` are context managers — leaving the block releases them.
- `TrayIcon` and `TrayMenu` are destroyed explicitly; dropping the `Uda` that created them releases them too.
- Every release path is idempotent, so calling it twice is safe.

In Rust, `TrayIcon` implements `Drop` and the wake lock is an RAII guard, so release is automatic in the same way.

## What to explore next

| Guide | Shows |
|---|---|
| [Appearance](/en/guides/appearance/) | reading the colour scheme and the accent colour, with live-follow |
| [Wallpaper](/en/guides/wallpaper/) | fill modes, dark/light pairing, multi-monitor |
| [Notifications](/en/guides/notification/) | icons, urgency, action buttons, and the Windows identity rules |
| [System tray](/en/guides/tray/) | a full icon and context menu, with the threading model |
| [Media](/en/guides/media/) | what is playing, and how to drive it |
| [Wake locks](/en/guides/wakelock/) | keeping the display or the system awake |
| [Session & power](/en/guides/session/) | the six actions, their capability bits, and confirming before acting |

Or go straight to the [C-ABI reference](/en/reference/c-abi/) to bind from another language.

## Something went wrong?

[Troubleshooting](/en/guides/troubleshooting/) covers every symptom in order — starting with "why does everything report unsupported", which almost always means the session has no graphical session bus.
