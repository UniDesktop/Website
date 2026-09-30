---
title: 构建共享库
description: 构建与交叉编译 uda-ffi，以及 target 目录解析机制。
---

## 常规构建

```bash
cargo build -p uda-ffi            # debug，位于 target/debug/
cargo build -p uda-ffi --release  # release，位于 target/release/
```

## 交叉编译到 Windows

在 Linux 宿主上为 Windows 构建，需先安装工具链：

```bash
rustup target add x86_64-pc-windows-gnu    # 或 x86_64-pc-windows-msvc

# MinGW 链接器（仅 gnu 目标需要）
sudo apt install mingw-w64

cargo build -p uda-ffi --release --target x86_64-pc-windows-gnu
```

`crates/uda-platform-windows` 整 crate 以 `#![cfg(windows)]` 门控，因此在 Linux 上执行 `cargo check --workspace` 不会编译它，宿主编译永不被打断。

`crates/uda-platform-windows` 整 crate 以 `#![cfg(windows)]` 门控，因此在 Linux 上执行 `cargo check --workspace` 不会编译它，宿主编译永不被打断。该门控也是交叉编译检查必须进入 CI 的原因：缺少它，Windows 侧的编译错误将无人发现。

## target 目录在哪里

SDK 通过 `cargo metadata` 查询**真实**的 target 目录，而不是硬编码 `./target`。这让你可以把它重定向到别处（例如为了性能放到另一块磁盘）：

```toml
# .cargo/config.toml
[build]
target-dir = "/mnt/fast/target"
```

也可以用环境变量临时覆盖：

```bash
CARGO_TARGET_DIR=/tmp/target cargo build -p uda-ffi
```

## 用环境变量指定库文件

如果产物不在标准位置，SDK 也接受显式路径：

```bash
# Python
UDA_LIBRARY=/path/to/libuda_ffi.so python3 examples/python/01_appearance.py

# Node.js
UDA_LIBRARY=/path/to/libuda_ffi.so node examples/nodejs/01_appearance.js
```

也可以在代码里传：

```python
from uda import Uda

with Uda(library_path="/opt/uda/libuda_ffi.so") as uda:
    print(uda.theme)
```

## 验证构建结果

```bash
cargo run -p uda-cli
```

诊断 CLI 会按子系统报告最终应答的后端，这也是确认库能从实际构建目录加载的最快方式。

## 工作区产物

| 产物 | 使用者 |
|------|--------|
| `libuda_ffi.so` / `uda_ffi.dll` | Python（`ctypes`）、Node.js（`koffi`）、任意 C 宿主 |
| Rust crates | 直接使用 trait 的原生 Rust 应用 |
| `uda-cli` | 开发者人工诊断 |

## 导出符号校验（Windows）

Windows 上 C-ABI 依赖 `#[no_mangle]` 导出，可用仓库自带脚本核对 DLL 导出的 C 符号集合：

```bash
python3 scripts/pe_exports.py path/to/uda_ffi.dll
```

期望的符号清单由脚本从 `include/uda.h` 的声明派生，而不是硬编码的数量——新增导出函数不需要同步修改 CI。

## 下一步

- [安装](/getting-started/installation/)——各宿主语言的前置条件
- [第一个桌面能力](/getting-started/hello-desktop/)——最小可用示例
