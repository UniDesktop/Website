---
title: 故障排查
description: 症状 → 原因 → 处置对照表。
---

## 找不到动态库

**症状**：`UdaError: 找不到 UDA 动态库`

**原因**：尚未构建 `uda-ffi`，或 target 目录被重定向后 SDK 未找到。

**处置**：

```bash
cargo build -p uda-ffi
# 仍失败则显式指定
UDA_LIBRARY=$(find . -name 'libuda_ffi.so' | head -1) python3 examples/python/01_appearance.py
```

SDK 的解析顺序：显式 `library_path` → `UDA_LIBRARY` 环境变量 → `cargo metadata` 报告的 target 目录（含 debug/release 与跨编译目标子目录）。

## 壁纸：`Feature not supported: Neither feh nor nitrogen`

**症状**：`UdaError::Unsupported`，消息列出全部 CLI 工具名。

**原因**：Tier 1（Portal）、Tier 2（GNOME/KDE/Hyprland/Sway IPC）都不可用，Tier 3 探测 `PATH` 也没找到任何工具。

**处置**：安装任一工具，或换到有 Portal 的桌面环境：

```bash
sudo apt install feh        # Debian/Ubuntu
sudo apt install nitrogen   # 备选
```

查询当前环境能力：

```rust
let caps = manager.capabilities()?;
caps.contains(Capability::SET_WALLPAPER)
```

## 通知：`ServiceUnknown: org.freedesktop.Notifications`

**症状**：`UdaError`，D-Bus 错误名 `org.freedesktop.DBus.Error.ServiceUnknown`。

**原因**：会话里没有通知守护进程（极简 WM、容器、纯 SSH）。

**处置**：安装并启动一个守护进程：

```bash
sudo apt install notification-daemon   # 或 dunst / mako / swaync
```

能力位 `SEND_NOTIFICATION` 只表示"代码路径存在"，不预判守护进程是否在跑——这是运行时错误。

## 托盘图标不显示

**症状**：代码返回成功，但托盘区没有图标。

**原因与处置**：

| 环境 | 原因 | 处置 |
|------|------|------|
| GNOME | 无 `StatusNotifierItem` 主机（需要 AppIndicator 扩展或 KDE 的 `xembed` 回退） | 安装 `gnome-shell-extension-appindicator` |
| 通用 X11 | 无 StatusNotifierWatcher | 启动 `snixembed` 或类似宿主 |
| Windows | 通知区域被组策略/用户隐藏 | 任务栏设置 → 通知区域 → 始终显示 |

:::tip[验证是否成功]
Linux 侧可用 `busctl --user list | grep StatusNotifier` 检查是否注册成功；Windows 侧可用 `Shell_NotifyIconW` 的返回值确认。
:::

## 托盘回调不触发 / 点击无反应

**原因**：Windows 侧回调在**工作线程**上执行，若在回调里做阻塞操作会卡住消息泵；Linux 侧同理。

**处置**：回调里只做最少工作，把实际逻辑 post 到主线程。详见[系统托盘](/zh-cn/guides/tray/#线程模型)。

## 图标颜色不对（历史缺陷，已修）

**症状**：托盘图标的红蓝通道互换（蓝色显示为红色）。

**原因**：早期 `IconPixmap` 实现按 A,R,G,B 而非规范要求的 B,G,R,A 排列字节。已在 v0.2.0 修复，见 `docs/internals/tray_specs.md`。

## 强调色返回 None

**原因**：KDE、XFCE 与 Wayland 平铺 WM 没有系统级强调色概念。

**处置**：这是正常返回值。准备回退色板：

```python
accent = uda.accent_color or (0x33, 0x99, 0xFF, 0xFF)
```

## 会话动作返回 NotSupported

**原因**：polkit 未授权，或系统关闭了对应功能（例如无 swap 时无法休眠）。

**处置**：先查能力位；失败时读取错误消息中的 D-Bus 错误名（`AccessDenied` / `NotAuthorized` / `InteractiveAuthorizationRequired`），据此提示用户授权。详见[会话与电源生命周期](/zh-cn/guides/session/#常见失败)。

## 媒体控制：now_playing 一直为 None

**原因**：没有播放器在运行，或播放器未实现 MPRIS v2（部分浏览器、旧版客户端）。

**处置**：用已支持 MPRIS 的播放器验证（`mpv`、`vlc`、Rhythmbox、大多数现代播放器）：

```bash
# 确认播放器已导出 MPRIS 接口
busctl --user list | grep mpris
```

## 测试相关

```bash
cargo test --workspace                       # 全部单元测试
./scripts/test-linux-mock.sh                 # D-Bus mock 夹具测试
cargo check -p uda-platform-windows \
  --target x86_64-pc-windows-gnu --all-targets   # 交叉编译校验
```

D-Bus 相关测试运行在 `dbus-run-session` + `python3-dbusmock` 夹具中，不需要真实桌面环境。
