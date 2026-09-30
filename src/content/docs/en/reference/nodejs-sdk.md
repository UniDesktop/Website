---
title: Node.js SDK
description: The koffi binding in examples/nodejs/uda.js — zero compilation, BigInt handles.
---

A zero-compile binding over the [C-ABI](/en/reference/c-abi/) using [koffi](https://koffi.dev/). Callers never see `koffi.alloc` out-slots, `BigInt` handles or hex status codes: slot allocation, string freeing and function-pointer lifetimes are all handled inside the module, and failures throw an `Error` whose message is the library's own diagnostic.

## Installing

```bash
cd examples/nodejs
npm install
```

[koffi](https://koffi.dev/) loads the shared library directly; no `node-gyp` and no native compilation step is required.

## Importing

```javascript
const { Uda } = require('./uda');
const uda = new Uda();
```

## Constants

```javascript
Uda.THEME            // { DARK, LIGHT, UNKNOWN }
Uda.FILL_MODE        // { CROP, FILL, FIT, STRETCH }
Uda.WAKELOCK_TYPE    // { DISPLAY, SYSTEM }
Uda.MEDIA_COMMAND    // { PLAY, PAUSE, TOGGLE, NEXT, PREVIOUS, STOP }
Uda.MEDIA_STATUS     // { PLAYING, PAUSED, STOPPED, UNKNOWN }
Uda.SESSION_ACTION   // { LOCK, LOGOUT, SUSPEND, HIBERNATE, REBOOT, SHUTDOWN }
```

## The entry class `Uda`

```javascript
const { Uda } = require('./uda');

const uda = new Uda();
console.log(uda.theme);                 // 'dark' | 'light' | 'unknown'
console.log(uda.accentColor);           // { r, g, b, a } or null
uda.notify('标题', '正文内容');
uda.dispose();
```

`Uda` also supports `Symbol.dispose`, so it can be used with `using` under Node 20+ explicit resource management.

| API | What it does |
|---|---|
| `uda.theme` | read-only appearance probe |
| `uda.accentColor` | `{ r, g, b, a }` or `null` |
| `uda.wallpaper` / `uda.setWallpaper(path, mode)` | current path or `null`; setter accepts `crop` \| `fill` \| `fit` \| `stretch` |
| `uda.notify(title, body, options)` | returns the notification id |
| `uda.wakelock(options)` | returns a `WakeLock`; call `.release()` |
| `uda.createTrayIcon(name, options)` | returns a `TrayIcon` |
| `uda.createTrayMenu()` | returns a `TrayMenu` |
| `uda.media` | `nowPlaying`, `status`, `send(command)` |
| `uda.session` | `capabilities`, `supports(action)`, and the six actions |
| `uda.dispose()` | release every lock, icon and menu the instance owns |

A hand-picked path can be passed as a positional constructor argument when the automatic lookup fails: `new Uda('/abs/path/libuda_ffi.so')`. The lookup order is the `UDA_LIBRARY` environment variable → the `cargo metadata` target directory (including the cross-compilation target subdirectories) → the in-repo `target/` directory → the platform default name (`libuda_ffi.so` / `uda_ffi.dll`).

## Notifications

```javascript
uda.notify('构建完成', '所有测试均通过。', {
  appName: 'My CI',
  icon: 'icons/UniDesktop_3D_transparent_mini.png',
  actions: { open: '查看详情' },
});
```

`appName` is the toast identity on Windows; an empty value selects the generic `UniDesktop.Notification`. Action *buttons* need an MSIX-packaged activator on Windows, so they render as text — the toast itself still appears.

## Tray icons and menus

```javascript
const icon = uda.createTrayIcon('My App', { tooltip: '点击打开', icon: 'icon.png' });

const menu = uda.createTrayMenu();
const openId = menu.addText('打开', (itemId) => console.log('open'));
menu.addCheckbox('深色模式', true, (itemId, checked) => console.log(checked));
menu.addSeparator();
menu.addText('退出', () => icon.destroy());
icon.menu = menu;

await icon.wait();     // resolves once the icon is destroyed
```

`addText` and `addCheckbox` return the row's stable, non-zero `itemId`. The callbacks receive it as their first argument: `(itemId) => …` for a text row and `(itemId, checked) => …` for a checkbox row, where `checked` is the state *after* the click.

An icon path can be a `.png`: the SDK reads the file, decodes it with a bundled pure-Node PNG decoder (built on `zlib`) and submits RGBA, because Linux's `StatusNotifierItem` interprets a `Path` as a freedesktop icon-**theme name**. The image is downsampled to a 32 px longest edge, with alpha-premultiplied area averaging so transparent edges do not pick up a black fringe.

Callbacks fire on the tray worker thread, so they must be cheap and must not block the event loop — defer into your own async work instead.

## Media and session

```javascript
const track = uda.media.nowPlaying;      // null when no player is running
if (track) console.log(`${track.title} — ${track.artist} (${track.durationMs} ms)`);
uda.media.send('play');

console.log(uda.media.status);           // 'playing' | 'paused' | 'stopped' | 'unknown'
uda.media.play(); uda.media.pause();  uda.media.playPause();
uda.media.next();  uda.media.previous();  uda.media.stop();
```

`nowPlaying` returns an object with `title`, `artist`, `album`, `durationMs` and `positionMs`; every field is `''` or `0` when the player does not publish it. `status` covers both "no player" and "state unreadable" as `'unknown'` — neither is an error.

if (uda.session.supports('suspend')) {
  uda.session.suspend();                 // destructive — confirm first
}
```

`nowPlaying` returns `null` rather than throwing when nothing is playing. Five of the six session actions end the user's session or stop the machine; only `lock()` is safe to automate.

## Errors

```javascript
try {
  uda.setWallpaper('/nonexistent.png', 'fill');
} catch (error) {
  console.error(error.message);          // the library's diagnostic text
}
```

See [status codes](/en/reference/status-codes/) for what each condition means.

## Naming compared with the Python SDK

| Concept | Python | Node.js |
|---|---|---|
| Entry point | `Uda()` | `new Uda()` |
| Theme | `uda.theme` | `uda.theme` |
| Accent colour | `uda.accent_color` → `(r,g,b,a)` | `uda.accentColor` → `{r,g,b,a}` |
| Wallpaper | `uda.wallpaper` / `uda.set_wallpaper()` | `uda.setWallpaper()` |
| Notification | `uda.notify(title, body, icon=, actions=, app_name=)` | `uda.notify(title, body, {icon, actions, appName})` |
| Wake lock | `uda.wakelock()` | `uda.wakelock()` |
| Tray icon | `uda.create_tray_icon()` | `uda.createTrayIcon()` |
| Tray menu | `uda.create_tray_menu()` | `uda.createTrayMenu()` |
| Media | `uda.media` | `uda.media` |
| Session | `uda.session` | `uda.session` |
| Text row | `add_text(label, cb)` | `addText(label, cb)` |
| Checkbox row | `add_checkbox(label, checked, cb)` | `addCheckbox(label, checked, cb)` |
| Separator | `add_separator()` | `addSeparator()` |
| Now playing | `track.duration_ms` | `nowPlaying.durationMs` |
| Automatic release | `with` / `__del__` | `Symbol.dispose` / `using` |
| Errors | `UdaError(status, message)` | `Error(message)` |

## See also

- [Python SDK](/en/reference/python-sdk/) — the same surface over ctypes
- [C-ABI reference](/en/reference/c-abi/) — the underlying functions
- [Status codes](/en/reference/status-codes/) — the constants and their triggers
