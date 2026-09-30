---
title: Shell_NotifyIconW
description: Windows 托盘的隐藏窗口工作线程模型，以及 v0.2.0 修掉的两个真机 bug。
---

> 本文是 `docs/internals/tray_specs.md` 的导读提炼，完整规范以仓库内文件为准。

## 为什么需要一条工作线程

`Shell_NotifyIconW` 的 `NOTIFYICONDATAW` 里有一个 `hWnd`，shell 通过它投递回调消息（点击、菜单请求）。窗口属于**创建它的线程**，因此消息 pump 也必须在同一线程上。

如果把宿主主线程的窗口交给 UDA，就会劫持宿主的事件循环——这违反 AGENTS.md 的 Non-blocking 约束。UDA 的做法：

```text
宿主线程                     托盘工作线程
────────                    ──────────
TrayIcon::new()  ──spawn──▶  创建 message-only 窗口（HWND_MESSAGE 父）
  ...                        GetMessage 循环
host.set_tooltip()  ──post──▶ WM_USER 自定义消息 → 在该线程上 NIM_MODIFY
host.drop()         ──post──▶ 销毁窗口 → 退出循环
```

宿主的每次状态变更都以消息形式转发给工作线程，由工作线程在自己的锁保护下执行 Win32 调用。这满足「同一线程拥有窗口、调用不跨线程」的硬约束，同时宿主永不被阻塞。

## `NOTIFYICON_VERSION_4`

现在应始终使用版本 4。它让 shell 负责气泡超时与焦点管理，`NIN_SELECT`/`NINF_SELECT` 等才有意义。v0.2.0 之前按旧版布局解析 `NIN_BALLOON*` 的代码是 bug 来源之一。

## v0.2.0 修掉的两个真机 bug

### 1. 消息解包：`wParam` 是屏幕坐标

标准托盘通知消息的回调签名：

```c
LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);
```

对于 `uCallbackMessage`（UDA 注册的那个自定义消息），**`wParam` 是图标 id，`lParam` 是事件码**（`WM_LBUTTONDOWN` 等）。但旧代码把 `wParam` 当成事件码读，于是：

- 事件码永远匹配不上（读到的是一个自增的整数）；
- 所有回调被静默丢弃；
- 托盘图标显示正常，点它什么都没发生。

修法是把两个字段当作独立来源分别解析。这个 bug 在 Linux 上完全无法暴露——`uda-platform-windows` 整 crate 以 `#![cfg(windows)]` 门控，测试编译为空。只有真机或交叉编译能发现。

### 2. 内存钉住：`&T` 跨线程

工作线程需要访问宿主的 `TrayIconInner` 状态。早期实现把引用塞进 `Send` 包装直接跨线程传，但宿主随时可能 drop 它——工作线程读到已释放内存。

修法是 `Arc<Mutex<>>` 共享，并用 `Box` 钉住 worker 结构体本身，使指针在整个线程生命周期内稳定；`Drop` 中先清槽位再销毁窗口，保证工作线程不会在窗口销毁后仍被唤醒。

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
