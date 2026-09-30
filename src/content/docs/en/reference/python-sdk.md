---
title: Python SDK
description: The ctypes binding in examples/python/uda.py — zero dependencies, one entry class.
---

A pure-stdlib binding (`ctypes` + `zlib`) over the [C-ABI](/en/reference/c-abi/). Callers never see `byref`, `c_void_p`, raw pointers or hex status codes: every out-parameter, string allocation and function-pointer lifetime is handled inside the module, and failures raise a `UdaError` carrying the status code and the library's diagnostic message.

## Loading the library

`Uda()` locates `libuda_ffi` in this order:

1. The `UDA_LIBRARY` environment variable.
2. The target directory reported by `cargo metadata` (with the usual `debug` / `release` variants).
3. Common in-repo build directories relative to `examples/python/`.
4. The system dynamic-library search path.

An explicit path can also be passed: `Uda(library_path="/abs/path/libuda_ffi.so")`.

## The entry class

```python
from uda import Uda, Theme

with Uda() as uda:
    print(uda.theme)                       # 'dark' | 'light' | 'unknown'
    print(uda.accent_color)                # (r, g, b, a) or None
    uda.wallpaper = "~/Pictures/a.png"     # set the wallpaper
    print(uda.wallpaper)                   # path or None
    uda.notify("标题", "正文内容")
```

`Uda` is a context manager: leaving the `with` block releases every wake lock, tray icon and menu the instance owns. Calling `uda.release_all()` explicitly does the same, and is safe to call more than once.

## Namespaces

| Namespace | What it does |
|---|---|
| `uda.theme` / `uda.accent_color` | read-only appearance probes |
| `uda.wallpaper` | getter returns the current path or `None`; setter accepts a path, with `fill_mode` for `set_wallpaper()` |
| `uda.notify(title, body, options)` | returns the notification id |
| `uda.wakelock(type, reason)` | returns a `WakeLock`; call `.release()` or use it as a context manager |
| `uda.create_tray_icon(name, options)` | returns a `TrayIcon` |
| `uda.create_tray_menu()` | returns a `TrayMenu` |
| `uda.media` | `now_playing`, `status`, `send(command)` |
| `uda.session` | `capabilities()`, `supports(action)`, and the six action methods |
| `uda.release_all()` | release everything the instance holds |

## Notifications

```python
uda.notify(
    "构建完成",
    "所有测试均通过。",
    {"app_name": "My CI", "icon": "icons/UniDesktop_3D_transparent_mini.png",
     "actions": {"open": "查看详情"}},
)
```

`app_name` is the toast identity on Windows; leaving it empty selects the generic `UniDesktop.Notification`. On Windows, action *buttons* need an MSIX-packaged activator, so `actions` is accepted but rendered as text — the toast itself still appears.

## Tray icons and menus

```python
icon = uda.create_tray_icon("My App", {"tooltip": "点击打开", "icon": "icon.png"})

menu = uda.create_tray_menu()
menu.add_text("打开", on_click=lambda item_id: print("open"))
menu.add_checkbox("深色模式", checked=True, on_click=lambda i, c: print(c))
menu.add_separator()
quit_id = menu.add_text("退出", on_click=lambda _: icon.destroy())
icon.menu = menu

icon.wait()      # block until the icon is destroyed elsewhere
```

An icon path can be a `.png`: the SDK reads the file, decodes it with the bundled pure-stdlib PNG decoder and submits RGBA, because Linux's `StatusNotifierItem` interprets a `Path` as a freedesktop icon-**theme name** and would show nothing for a file path. The image is downsampled to a 32 px longest edge before being handed over.

Callbacks fire on the tray worker thread, so they must be cheap and must not touch UI state directly — forward into your own loop instead.

## Media and session

```python
track = uda.media.now_playing      # None when no player is running
if track:
    print(f"{track.title} - {track.artist} ({track.duration_ms} ms)")
uda.media.send("play" if uda.media.status != "playing" else "pause")

if uda.session.supports("suspend"):
    uda.session.suspend()          # destructive — confirm with the user first
```

`now_playing` returns `None` rather than raising when nothing is playing. Five of the six session actions end the user's session or stop the machine; only `lock()` is safe to automate.

## Errors

```python
from uda import UdaError

try:
    uda.wallpaper = "/nonexistent.png"
except UdaError as exc:
    print(exc.status, exc.message)
```

See [status codes](/en/reference/status-codes/) for the meaning of every code.

## See also

- [Node.js SDK](/en/reference/nodejs-sdk/) — the same surface over koffi
- [C-ABI reference](/en/reference/c-abi/) — the underlying functions
