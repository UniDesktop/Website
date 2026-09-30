---
title: XDG Desktop Portal
description: Linux 的标准答案：接口布局、探测方式与覆盖缺口。
---

> 本文提炼自各 `docs/internals/*_specs.md`，完整协议细节以仓库内文件为准。

## 定位

XDG Desktop Portal 是 freedesktop 的标准沙箱化接口层。桌面环境自己实现它，应用通过 D-Bus 调用，无需知道背后是 GNOME 还是 KDE。

在 UDA 的降级链里它是 **Tier 1**：只要存在且目标接口已导出，就用它。

## 固定端点

```text
Bus       : Session Bus
Dest      : org.freedesktop.portal.Desktop
Path      : /org/freedesktop/portal/desktop
Interfaces: org.freedesktop.portal.<Feature>
```

UDA 目前用到的接口：

| 接口 | 用途 |
|------|------|
| `org.freedesktop.portal.Settings` | 深浅色（`Read("org.freedesktop.appearance", "color-scheme")`）、强调色 |

这是 UDA 目前唯一调用的 Portal 接口。壁纸与防休眠虽然也有对应的 Portal 接口（`org.freedesktop.portal.Wallpaper` / `org.freedesktop.portal.Inhibit`），但后端并未使用它们：壁纸直接走 GNOME `gsettings`、KDE `plasmashell` 与 CLI 工具链，防休眠调用会话总线上的 `org.freedesktop.ScreenSaver.Inhibit`。各桌面的具体映射见[仓库内的 wallpaper_specs.md](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/wallpaper_specs.md)。

## 深浅色的取值

```text
Read("org.freedesktop.appearance", "color-scheme")
  0 = Default / Unknown
  1 = Prefer Dark
  2 = Prefer Light
```

变更通过 `SettingChanged(namespace, key, value)` 信号通知。UDA 当前只读快照，尚未暴露监听。

## 探测：服务名存在不等于接口可用

Portal 仅在**至少一个后端接口已导出**时视为可用。正确做法是尝试构造目标接口的 proxy，而不是只检查 `org.freedesktop.portal.Desktop` 是否在总线上：部分桌面导出了服务名，但未实现 Settings 接口。

```rust
// 直接构造 proxy；失败即视为该接口不可用，落到 Tier 2
let proxy = match Proxy::new(&connection, ".../Settings", "...Desktop", "...Settings").await {
    Ok(p) => p,
    Err(_) => return self.try_tier_2(...),
};
```

## 覆盖缺口

| 桌面 | Portal 实现程度 |
|------|-----------------|
| GNOME 42+ | 完整（Settings 与 Wallpaper 均有） |
| KDE Plasma | 部分（有 Settings，其他视版本） |
| XFCE | 部分 |
| Hyprland / Sway | 通常**没有** → 直接走 Tier 2 |

:::note[Portal 优先不等于 Portal 总能满足]
单层机制无法覆盖碎片化的 Linux 桌面。AGENTS.md Principle 2 因此要求完整的四级降级链。
:::

## 授权

Portal 的授权由实现方处理（通常弹出系统对话框）。用户拒绝授权时调用返回错误，UDA 将其映射为 `UdaError::NotSupported` 并附带原始错误名，调用方可据此提示用户授权，而不是作为代码缺陷处理。
