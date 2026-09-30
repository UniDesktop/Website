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

库解析顺序同 Python：`UDA_LIBRARY` 环境变量 → `cargo metadata` 报告的 target 目录 → 平台默认名（`libuda_ffi.so` / `uda_ffi.dll`）。

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
| `nowPlaying` | `{title, artists[], album, durationMs} \| null` getter |
| `status` | `string` getter |
| `send(command)` | 方法，接受指令名字符串 |

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
| `addText(label, callback)` | 文本项 |
| `addCheckbox(label, checked, callback)` | 复选框，回调接收新状态 |
| `addSeparator()` | 分隔线 |
| `destroy()` | 销毁 |

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
