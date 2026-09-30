---
title: StatusNotifierItem（SNI）
description: Linux 托盘在 Wayland 上唯一可用的机制，以及它与旧 XEmbed 的区别。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 为什么是 SNI

XEmbed 系统托盘依赖一个全局拥有的 X 窗口。Wayland 没有这个前提，因此托盘在 Wayland 上**只能**走 D-Bus 的 StatusNotifierItem。UDA 的 Linux 托盘 therefore 直接以 SNI 为实现，无需为 X11/Wayland 分叉。

## 三个名字

```text
Bus name   : org.kde.StatusNotifierItem-<pid>-<counter>   # 每进程唯一，故带 PID
Object path: /StatusNotifierItem
Watcher    : org.kde.StatusNotifierWatcher : /StatusNotifierWatcher
```

注册动作是 `RegisterStatusNotifierItem(service)`，参数传 **bus name**（不是 object path）——这是最常见的实现错误。

注册失败即说明 watcher 不存在，此时降级到 AppIndicator（Tier 2），仍不可用则返回类型化错误。

## 暴露的接口

### 方法（shell → item）

| 方法 | 语义 |
|------|------|
| `Activate(x, y)` | 主激活，即左键 |
| `SecondaryActivate(x, y)` | 次激活，多数 shell 上是中键 |
| `ContextMenu(x, y)` | shell 请求在 (x, y) 弹出菜单 |
| `Scroll(delta, orientation)` | 滚轮，方向为 `up`/`down`/`left`/`right` |
| `ProvideXdgActivationToken(token)` | Wayland 激活令牌交接 |

### 信号（item → shell）

`NewTitle`、`NewIcon`、`NewAttentionIcon`、`NewStatus`、`XAyatanaLabelChanged`、`XAyatanaLabelGuideChanged`。

**坑**：改动状态后必须主动发对应信号。只改属性而不发 `NewIcon`，shell 不会重读——这是"改了图标但托盘不刷新"的标准原因。

### 属性

`Category`（`ApplicationStatus` / `SystemServices`）、`Id`、`Title`、`Status`、`WindowId`、`IconName`、`IconPixmap`、`ToolTip` 等。

`WindowId` 为 0 表示 item 没有 X 窗口——Wayland 下的正常状态。

## 坑：GNOME 需要额外组件

GNOME Shell 默认不提供 StatusNotifierWatcher。需要一个 AppIndicator 扩展（`gnome-shell-extension-appindicator`）或 KDE 的 xembed 回退，否则注册失败、托盘不显示。

这不是 UDA 能绕过的：**宿主没提供托盘区域，任何实现都无解**。`capabilities()` 在这种情况下上报"托盘后端不存在"。

## 与菜单的关系

SNI 只定义"图标与激活事件"，菜单通过单独的 `com.canonical.dbusmenu` 协议从 shell 拉取——见[DBusMenu](/zh-cn/internals/protocols/dbusmenu/)。
