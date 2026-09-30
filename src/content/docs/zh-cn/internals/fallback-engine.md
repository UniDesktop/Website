---
title: 降级引擎
description: 四级降级链的探测手段、判定条件与设计理由。
---

## 四级链

```text
Tier 1  XDG Desktop Portal
Tier 2  原生 DE D-Bus / IPC
Tier 3  CLI 工具（PATH 探测）
Tier 4  UdaError::Unsupported（类型化错误）
```

三级都失败时**不** panic、不返回裸 `io::Error`，而是返回带诊断信息的 `UdaError::Unsupported`。

## Tier 1：XDG Desktop Portal

**探测**：会话总线上是否存在 `org.freedesktop.portal.Desktop`，且目标接口已导出。

**适用**：外观（`org.freedesktop.portal.Settings`）、壁纸（`org.freedesktop.portal.Wallpaper`）、文件选择、屏幕捕获、全局快捷键。

**为什么优先**：Portal 是 freedesktop 的标准答案，由桌面环境自己实现，行为一致且已处理授权。

**坑**：并非所有桌面都实现了全部接口。GNOME 42+ 完整，KDE 部分，Wayland 平铺 WM 通常没有。因此必须探测而不是假设。

## Tier 2：原生 DE D-Bus / IPC

**探测**：读 `$XDG_CURRENT_DESKTOP`，映射到具体的 D-Bus 服务；或检查 Hyprland/Sway 的 socket 路径（`$HYPRLAND_INSTANCE_SIGNATURE` / `$SWAYSOCK`）。

**适用**：

| 桌面 | 服务 / 手段 |
|------|-------------|
| GNOME | `org.gnome.desktop.background`、`org.gnome.desktop.interface` |
| KDE | `org.kde.plasmashell` → `/PlasmaShell` → `evaluateScript` |
| Hyprland | `$HYPRLAND_INSTANCE_SIGNATURE` socket → `hyprpaper` / `swww` |
| Sway | `$SWAYSOCK` → IPC |
| 通用（会话） | `org.freedesktop.ScreenSaver`、`org.freedesktop.Notifications` |

**为什么需要**：Portal 未覆盖或未实现时的原生路径，通常功能更全（例如 GNOME 的深浅色壁纸配对）。

## Tier 3：CLI 工具

**探测**：按固定顺序在 `PATH` 上查找可执行文件。

| 功能 | 工具顺序 |
|------|----------|
| 壁纸（X11） | `feh` → `nitrogen` |
| 壁纸（Wayland） | `swww` → `hyprpaper` |
| 主题（XFCE） | `xfconf-query` |
| 注销（通用） | `loginctl` |

**为什么最后**：CLI 工具是进程，启动开销大、错误处理粗糙（只能看退出码与 stderr）、且不一定安装。但是它在没有任何 IPC 通道的裸 X11 环境里是唯一选择。

**实现要点**：把 stdout/stderr/退出码都收集起来，失败时拼进错误消息。一个只说 "command failed" 的错误对调用方毫无价值。

## Tier 4：类型化错误

```rust
UdaError::Unsupported(format!(
    "no wallpaper backend: no Portal, no GNOME/KDE/IPC, and none of [feh, nitrogen] on PATH"
))
```

错误消息列出**已经试过什么**，让调用方能判断是该装工具还是该换环境。

## 为什么"优雅降级"优于"返回错误"

同一个 API 在不同环境下应有不同表现：

| 场景 | 降级行为 |
|------|----------|
| Windows 未打包 + 带 actions | 通知显示，按钮不渲染 |
| Windows 无 app_icon | 用文本模板，无图片 |
| Linux 无系统强调色 | 返回 `None` |
| 关闭了休眠的机器 | 能力位为假，运行时 `NotSupported` |

对比一下两种失败叙事：

- 「`capabilities()` 说支持，调用却失败」→ 调用方无法预先分流；
- 「`capabilities()` 如实上报，失败时给出可操作原因」→ 调用方能画菜单、给提示。

## 降级的红线：必须可观测

**静默丢弃是 bug，不是降级。**

典型反例：Windows 上把图标写进日志后扔掉，而通知照常"成功"——调用方以为显示了图片，用户什么都没看到。这正是 v0.2.0 修掉的问题：现在 `app_icon` 要么真的进入 `<image>` 节点，要么明确降级到无图模板，两者都可从行为上观测。

同理，若生成的文档被平台因格式错误整体丢弃（操作中心静默失败、`Show` 仍返回成功），那也不是降级——那是必须修的实现缺陷。

## Windows 的单级结构

Windows 没有这条四级链：Win32/WinRT API 在受支持版本上总可用，所以没有 Portal、没有桌面 IPC、也没有 CLI 回退。

但 **Tier 4 仍然适用**。例如 Windows 7 上没有深色模式注册表项，代码返回 `UdaError::NotSupported` 而不是假装成功。 tier 的数量取决于平台碎片化程度，而"最终必须给类型化错误"这条不变。
