---
title: 系统外观
description: 检测深浅色模式与读取系统强调色。
---

## 读取深浅色

```python
from uda import Uda, Theme

with Uda() as uda:
    theme = uda.theme        # 'dark' | 'light' | 'unknown'

    if theme == Theme.DARK:
        print("深色模式")
    elif theme == Theme.LIGHT:
        print("浅色模式")
    else:
        print("无法判定 —— 交给用户选择")
```

Node.js 侧：

```javascript
const { Uda } = require('./uda');
console.log(new Uda().theme);
```

Rust 侧：

```rust
let mode = uda_platform_linux::LinuxAppearanceManager::new().detect_theme()?;
```

`'unknown'` 是合法答案：没有配色方案概念的合成器（裸窗口管理器、部分 Wayland 平铺器）确实无法判定，猜测比不猜更糟。请按「无法判定」处理，让用户自行选择。

### 平台后端

| 平台 | 后端 |
|------|------|
| Linux（现代） | XDG Desktop Portal `org.freedesktop.portal.Settings` → `Read("org.freedesktop.appearance", "color-scheme")` |
| Linux（GNOME） | `gsettings get org.gnome.desktop.interface color-scheme` |
| Linux（KDE） | `kreadconfig6` / `kreadconfig5` 读取 `Colors:Scheme` |
| Linux（XFCE） | `xfconf-query -c xsettings -p /Net/ThemeName` |
| Windows | 注册表 `HKCU\...\Themes\Personalize\AppsUseLightTheme` |

遵循 `AGENTS.md` Principle 2 的级联链：Portal → 原生桌面环境 IPC → CLI 工具 → 类型化错误。

## 读取强调色

```python
with Uda() as uda:
    accent = uda.accent_color      # (r, g, b, a) 或 None

    if accent:
        r, g, b, a = accent
        print(f"强调色: #{r:02X}{g:02X}{b:02X}")
```

### 平台支持情况

| 平台 | 状态 | 来源 |
|------|------|------|
| Windows | ✅ | 注册表 `HKCU\...\DWM\AccentColor`，解包为 RGBA |
| GNOME | ✅ | `gsettings get org.gnome.desktop.interface accent-color` |
| KDE / XFCE | ⚠️ | 尽力而为，缺失时返回 `None` |
| Wayland 平铺 WM | ❌ | 无系统级强调色概念 |

:::note[`None` 属于正常返回值]
平台无系统级强调色时返回 `None`，这不是错误。请在 UI 中提供回退色板，不要将其作为异常处理。
:::

## 跟随系统切换

UDA 不提供变更监听，读取为一次性快照。需要跟随用户选择时，请以合理间隔轮询 `detect_theme`：

```python
import time
from uda import Uda

with Uda() as uda:
    last = None
    while True:
        theme = uda.theme
        if theme != last:
            apply_theme(theme)
            last = theme
        time.sleep(1.0)
```

若所用 UI 框架本身能处理主题变更，优先使用它的信号——框架的事件既更及时也比轮询更准确。

## 各桌面行为

| 桌面 | 取色来源 | 说明 |
|------|----------|------|
| GNOME 42+ | `org.freedesktop.portal.Settings` | 现代标准答案 |
| KDE Plasma 5 / 6 | `org.freedesktop.portal.Settings` → `kreadconfig6` / `kreadconfig5` 读 `Colors:Scheme` | 完整支持 |
| XFCE | `xfconf-query -c xsettings -p /Net/ThemeName` | 无系统级配色方案，常返回 `unknown` |
| Hyprland / Sway | GSettings | 平铺合成器很少发布配色方案 |
| Windows 10 / 11 | 注册表 `AppsUseLightTheme` | 完整支持 |

强调色是与配色方案独立的另一项查询，支持情况不同：

| 平台 | 强调色 |
|------|--------|
| Windows | ✅ 注册表 `HKCU\...\DWM\AccentColor`，解包为 RGBA |
| GNOME | ✅ `gsettings get org.gnome.desktop.interface accent-color` |
| KDE / XFCE | 尽力而为，缺失时返回 `None` |
| Wayland 平铺器 | ❌ 无系统级强调色概念 |

:::note[能力位说明]
`Capability::DETECT_THEME` 表示是否有任何来源作出了应答。`Capability::FOLLOW_SYSTEM_THEME` 虽在标志集中定义，但**目前没有任何后端设置它**，因为尚没有后端发布变更事件；不要用它作为「跟随系统」开关的判据。
:::

## 接到应用主题上

```python
from uda import Uda, Theme

FALLBACK_ACCENT = (0x33, 0x99, 0xFF, 0xFF)

with Uda() as uda:
    dark = uda.theme == Theme.DARK
    accent = uda.accent_color or FALLBACK_ACCENT

apply_theme(dark=dark, accent=accent)
```

## 当前限制

:::note[主题变更为一次性快照]
深浅色检测返回**一次性快照**，尚未提供变更监听。需要跟随系统切换的应用请轮询（建议间隔 ≥ 1 秒）；原生信号的订阅接口将在后续版本中提供。
:::

## 相关文档

- [能力与降级](/guides/capability-and-fallback/)——能力查询与四级降级链
- [平台支持矩阵](/reference/platform-support/)——各桌面的取色来源
