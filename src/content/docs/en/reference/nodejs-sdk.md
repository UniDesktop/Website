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

## The entry class

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

A hand-picked path can be passed as a constructor argument when the automatic lookup fails: `new Uda({ libraryPath })`. The lookup order is `UDA_LIBRARY` → `cargo metadata` target directory → common in-repo build directories → the system search path.

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
menu.addText('打开', () => console.log('open'));
menu.addCheckbox('深色模式', true, (itemId, checked) => console.log(checked));
menu.addSeparator();
menu.addText('退出', () => icon.destroy());
icon.menu = menu;

await icon.wait();     // resolves once the icon is destroyed
```

An icon path can be a `.png`: the SDK reads the file, decodes it with a bundled pure-Node PNG decoder (built on `zlib`) and submits RGBA, because Linux's `StatusNotifierItem` interprets a `Path` as a freedesktop icon-**theme name**. The image is downsampled to a 32 px longest edge, with alpha-premultiplied area averaging so transparent edges do not pick up a black fringe.

Callbacks fire on the tray worker thread, so they must be cheap and must not block the event loop — defer into your own async work instead.

## Media and session

```javascript
const track = uda.media.nowPlaying;      // null when no player is running
if (track) console.log(`${track.title} — ${track.artist} (${track.durationMs} ms)`);
uda.media.send('play');

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

## See also

- [Python SDK](/en/reference/python-sdk/) — the same surface over ctypes
- [C-ABI reference](/en/reference/c-abi/) — the underlying functions
