---
title: System tray
description: Full lifecycle of tray icons and context menus, the threading model, and cleanup rules.
---

## Minimal working example

```python
from uda import Uda

with Uda() as uda:
    menu = uda.create_tray_menu()
    menu.add_text("设置", lambda: print("打开设置"))
    menu.add_separator()
    menu.add_text("退出", lambda: raise SystemExit(0))

    icon = uda.create_tray_icon("我的应用", tooltip="我的应用正在运行")
    icon.menu = menu

    icon.wait()          # blocks until stop() or destroy()
```

From Node.js:

```javascript
const { Uda } = require('./uda');

const uda = new Uda();
const menu = uda.createTrayMenu();
menu.addText('设置', () => console.log('打开设置'));
menu.addSeparator();

const icon = uda.createTrayIcon('我的应用', { tooltip: '我的应用正在运行' });
icon.menu = menu;
await icon.wait();
icon.destroy();
```

## Menu model

Cross-platform and identical in capability on both backends:

| Row type | Python | Node.js |
|---|---|---|
| Text item | `menu.add_text(label, callback)` | `menu.addText(label, callback)` |
| Checkbox | `menu.add_checkbox(label, checked, callback)` | `menu.addCheckbox(label, checked, callback)` |
| Separator | `menu.add_separator()` | `menu.addSeparator()` |

Callback signatures:

- Text item: `callback()`
- Checkbox: `callback(checked)` where `checked` is the **new state after the click**

### Platform backends

| Platform | Protocol |
|---|---|
| Linux | `org.kde.StatusNotifierItem` (SNI) + `com.canonical.dbusmenu` |
| Windows | `Shell_NotifyIconW` (`NOTIFYICON_VERSION_4`) with an owner-drawn popup menu |

## Icons: pass a file path

```python
icon.icon = "icons/UniDesktop_3D_transparent_mini.png"
```

The SDK decodes the PNG (per-row unfiltering, palette expansion, non-8-bit depth handling), downsamples to the target size, aligns the channels if needed, and submits pixels through `uda_tray_set_icon_rgba`.

:::caution[Do not call uda_tray_set_icon_path directly]
At the C-ABI layer, `uda_tray_set_icon_path` is interpreted on Linux as a **freedesktop icon-theme name**, not a filesystem path. This is the SNI contract: the desktop environment resolves the name against its theme directories. To display a custom image, use the SDK's `icon.icon = path`, which submits pixels instead.
:::

## Tooltip limits

Windows `szTip` holds 128 UTF-16 units including its NUL terminator, so the cross-platform hard cap is 127 `char`s. Text longer than the soft cap (80 chars) makes the backend report `SupportLevel::Partial` rather than silently clipping — so a host can warn the user instead of shipping a truncated tooltip.

## Threading

The backend owns a worker thread with its own event loop. What that means in practice:

- `icon.set_tooltip(...)`, `icon.icon = ...` and menu mutations return **immediately**; they write to shared state and the worker applies them.
- Callbacks run **on the worker thread**. They must be cheap, must not block, and must not touch host UI state directly — forward the event into the host's own loop.
- The host never needs to pump messages, run a GLib main loop, or spin an async runtime for the tray.

## Showing and hiding

```python
icon.visible = False     # hide without unregistering
icon.visible = True      # restore
```

Hiding is not destroying: the handle stays valid and can be restored at any time. On Linux the item reports `Passive` status while hidden; destroying it removes the entry from the shell entirely.

## Lifecycle and cleanup

| Method | Effect |
|---|---|
| `icon.wait()` | blocks the calling thread until `stop()` or `destroy()` is called |
| `icon.stop()` | makes `wait()` return **without** unregistering — the icon stays in the tray |
| `icon.destroy()` | unregisters from the tray and destroys the handle; `wait()` then returns |

The typical pattern:

```python
icon = uda.create_tray_icon("My App")
try:
    icon.wait()
finally:
    icon.destroy()
```

With a quit menu row:

```python
def quit():
    icon.stop()      # let wait() return, then destroy in the finally

menu.add_text("退出", quit)
icon.menu = menu
icon.wait()
icon.destroy()
```

`TrayIcon` and `TrayMenu` both implement `Drop` / `Symbol.dispose`, so leaving the `with` block unregisters automatically; a forgotten release is caught by `__del__` / `dispose`. `Uda.release_all()` releases every tray resource and wake lock the instance holds at once.

Dropping is **idempotent by construction**: only the first caller observes the shutdown flag, so a double drop, a drop during teardown, or a drop racing a menu open can never unregister twice.

A menu attached to an icon survives `menu.destroy()`, because the icon holds its own reference. Calling `icon.destroy()` on a handle that is already gone is `UDA_ERR_INVALID_ARGUMENT`, never a crash.

## See also

- [StatusNotifierItem](/en/internals/protocols/statusnotifieritem/) — the Linux protocol, including the `IconPixmap` byte order
- [dbusmenu](/en/internals/protocols/dbusmenu/) — the integer-keyed menu tree
- [Shell_NotifyIconW](/en/internals/protocols/notifyicon/) — the Windows side
