---
title: 架构
description: 四层结构、各 crate 职责与依赖关系。
---

## 四层结构

```text
┌─────────────────────────────────────────────┐
│ examples/        Python (ctypes) / Node.js (koffi) / Rust  │
├─────────────────────────────────────────────┤
│ uda-ffi          C-ABI 导出层，panic 遏制       │
├─────────────────────────────────────────────┤
│ uda-core         trait / 类型 / 能力位 / 错误    │  ← 平台无关契约
│ uda-platform-linux    Linux 实现              │
│ uda-platform-windows  Windows 实现（cfg 门控） │
├─────────────────────────────────────────────┤
│ uda-cli          本地诊断 CLI                  │
└─────────────────────────────────────────────┘
```

## 各 crate 职责

### `uda-core`

只放**契约**，不含任何平台代码：

| 模块 | 内容 |
|------|------|
| `capability` | `Capability` bitflags、`SupportLevel` |
| `error` | `UdaError`（thiserror） |
| `appearance` | `AppearanceManager` trait、`Theme` |
| `wallpaper` | `WallpaperManager` trait、`FillMode`、`WallpaperOptions` |
| `notification` | `NotificationManager` trait、`Notification`、`Urgency`、图标规范化 |
| `wakelock` | `WakeLockManager` trait、`WakeLockType` |
| `tray` | `TrayManager` trait、`TrayIcon`、`TrayMenu`、`TrayIconSource` |
| `media` | `MediaManager` trait、`MediaCommand`、`PlaybackStatus`、`MediaMetadata` |
| `session` | `SessionManager` trait、`SessionAction`、`perform()` |

`perform()` 是**能力位守卫**：在调用后端之前先检查该动作的能力位，未命中直接返回 `UdaError::NotSupported`，不触碰系统。

### `uda-platform-linux`

基于 `zbus`（纯 Rust D-Bus）、XDG Portal、GNOME `gsettings`、KDE `plasmashell`、Hyprland/Sway Unix socket，以及 X11 CLI 工具。

### `uda-platform-windows`

基于注册表、`SystemParametersInfoW`、`SetThreadExecutionState`、WinRT toast、`Shell_NotifyIconW`、WinRT SMTC、Win32 会话/电源 API。

整 crate 以 `#![cfg(windows)]` 门控，**且声明位于模块列表之前**——这样即使误加一个模块声明，也不会在非 Windows 目标上被编译。这是 AGENTS.md Principle 3 的落地方式。

### `uda-ffi`

`#[no_mangle] extern "C"` 导出，边界处用 `catch_unwind` 兜住 panic 并转为 `UDA_ERR_PANIC`。所有字符串经 `CString` 转换，返回给调用方的字符串需手动释放。

### `uda-cli`

本地诊断工具（`cargo run -p uda-cli`），供开发者在真机上人工验证各后端，不参与库的发布路径。

## 依赖方向

```text
examples ──▶ uda-ffi ──▶ uda-core
                │
                ├──▶ uda-platform-linux   (cfg(unix))
                └──▶ uda-platform-windows (cfg(windows))

uda-cli ──▶ uda-core + uda-platform-linux
```

依赖是**单向的**：平台 crate 永远依赖 core，core 永远不知道平台的存在。

## 零重量级依赖

`uda-core` 不引入 Qt、GTK 或任何 GUI 工具箱。Linux 侧用纯 Rust `zbus` 而非 `libdbus` 的 C 绑定；Windows 侧用官方 `windows-rs`。这让库可以作为依赖嵌入任何现有应用而不带入庞大的原生依赖树。

## 托盘状态机归属 core 的原因

托盘的状态机（菜单行 id 分配、复选框语义、图标来源校验、可见性同步）全部在 `uda-core`，平台 crate 只负责「如何画到屏幕上」。原因：

1. 菜单模型是跨平台一致的，放在 core 避免两份实现漂移；
2. 核心逻辑因此**可被 Linux CI 测试**——Windows crate 在 Linux 上编译为空；
3. 平台差异（D-Bus 消息 vs Win32 窗口）被压缩到最小的一层。
