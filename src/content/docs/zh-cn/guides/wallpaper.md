---
title: 壁纸管理
description: 读取与设置桌面壁纸，四种填充模式与多显示器语义。
---

## 读取当前壁纸

```python
from uda import Uda

with Uda() as uda:
    path = uda.wallpaper          # 属性式读取，可能为 None

    if path:
        print("当前壁纸:", path)
    else:
        print("未设置，或平台不支持读取")
```

## 设置壁纸

```python
from uda import Uda, FillMode

with Uda() as uda:
    uda.set_wallpaper("~/Pictures/mountains.jpg", FillMode.FILL)
    # 或者属性式赋值（默认 FILL）
    uda.wallpaper = "/usr/share/backgrounds/gnome/adwaita-l.jpg"
```

### 四种填充模式

| 模式 | 语义 |
|------|------|
| `FillMode.CROP` | 保持比例裁剪填满屏幕，超出部分被裁掉 |
| `FillMode.FILL` | 拉伸填满屏幕，不保持比例 |
| `FillMode.FIT` | 完整放入屏幕，保持比例，可能留黑边 |
| `FillMode.STRETCH` | 同 FILL（保留用于与部分后端名称对齐） |

## 多显示器语义

C-ABI 层的 `uda_set_wallpaper` 作用于**所有显示器**。需要按显示器区分时：

- **GNOME**：分别写 `picture-uri` 与 `picture-uri-dark`；
- **KDE**：通过 `plasmashell` 脚本为每个屏幕单独设置；
- **X11 CLI 回退**：`feh --bg-fill` 会应用到所有屏幕。

UDA 的 Rust trait 接受 `WallpaperOptions`，其中可指定显示器索引；经 C-ABI 调用时该字段为「全部」。

## 深浅色配对

GNOME 支持为深浅色分别指定壁纸。UDA 在 GNOME 后端会同时写 `picture-uri`（浅色）与 `picture-uri-dark`（深色），让壁纸随系统外观切换。

## 平台降级链

```text
XDG Portal (org.freedesktop.portal.Wallpaper)
   ↓ 不可用
原生 DE IPC（GNOME GSettings / KDE plasmashell / Hyprland IPC / Sway IPC）
   ↓ 不可用
CLI 工具（swww / hyprpaper / feh / nitrogen，按 PATH 探测）
   ↓ 全部不可用
UdaError::Unsupported("...")
```

Windows 侧只有一级：`SystemParametersInfoW(SPI_SETDESKWALLPAPER)`，并同步写入注册表样式键以供后续读取。

## 路径要求

传入的应为**可读的图片文件路径**。UDA 不负责把相对路径解析到某个基准目录——请自行 `os.path.abspath()`，否则进程工作目录的变化会让同一份代码在不同环境下行为不同。
