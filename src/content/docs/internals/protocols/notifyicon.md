---
title: Shell_NotifyIconW
description: Windows 托盘的专用工作线程与消息泵模型，以及 v0.2.0 修复的两个缺陷。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 工作线程的作用

`Shell_NotifyIconW` 的 `NOTIFYICONDATAW` 含有一个 `hWnd`，shell 通过它投递回调消息（点击、菜单请求）。窗口归属于**创建它的线程**，因此消息循环必须运行在同一线程上。

若使用宿主主线程的窗口，UDA 将需要占用宿主的事件循环，违反 Non-blocking 约束。UDA 的做法是：

```text
宿主线程                     托盘工作线程
────────                    ──────────
TrayIcon::new()  ──spawn──▶  创建 message-only 窗口（HWND_MESSAGE 父）
  ...                        GetMessage 循环
host.set_tooltip()  ──post──▶ WM_USER 自定义消息 → 在该线程上 NIM_MODIFY
host.drop()         ──post──▶ 销毁窗口 → 退出循环
```

宿主的每次状态变更都以消息形式转发给工作线程，由工作线程在自己的锁保护下执行 Win32 调用。该设计满足「同一线程拥有窗口、调用不跨线程」的约束，同时不阻塞宿主。

## `NOTIFYICON_VERSION_4`

实现中统一使用版本 4。该版本由 shell 负责气泡超时与焦点管理，`NIN_SELECT` / `NINF_SELECT` 等事件才有定义。v0.2.0 之前按旧版布局解析 `NIN_BALLOON*` 的代码是缺陷来源之一。

## 回调消息 id

回调消息使用 `WM_APP` 而不是 `WM_USER`：这样整个 `WM_USER` 区段都留给宿主应用，以防将来共享同一个窗口。

## 版本 4 的回调布局

| 位置 | 内容 |
|------|------|
| `lParam` 低 16 位 | 鼠标消息（`WM_LBUTTONUP`、`WM_RBUTTONUP` 等） |
| `lParam` 高 16 位 | 图标 id，来自 `NOTIFYICONDATAW::uID` |
| `wParam` | 光标位置，低 16 位为 `x`、高 16 位为 `y`，各为有符号 16 位 |

`wParam` 在 64 位 Windows 上是 `isize`，因此必须**先**截断到低 16 位，再把高半部分读作 `y`。

## 菜单命令 id

`TrackPopupMenuEx` 配合 `TPM_RETURNCMD` 返回命令 id；用户取消菜单时返回 `0`。因此真实 id 从 `1` 开始。

`WM_COMMAND` 只携带 16 位 id，远不足以编码路径或树位置。UDA 维护一张扁平的 `id → 行` 表，并在每次菜单变更后重建，因此过期 id 永远不会触发旧回调。该表被视为一次性资源：每次变更都生成新表。

每行的回调在构建菜单时从宿主菜单中克隆出来，因此点击不会在 shell 菜单打开期间回访活跃的 `TrayMenu`。

分隔线同样占用一个 id 以保证位置对齐；子菜单行先占一个 id 以稳定其位置，其子项在之后分配。

## 禁用与勾选行

禁用行同时设置 `MF_DISABLED` 与 `MF_GRAYED`：前者阻止其触发，后者才是真正将其置灰的原因。勾选的复选框设置 `MF_CHECKED`。

## 图标构造

| 来源 | 采用路径 |
|------|----------|
| 文件路径 | `LoadImageW` 配合 `LR_LOADFROMFILE \| LR_DEFAULTSIZE`，可理解 `.ico`、`.cur` 与 `.bmp`，包括为多个 DPI 级别打包的多图像条目 |
| RGBA 像素 | 32bpp **自上而下** DIB section（`biHeight` 为负），配合不透明的 1bpp 掩码送入 `CreateIconIndirect` |

颜色位图中的 alpha 通道承载形状信息，因此掩码全为零——即「保留颜色位图可见」。

## v0.2.0 修复的两个缺陷

### 1. 回调消息的字段解析

标准托盘通知消息的回调签名：

```c
LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);
```

对于 `uCallbackMessage`（UDA 注册的自定义消息），**`wParam` 为图标 id，`lParam` 为事件码**（`WM_LBUTTONDOWN` 等）。旧实现将 `wParam` 当作事件码读取，导致：

- 事件码无法匹配（实际读到的是自增的图标 id）；
- 所有回调被静默丢弃；
- 托盘图标正常显示，但点击无响应。

修正方式是将两个字段分别解析。该缺陷在 Linux 上无法暴露：`uda-platform-windows` 整 crate 以 `#![cfg(windows)]` 门控，其测试在 Linux 上编译为空。只有真机运行或交叉编译能发现。

### 2. 跨线程引用的生命周期

工作线程需要访问宿主的 `TrayIconInner` 状态。早期实现将引用装入 `Send` 包装后跨线程传递，宿主可能在任意时刻 drop 该值，导致工作线程读取已释放内存。

修正方式是使用 `Arc<Mutex<>>` 共享状态，并用 `Box` 固定 worker 结构体，使指针在整个线程生命周期内稳定；`Drop` 中先清空槽位再销毁窗口，避免工作线程在窗口销毁后被唤醒。

## 图标来源

| 来源 | 处置 |
|------|------|
| `TrayIconSource::Path` | `LoadImageW` 读文件（`module` 传 NULL 才能让它把名字当文件名） |
| `TrayIconSource::Rgba` | `CreateDIBSection` + `CreateBitmap` 掩码，alpha 已编码形状时掩码全零 |
| 无图标 | 回落 `LoadIconW(NULL, IDI_APPLICATION)` |

:::caution[LoadImageW 的 module 参数]
传非 NULL 会让它把名字当**资源序号**解析，而不是文件名。这是"明明给了路径却什么都不显示"的经典原因。
:::

## 尺寸与 DPI

`GetSystemMetrics(SM_CXSMICON)` 给当前 DPI 下的小图标尺寸。UDA 在提交像素前按该尺寸降采样，避免 shell 自己缩放导致的锯齿与内存浪费。

SDK 层还会解码 PNG（反滤波、调色板展开、非 8 位深扩展）后经 `uda_tray_set_icon_rgba` 提交，因此调用方不必关心 GDI 细节。
