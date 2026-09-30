---
title: 能力与降级
description: SupportLevel 三态、四级降级链，以及如何在应用里查询能力。
---

## 为什么需要能力查询

Linux 桌面高度碎片化，Wayland 还严格限制部分能力（例如获取窗口全局坐标）。任何"假设功能一定可用"的代码都会在另一台机器上崩溃。

UDA 的做法是：**每个功能主动上报它能做到什么程度**，应用在出错前就分流。

## SupportLevel 三态

| 级别 | 含义 | 应用应当 |
|------|------|----------|
| `SupportLevel::Full` | 完整支持 | 正常使用 |
| `SupportLevel::Restricted(Reason)` | 部分支持，附带原因 | 降级 UI 或提示用户，但仍可用 |
| `SupportLevel::Unsupported` | 完全不可用 | 隐藏入口，或给出说明 |

## Capability 位标志

底层用一组 `bitflags`，每位对应一项能力：

```rust
use uda_core::capability::Capability;

let caps = manager.capabilities()?;

if caps.contains(Capability::SET_WALLPAPER) {
    // 显示"更换壁纸"按钮
}
```

Rust trait 的 `capabilities()` 返回 `Capability`；C-ABI 侧对应具体数字位。会话模块的能力位见[会话与电源生命周期](/zh-cn/guides/session/#能力位表)。

## 四级降级链

在 Linux 上执行任何 OS 桌面动作时，严格遵循：

```text
Tier 1  XDG Desktop Portal      org.freedesktop.portal.* 是否可用？
   ↓ 否
Tier 2  原生 DE IPC             查 $XDG_CURRENT_DESKTOP，调 GNOME/KDE 的
                                D-Bus 方法，或 Hyprland/Sway 的 Unix socket
   ↓ 否
Tier 3  CLI 工具                探测 PATH 上的 swww / hyprpaper / feh /
                                nitrogen / xfconf-query
   ↓ 否
Tier 4  类型化错误              UdaError::Unsupported("...")
```

以壁纸为例的真实链路：

| 桌面 | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| GNOME 42+ | Portal | GSettings `picture-uri` | — |
| KDE Plasma | — | `org.kde.plasmashell` `evaluateScript` | — |
| Hyprland | — | IPC socket → `hyprpaper` / `swww` | — |
| Sway | — | IPC socket | `swww` |
| 通用 X11 | — | — | `feh` → `nitrogen` |

Windows 只有一级：Win32/WinRT API 在受支持版本上总可用，因此没有 portal、没有桌面 IPC、也没有 CLI 回退链。但 Tier 4 仍然适用——例如 Windows 7 上无深色模式检测，代码返回 `UdaError::NotSupported` 而非 panic。

## 在自己的代码里查询

**Python**：会话模块提供 `capabilities()` / `supports()`；其他功能目前通过异常获知。

```python
with Uda() as uda:
    if uda.session.supports("hibernate"):
        show_hibernate_button()
```

**Node.js**：同上，`uda.session.capabilities` / `uda.session.supports('lock')`。

**Rust**：任意后端：

```rust
manager.capabilities()?;          // Capability bitflags
WindowsNotificationManager::new().availability()?;   // 更细的运行时查询
```

## "优雅降级"优于"返回错误"

同一功能在不同环境下应有不同表现，而不是统一的失败：

| 场景 | 降级行为 |
|------|----------|
| Windows 未打包环境带 `actions` | 通知正常显示，按钮不渲染 |
| Windows 无图标 | 用文本模板，卡片不显示图片 |
| Linux 无强调色（KDE/Wayland） | `accent_color` 返回 `None` |
| 会话无 hibernation | 能力位为假，运行时返回 `NotSupported` |
| 通知守护进程缺失 | `Notify` 调用本身报错，能力位仍上报存在 |

关键原则：**降级必须可观测**。静默丢弃（例如把图标写进日志后扔掉、或让操作中心因 schema 错误丢掉整条通知）会让调用方以为成功而用户什么都没看到——那是 bug，不是降级。
