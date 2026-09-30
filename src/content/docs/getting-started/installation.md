---
title: 安装
description: 获取 UDA 的三种方式与平台前置条件。
---

## 前置条件

| 用途 | 要求 |
|------|------|
| 构建库（必需） | Rust 1.70+，2021 edition |
| 运行 Python 示例 | Python ≥ 3.9，无需第三方依赖（`ctypes` 为标准库） |
| 运行 Node.js 示例 | Node ≥ 16，且已 `npm install koffi` |
| Linux 会话 | 一个可用的 D-Bus 会话总线（桌面环境默认提供） |
| Windows | Windows 10 / 11 |

## 方式零：沿用 SDK 自带的 Python / Node.js 绑定

无需 `pip install`——Python 绑定只依赖标准库 `ctypes`，把 `examples/python/` 加入路径即可；Node.js 绑定基于 `koffi`，在 `examples/nodejs/` 下执行 `npm install` 即可，不涉及 `node-gyp` 或原生编译步骤。

## 方式一：从源码构建

```bash
git clone https://github.com/UniDesktop/SDK.git
cd SDK

# 构建 C-ABI 共享库（Python / Node.js SDK 加载的目标）
cargo build -p uda-ffi

# 发布版本
cargo build -p uda-ffi --release
```

产物位置：

| 平台 | 文件名 |
|------|--------|
| Linux | `libuda_ffi.so` |
| Windows | `uda_ffi.dll` |

## 方式二：下载预编译产物

从 [Releases](https://github.com/UniDesktop/SDK/releases) 页面下载对应平台的压缩包，内含共享库与 `include/uda.h`。

## 方式三：作为子模块集成

```bash
git submodule add https://github.com/UniDesktop/SDK.git third_party/uda
```

然后在你的 `Cargo.toml` 中按平台引入实现 crate：

```toml
uda-core = { path = "third_party/uda/crates/uda-core" }

[target.'cfg(windows)'.dependencies]
uda-platform-windows = { path = "third_party/uda/crates/uda-platform-windows" }

[target.'cfg(unix)'.dependencies]
uda-platform-linux = { path = "third_party/uda/crates/uda-platform-linux" }
```

## 验证安装

跑第一个示例，它只读取系统外观，无任何副作用：

```bash
cargo build -p uda-ffi
python3 examples/python/01_appearance.py
```

预期输出当前深浅色，以及平台支持时返回的强调色。若提示找不到动态库，见[故障排查](/guides/troubleshooting/)。

## Linux 运行时依赖

| 功能 | 依赖 |
|------|------|
| 所有 D-Bus 功能 | `dbus`（会话总线必须可达） |
| Portal 功能（外观） | `xdg-desktop-portal` |
| 通知 | 任一 `org.freedesktop.Notifications` 实现（`dunst`、`mako` 等） |
| 系统托盘 | StatusNotifierWatcher——GNOME 需要 AppIndicator 扩展 |
| X11 壁纸 | `feh` 或 `nitrogen`（仅在无 DE IPC 时） |

以上均非硬依赖：UDA 会逐项探测，全部缺失时返回类型化错误。

## Windows 运行时依赖

除 Windows 10 / 11 本身外无其他依赖。toast、托盘、媒体与电源均使用平台内置 API，未打包进程所需的 AppUserModelID 也由 UDA 自行注册。

## 下一步

- [构建共享库](/getting-started/build-the-library/)——工作区产物与交叉编译
- [第一个桌面能力](/getting-started/hello-desktop/)——最小可用示例
