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

### 平台实现

| 平台 | 后端 |
|------|------|
| Linux（现代） | XDG Desktop Portal `org.freedesktop.portal.Settings` → `Read("org.freedesktop.appearance", "color-scheme")` |
| Linux（GNOME） | `gsettings get org.gnome.desktop.interface color-scheme` |
| Linux（KDE） | `kreadconfig6` / `kreadconfig5` 读取 `Colors:Scheme` |
| Linux（XFCE） | `xfconf-query -c xsettings -p /Net/ThemeName` |
| Windows | 注册表 `HKCU\...\Themes\Personalize\AppsUseLightTheme` |

遵循 `AGENTS.md` Principle 2 的级联链：Portal → 原生 DE → CLI 工具 → 类型化错误。

## 读取强调色

```python
with Uda() as uda:
    accent = uda.accent_color      # (r, g, b, a) 或 None

    if accent:
        r, g, b, a = accent
        print(f"强调色: #{r:02X}{g:02X}{b:02X}")
```

### 平台可用性

| 平台 | 状态 | 来源 |
|------|------|------|
| Windows | ✅ | 注册表 `HKCU\...\DWM\AccentColor`，解包为 RGBA |
| GNOME | ✅ | `gsettings get org.gnome.desktop.interface accent-color` |
| KDE / XFCE | ⚠️ | 尽力而为，缺失时返回 `None` |
| Wayland 平铺 WM | ❌ | 无系统级强调色概念 |

**`None` 是正常返回值**，不是错误。请在 UI 里准备一个回退色板，而不是把 `None` 当异常处理。

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

深浅色检测当前为**一次性快照**，尚未提供变更监听信号。需要跟随系统切换的应用请轮询（建议间隔 ≥ 1 秒），或在平台侧订阅原生信号后由 UDA 后续版本暴露。
