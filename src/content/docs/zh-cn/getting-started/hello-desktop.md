---
title: 第一个桌面能力
description: 十行代码检测主题并发送一条通知。
---

## 最短可用示例

```python
from uda import Uda

with Uda() as uda:
    print("主题:", uda.theme)
    uda.notify("你好，桌面", "这是通过 UDA 发出的第一条系统通知。")
```

离开 `with` 块时，SDK 会自动释放本对象持有的全部资源（常亮锁、托盘图标、菜单）。

## 逐行说明

| 片段 | 含义 |
|------|------|
| `Uda()` | 加载共享库并声明所有导出函数的原型。库路径解析顺序：显式参数 → `UDA_LIBRARY` → `cargo metadata` 报告的 target 目录 |
| `uda.theme` | 属性式读取，返回 `"dark"` / `"light"` / `"unknown"` |
| `uda.notify(...)` | 方法式调用，返回服务器分配的通知 id |
| `with` / `release_all()` | 资源释放约定，见下文 |

## 资源释放约定

Python 侧有三类会持有系统资源的对象，都实现了上下文管理器协议：

```python
with Uda() as uda:
    with uda.wakelock(reason="视频播放") as lock:      # 退出时自动释放
        ...

    icon = uda.create_tray_icon("我的应用")            # 需手动销毁
    try:
        icon.wait()
    finally:
        icon.destroy()                                  # 从托盘注销
```

Node.js 侧对应 `Symbol.dispose`，可用 `using` 声明：

```javascript
{
  using uda = new Uda();
  console.log(uda.theme);
} // 离开作用域自动 dispose
```

## 常见的三个第一次失败

| 现象 | 原因 | 处置 |
|------|------|------|
| `UdaError: 找不到 UDA 动态库` | 尚未构建 `uda-ffi`，或 target 目录被重定向后 SDK 未找到 | 先 `cargo build -p uda-ffi`；或设置 `UDA_LIBRARY` |
| `UdaError: Failed to connect to session bus` | 无 D-Bus 会话（例如纯 SSH 终端、systemd 用户会话未启动） | 在桌面会话内运行，或 `export DBUS_SESSION_BUS_ADDRESS=...` |
| `UdaError: Feature not supported` | 当前平台/会话没有可用后端 | 查 `capabilities()` 得知缺哪一项，并给出友好提示而非崩溃 |

第三项是**设计意图**而非缺陷：UDA 在任何功能不可用时返回类型化错误，让你的应用可以分流而不是直接崩掉。

## 下一步

- [平台支持矩阵](/zh-cn/reference/platform-support/)——先确认你的目标平台能做什么
- [系统外观](/zh-cn/guides/appearance/)——深浅色与强调色
- [C-ABI 参考](/zh-cn/reference/c-abi/)——完整函数表
