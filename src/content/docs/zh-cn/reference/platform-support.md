---
title: 平台支持矩阵
description: 功能 × 桌面环境的完整支持情况，以及每一格所用后端。
---

## 总览

| 功能 | Windows 10/11 | GNOME 42+ | KDE Plasma 5/6 | XFCE | Hyprland | Sway | 通用 X11 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 主题检测 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 强调色 | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| 壁纸 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 通知 | ✅[^1] | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 通知图标 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 通知按钮 | ⚠️[^2] | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 防休眠锁 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 系统托盘 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| 媒体播控 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 会话锁屏 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 会话注销 | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| 睡眠 / 休眠 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 重启 / 关机 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

`✅` 已验证对接真实后端 · `⚠️` 尽力而为，或依赖额外组件 · `❌` 平台无此概念。

[^1]: 商店安装的运行时（商店版 Python/Node.js）会把通知来源显示为宿主包族名，见 `docs/internals/notification_specs.md` §3.1。
[^2]: 未打包宿主中动作按钮降级为只读文本，见 §3.2。

## 每格的后端

### 主题检测

| 环境 | 后端 |
|------|------|
| Windows | 注册表 `AppsUseLightTheme` |
| GNOME | Portal `org.freedesktop.appearance` → `gsettings color-scheme` |
| KDE | `kreadconfig6/5` 读 `Colors:Scheme` |
| XFCE | `xfconf-query -c xsettings` |
| Wayland 平铺 WM | ⚠️ 无法可靠判定，返回 `UNKNOWN` |

### 壁纸

| 环境 | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| GNOME | Portal | GSettings `picture-uri` / `picture-uri-dark` | — |
| KDE | — | `org.kde.plasmashell` `evaluateScript` | — |
| Hyprland | — | IPC socket | `hyprpaper` / `swww` |
| Sway | — | IPC socket | `swww` |
| 通用 X11 | — | — | `feh` → `nitrogen` |
| Windows | — | `SystemParametersInfoW` | — |

### 通知

| 环境 | 后端 | 图标 | 按钮 |
|------|------|------|------|
| 任意 Linux DE | `org.freedesktop.Notifications` | ✅ | ✅ |
| Windows | WinRT `ToastNotificationManager` | ✅ | ⚠️[^2] |

Wayland 平铺 WM 需要通知守护进程在跑（`mako`、`swaync`、`dunst` 等），否则 `Notify` 调用报 `ServiceUnknown`。

### 系统托盘

| 环境 | 后端 | 备注 |
|------|------|------|
| Linux | `org.kde.StatusNotifierItem` + `com.canonical.dbusmenu` | GNOME 需 AppIndicator 扩展 |
| Windows | `Shell_NotifyIconW`（`NOTIFYICON_VERSION_4`） | 专用工作线程 + 消息泵 |

### 媒体播控

| 环境 | 后端 |
|------|------|
| Linux | MPRIS v2 over session D-Bus |
| Windows | WinRT SMTC |

### 会话与电源

| 动作 | Linux | Windows |
|------|-------|---------|
| 锁屏 | ScreenSaver `Lock` → `loginctl lock-session` | `LockWorkStation()` |
| 注销 | GNOME/KDE D-Bus 方法 | `ExitWindowsEx(EWX_LOGOFF)` |
| 睡眠/休眠 | logind `Suspend`/`Hibernate` | `SetSuspendState` |
| 重启/关机 | logind `Reboot`/`PowerOff` | `ExitWindowsEx` + `SeShutdownPrivilege` |

Linux 侧注销依赖具体 DE 提供 D-Bus 方法；未识别的桌面环境下该动作能力位为假。

## Restricted 而非 Full 的情形

| 功能 × 环境 | 级别 | 原因 |
|-------------|------|------|
| 主题检测 × Wayland 平铺 | Restricted | 无标准查询途径 |
| 强调色 × KDE/XFCE | Unsupported | 无系统级强调色 |
| 通知按钮 × Windows 未打包 | Restricted | 需 MSIX 注册 COM 激活器 |
| 托盘 × XFCE | Restricted | 依赖 StatusNotifierWatcher 是否在跑 |
| 防休眠 × Wayland 平铺 | Restricted | 依赖 `systemd-inhibit` / `swayidle` |

## 版本要求

| 环境 | 最低版本 |
|------|----------|
| Windows | 10（toast 功能在 10/11 上完整） |
| GNOME | 42 |
| KDE Plasma | 5 |
| XFCE | 4.14+ |
| Rust | 1.70 |
| Python | 3.9 |
| Node.js | 16 |
