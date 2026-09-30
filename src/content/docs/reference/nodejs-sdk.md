---
title: Node.js SDK
description: 基于 koffi 的封装：类成员表、资源释放与 Python SDK 命名对照。
---

## 前置：安装 koffi

```bash
cd examples/nodejs && npm install
```

`koffi` 直接加载共享库，**不需要** `node-gyp` 或任何原生编译步骤。

## 导入

```javascript
const { Uda } = require('./uda');
const uda = new Uda();
```

库解析顺序：构造参数 `libraryPath`（位置参数）→ `UDA_LIBRARY` 环境变量 → `cargo metadata` 报告的 target 目录（含各交叉编译 target 子目录）→ 仓库内 `target/` → 平台默认名（`libuda_ffi.so` / `uda_ffi.dll`）。

自动查找失败时显式传入路径：

```javascript
const uda = new Uda('/abs/path/libuda_ffi.so');
```

## 常量对象

```javascript
Uda.THEME            // { DARK, LIGHT, UNKNOWN }
Uda.FILL_MODE        // { CROP, FILL, FIT, STRETCH }
Uda.WAKELOCK_TYPE    // { DISPLAY, SYSTEM }
Uda.MEDIA_COMMAND    // { PLAY, PAUSE, TOGGLE, NEXT, PREVIOUS, STOP }
Uda.MEDIA_STATUS     // { PLAYING, PAUSED, STOPPED, UNKNOWN }
Uda.SESSION_ACTION   // { LOCK, LOGOUT, SUSPEND, HIBERNATE, REBOOT, SHUTDOWN }
```

## `Uda`

| 成员 | 类型 |
|------|------|
| `new Uda(libraryPath)` | 构造 |
| `uda.theme` | `string` getter |
| `uda.accentColor` | `{r,g,b,a} \| null` getter |
| `uda.setWallpaper(path, fillMode)` | 方法 |
| `uda.notify(title, body, options)` | 方法 → `number` |
| `uda.createTrayIcon(name, options)` | → `TrayIcon` |
| `uda.createTrayMenu()` | → `TrayMenu` |
| `uda.wakelock(lockType, reason)` | → `WakeLock` |
| `uda.media` | `MediaController` getter |
| `uda.session` | `SessionController` getter |
| `uda.dispose()` | 释放全部资源 |

### `notify` 的 options

```javascript
uda.notify('标题', '正文', {
  appName: '我的应用',
  icon: '/path/to/icon.png',
  actions: { open: '查看详情', later: '稍后提醒' },
});
```

## `MediaController`

| 成员 | 类型 |
|------|------|
| `nowPlaying` | `{title, artist, album, durationMs, positionMs} \| null` getter |
| `status` | `'playing'` / `'paused'` / `'stopped'` / `'unknown'` getter |
| `send(command)` | 方法，接受指令名字符串 |
| `play()` / `pause()` / `playPause()` / `next()` / `previous()` / `stop()` | 便捷方法 |

`nowPlaying` 的 `title` / `artist` / `album` 为字符串，播放器未发布时为 `''`；`durationMs` 与 `positionMs` 为 `number`，未发布时为 `0`。元数据全空时归一为 `null`，与「没有播放器」不可区分。`status` 的 `unknown` 同时覆盖「没有播放器」与「状态无法判定」，两者都不是错误。

## `SessionController`

| 成员 | 类型 |
|------|------|
| `capabilities` | `object` getter，如 `{ lock: true, reboot: false }` |
| `supports(action)` | `boolean` |
| `lock()` / `logout()` / `suspend()` / `hibernate()` / `reboot()` / `shutdown()` | 方法 |

## `TrayIcon`

| 成员 | 类型 |
|------|------|
| `icon.menu = menu` | setter |
| `icon.tooltip = text` | setter（超 127 字符截断） |
| `icon.icon = path` | setter |
| `icon.visible = bool` | setter |
| `icon.wait()` | 异步，解析于 `stop()` / `destroy()` |
| `icon.stop()` | 让 `wait()` 返回，不注销 |
| `icon.destroy()` | 注销并销毁 |

## `TrayMenu`

| 成员 | 说明 |
|------|------|
| `addText(label, callback)` | 文本项；返回该行稳定且非零的 `itemId`（`BigInt`） |
| `addCheckbox(label, checked, callback)` | 复选框；返回 `itemId` |
| `addSeparator()` | 分隔线 |
| `destroy()` | 销毁 |

回调签名：文本项为 `(itemId) => …`，复选框为 `(itemId, checked) => …`，其中 `checked` 是点击**之后**的状态。`callback` 可为 `null`，表示静默行。文本行为空串时库返回 `UDA_ERR_NOT_SUPPORTED`。

图标可以是 `.png` 文件：SDK 读取文件后经内置的纯 Node（基于 `zlib`）PNG 解码器解码并提交 RGBA——Linux 的 `StatusNotifierItem` 把 `Path` 解释为 freedesktop 图标**主题名**，直接传文件路径什么都看不到。图像在提交前按最长边 32 px 降采样，并做 alpha 预乘的面积平均，避免透明边缘出现黑边。

回调运行在托盘工作线程上，必须尽快返回，且不得阻塞事件循环——请转入自己的异步任务。

## `WakeLock`

| 成员 | 说明 |
|------|------|
| `release()` | 释放；重复调用安全 |
| `[Symbol.dispose]` | 支持 `using` 声明 |

## 资源释放

SDK 为 `Uda`、`WakeLock`、`TrayIcon`、`TrayMenu` 实现了 `Symbol.dispose`，因此可用显式资源管理：

```javascript
{
  using uda = new Uda();
  console.log(uda.theme);
} // 离开作用域自动释放
```

不支持的旧运行时里退回显式调用：

```javascript
const uda = new Uda();
try {
  console.log(uda.theme);
} finally {
  uda.dispose();
}
```

## 异常模型

失败抛出原生 `Error`，消息中已包含库返回的诊断文本：

```javascript
try {
  uda.setWallpaper('/nope.png', 'fit');
} catch (e) {
  console.error(e.message);   // 'Feature not supported: ...'
}
```

## 与 Python SDK 命名对照

| 概念 | Python | Node.js |
|------|--------|---------|
| 入口 | `Uda()` | `new Uda()` |
| 主题 | `uda.theme` | `uda.theme` |
| 强调色 | `uda.accent_color` → `(r,g,b,a)` | `uda.accentColor` → `{r,g,b,a}` |
| 壁纸 | `uda.wallpaper` / `uda.set_wallpaper()` | `uda.setWallpaper()` |
| 通知 | `uda.notify(title, body, icon=, actions=, app_name=)` | `uda.notify(title, body, {icon, actions, appName})` |
| 常亮锁 | `uda.wakelock()` | `uda.wakelock()` |
| 托盘图标 | `uda.create_tray_icon()` | `uda.createTrayIcon()` |
| 托盘菜单 | `uda.create_tray_menu()` | `uda.createTrayMenu()` |
| 媒体 | `uda.media` | `uda.media` |
| 会话 | `uda.session` | `uda.session` |
| 文本项 | `add_text(label, cb)` | `addText(label, cb)` |
| 复选框 | `add_checkbox(label, checked, cb)` | `addCheckbox(label, checked, cb)` |
| 分隔线 | `add_separator()` | `addSeparator()` |
| 播放中曲目 | `track.duration_ms` | `nowPlaying.durationMs` |
| 自动释放 | `with` / `__del__` | `Symbol.dispose` / `using` |
| 异常 | `UdaError(status, message)` | `Error(message)` |
