---
title: StatusNotifierItem（SNI）
description: Linux 托盘在 Wayland 上唯一可用的机制，以及它与旧 XEmbed 的区别。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 采用 SNI 的原因

XEmbed 系统托盘依赖一个全局拥有的 X 窗口，Wayland 不具备该前提。因此托盘在 Wayland 上只能通过 D-Bus 的 StatusNotifierItem 实现。UDA 的 Linux 托盘直接以 SNI 为实现，无需在 X11 与 Wayland 之间分叉。

## 注册顺序

watcher 必须先于 item 存在，否则 shell 永远不会注意到它：

1. 连接会话总线，并拥有一个唯一的公开名称（`org.kde.StatusNotifierItem-<app>-<pid>-<n>`）。
2. 在 `/StatusNotifierItem` 导出 item 对象，并在 `/MenuBar` 导出菜单对象。
3. 在 `org.kde.StatusNotifierWatcher`（回退到 `org.freedesktop.StatusNotifierWatcher`）上调用 `RegisterStatusNotifierItem`。

watcher 缺失**不是致命错误**——item 仍然保持导出状态，稍后启动的 watcher 可以通过 `NameOwnerChanged` 发现它。

## 注册顺序

watcher 必须先于 item 存在，否则 shell 永远不会注意到它：

1. 连接会话总线，并拥有一个唯一的公开名称（`org.kde.StatusNotifierItem-<app>-<pid>-<n>`）。
2. 在 `/StatusNotifierItem` 导出 item 对象，并在 `/MenuBar` 导出菜单对象。
3. 在 `org.kde.StatusNotifierWatcher`（回退到 `org.freedesktop.StatusNotifierWatcher`）上调用 `RegisterStatusNotifierItem`。

watcher 缺失**不是致命错误**——item 仍然保持导出状态，稍后启动的 watcher 可以通过 `NameOwnerChanged` 发现它。

## 三个名字

```text
Bus name   : org.kde.StatusNotifierItem-<pid>-<counter>   # 每进程唯一，故带 PID
Object path: /StatusNotifierItem
Watcher    : org.kde.StatusNotifierWatcher : /StatusNotifierWatcher
```

注册通过 `RegisterStatusNotifierItem(service)` 完成，参数为 **bus name**（不是 object path）。传错参数是常见的实现错误。

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

:::caution[状态变更需主动发信号]
修改属性后必须发送对应的 `New*` 信号。只改属性而不发 `NewIcon`，shell 不会重新读取，表现为图标已更改但托盘未刷新。
:::

### 属性

`Category`（`ApplicationStatus` / `SystemServices`）、`Id`、`Title`、`Status`、`WindowId`、`IconName`、`IconPixmap`、`ToolTip` 等。

`WindowId` 为 0 表示 item 没有 X 窗口——Wayland 下的正常状态。

## 图标字节序

`IconPixmap` 的类型是 `a(iiay)`，文档描述为「ARGB32 rows」，实际含义是**字节序 B, G, R, A**，而不是 A, R, G, B。按 A, R, G, B 写入会互换红蓝通道，红色图标会以蓝色呈现。

行序同样是**自下而上**的：源第 0 行落在目标缓冲区的末尾，`stride` 填充字节跳过而不复制。

`Path` 值被解释为 **freedesktop 图标主题名**，而不是文件系统路径。这正是 Python 与 Node.js SDK 解码 PNG 并提交像素、而不是直接传路径的原因。

## 双击

SNI 没有双击信号。UDA 由 500 毫秒窗口内的两次 `Activate` 合成双击——与 Windows 的 `GetDoubleClickTime()` 使用同一窗口——并且**有意不上报** `TRAY_DOUBLE_CLICK` 能力位，因为声明一个协议无法交付的能力会破坏能力如实上报的约定。

该窗口在每次点击时重新计时，因此三击会被读作「一次单击 + 一次双击」，而不是一次长双击。

## GNOME 需要额外组件

:::caution[GNOME 默认缺少 StatusNotifierWatcher]
GNOME Shell 默认不提供 `StatusNotifierWatcher`，需安装 AppIndicator 扩展（`gnome-shell-extension-appindicator`）或依赖 KDE 的 xembed 回退，否则注册失败、托盘不显示。
:::

宿主未提供托盘区域时，任何实现都无法显示图标。`capabilities()` 在这种情况下上报托盘后端不存在。

## 与菜单的关系

SNI 只定义"图标与激活事件"，菜单通过单独的 `com.canonical.dbusmenu` 协议从 shell 拉取——见[DBusMenu](/internals/protocols/dbusmenu/)。
