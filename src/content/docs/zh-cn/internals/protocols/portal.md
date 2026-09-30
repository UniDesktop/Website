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
Bus      : Session Bus
Dest     : org.freedesktop.portal.Desktop
Path     : /org/freedesktop/desktop
Interfaces: org.freedesktop.portal.<Feature>
```

UDA 目前用到的接口：

| 接口 | 用途 |
|------|------|
| `org.freedesktop.portal.Settings` | 深浅色（`Read("org.freedesktop.appearance", "color-scheme")`）、强调色 |
| `org.freedesktop.portal.Wallpaper` | 壁纸设置 |

## 深浅色的取值

```text
Read("org.freedesktop.appearance", "color-scheme")
  0 = Default / Unknown
  1 = Prefer Dark
  2 = Prefer Light
```

变更通过 `SettingChanged(namespace, key, value)` 信号通知。UDA 当前只读快照，尚未暴露监听。

## 探测：存在 ≠ 可用

Portal 只在**至少一个后端接口已导出**时才算可用。正确做法是尝试绑定目标接口，而不是只查 `org.freedesktop.portal.Desktop` 是否在总线上——很多桌面导出了服务名却没实现 Settings。

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

因此 Portal 优先并不意味着"Portal 总是答案"。这正是 AGENTS.md Principle 2 要求一条完整降级链的原因：任何单层机制在碎片化的 Linux 桌面上都不足以覆盖。

## 授权

Portal 的授权由实现方处理（通常弹出系统对话框）。被用户拒绝时调用返回错误，UDA 映射为 `UdaError::NotSupported` 并带上原始错误名——调用方据此提示用户，而不是当成代码 bug。
