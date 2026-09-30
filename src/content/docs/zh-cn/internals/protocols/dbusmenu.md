---
title: DBusMenu
description: GNOME/KDE 托盘菜单的拉取式协议，以及复选框状态的维护责任。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 模型：shell 拉取，不推送

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

## 坑：`toggle-state` 的维护责任在 item

shell **不**维护复选框状态。用户点击后：

1. shell 发 `Event(id, "clicked", ...)`；
2. item 侧切换自己的状态；
3. item 必须发出 `ItemsPropertiesUpdated` 信号，把新的 `toggle-state` 告诉 shell；
4. shell 才重绘打勾。

漏掉第 3 步的表现为：点一次有反应，再点又回到旧状态——因为 shell 从来没被告知状态变了。

UDA 因此要求复选框回调返回新状态，并在回调返回后立即广播属性更新。这也是回调必须在工作线程上快速完成的原因：广播是同步的 D-Bus 调用。

## 坑：` AboutToShow ` 是性能优化，不是必须

shell 在展开子菜单前会发 `AboutToShow(id)`，让 item 有机会**懒加载**子项。若返回 `true`，shell 认为布局已变，会重新 `GetLayout`。

UDA 采用全量预建（菜单行一开始就全部提交），因此忽略该提示——代价是菜单大时首次展开稍慢，收益是逻辑简单且不存在"边展开边改布局"的竞态。

## 与 Windows 的对照

Windows 侧没有对应协议：`Shell_NotifyIconW` 持有一个本地 `HMENU`，托盘工作线程直接 `TrackPopupMenuEx`，不需要经过 shell 拉取。两种机制的差别被 `TrayManager` trait 吸收，调用方看到的是同一套 `TrayMenu` 模型。
