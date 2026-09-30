---
title: DBusMenu
description: GNOME/KDE 托盘菜单的拉取式协议，以及复选框状态的维护责任。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 布局节点

每个节点是四字段元组，线上签名为 `(ia{sv}ia{sv}v)`：

| 字段 | 类型 | 内容 |
|------|------|------|
| 0 | `i` | 行 id |
| 1 | `a{sv}` | 属性表 |
| 2 | `ia{sv}` | 子节点（各自的 id + 属性，包装在 variant 中） |
| 3 | `v` | 图标载荷——UDA 中始终为空结构 |

根节点携带 id `0` 且无属性。id 从 `1` 开始，因为 `0` 是协议保留的根哨兵值。

## 属性表

| 键 | 值 | 说明 |
|----|----|------|
| `type` | `"standard"` / `"separator"` | 分隔线无标签 |
| `label` | string | 分隔线不设置 |
| `enabled` | bool | |
| `visible` | bool | 始终为 `true`；隐藏通过移除该行实现 |
| `toggle-type` | `"checkmark"` | 仅复选框行存在——这是 shell 画出真实复选框的依据 |
| `toggle-state` | `int` | `0` / `1`，复选框的值 |
| `children-display` | `"submenu"` | 该行有子项时存在 |

## id 分配

id 来自整棵树（含嵌套子菜单）共用的单一单调序列。子菜单**先**分配自己的 id，再分配其子项，因此每个子菜单占据一段连续的 id 区间。

该序列饱和后不会回绕：回绕的计数器会与活跃行冲突，shell 将访问到错误的行。

## 方法

shell 拉取，不推送：

```text
Service : 与 StatusNotifierItem 同一个 bus name
Path    : 由 SNI 的 Menu 属性（DBusMenu 对象路径）指定，UDA 导出为 /MenuBar
Interface: com.canonical.dbusmenu
```

| 方法 | 行为 |
|------|------|
| `GetLayout(parentId, recursionDepth, propertyNames)` | 返回 `(revision, rootNode)`。深度 `0` 表示「不限」。未挂接菜单时返回空根而不是错误，shell 据此不渲染任何内容 |
| `GetGroupProperties(ids, propertyNames)` | 返回所请求 id 的 `(id, props)` 对，按键名过滤。空名称列表表示「全部」 |
| `GetProperty(id, name)` | 读取单个属性。未知 id、未知名称或没有菜单，都是 `InvalidArgs` 错误 |
| `Event(id, eventType, data, timestamp)` | shell 上报某项被激活 |
| `AboutToShow(id)` | shell 预告将要展开某子菜单 |

SNI 暴露图标与激活事件，但**菜单**由独立的 `com.canonical.dbusmenu` 协议承载，且方向是 shell 主动拉取：

```text
Service : 与 StatusNotifierItem 同一个 bus name
Path    : 由 SNI 的 Menu 属性（DBusMenu 对象路径）指定，通常为 /MenuBar
Interface: com.canonical.dbusmenu
```

核心方法：

| 方法 | 作用 |
|------|------|
| `GetLayout(parentId, recursionDepth, propertyNames)` | 取（子）菜单布局 |
| `GetGroupProperties(ids, propertyNames)` | 按 id 批量读属性 |
| `Event(id, eventType, data, timestamp)` | shell 上报某项被激活 |
| `AboutToShow(id)` | shell 预告将要展开某子菜单 |

## 布局是一条树，用 id 定位

`GetLayout` 返回嵌套结构，每个节点带一个 `id`（**非 0**）。UDA 的菜单行在创建时分配 id，随布局一起交给 shell。

| 字段 | 说明 |
|------|------|
| `id` | 非 0 整数；0 保留给根节点 |
| `type` | `standard` / `separator` |
| `label` | 显示文本 |
| `enabled` | 是否可点 |
| `visible` | 是否显示 |
| `toggle-type` | `checkmark` / `radio` / `none` |
| `toggle-state` | 复选框当前状态 |
| `children-display` | 子菜单展示方式 |
| `icon-data` | PNG 字节（通常不用） |

## `toggle-state` 由 item 侧维护

shell **不**维护复选框状态。用户点击后：

1. shell 发 `Event(id, "clicked", ...)`；
2. item 侧切换自己的状态；
3. item 必须发出 `ItemsPropertiesUpdated` 信号，把新的 `toggle-state` 告诉 shell；
4. shell 才重绘打勾。

漏掉第 3 步的表现：点击一次有响应，再次点击时状态回到旧值，原因是 shell 从未收到状态变更通知。

UDA 因此要求复选框回调返回新状态，并在回调返回后立即广播属性更新。这也是回调必须在工作线程上快速完成的原因：广播是同步的 D-Bus 调用。

## `AboutToShow` 是可选优化

shell 在展开子菜单前会发 `AboutToShow(id)`，让 item 有机会**懒加载**子项。若返回 `true`，shell 认为布局已变，会重新 `GetLayout`。

UDA 采用全量预建（菜单行在创建时一次性全部提交），因此忽略该提示。代价是菜单项较多时首次展开略慢，收益是逻辑简单，且不存在「展开期间修改布局」的竞态。

## 与 Windows 的对照

Windows 侧没有对应协议：`Shell_NotifyIconW` 持有一个本地 `HMENU`，托盘工作线程直接调用 `TrackPopupMenuEx`，不经过 shell 拉取。两种机制的差异由 `TrayManager` trait 吸收，调用方使用的是同一套 `TrayMenu` 模型。

## 信号

`ItemsPropertiesUpdated` 与 `LayoutUpdated` 由 item 侧发出。后者携带一个 `revision` 号，shell 据此判断是否需要重新 `GetLayout`；`GetLayout` 的返回值中同样包含该 revision。

## 相关文档

- [StatusNotifierItem（SNI）](/internals/protocols/statusnotifieritem/)——配套的图标与激活协议
- [Shell_NotifyIconW](/internals/protocols/notifyicon/)——Windows 侧实现
- [系统托盘](/guides/tray/)——跨平台的上层 API
