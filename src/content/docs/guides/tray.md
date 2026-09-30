---
title: 系统托盘
description: 托盘图标与右键菜单的完整生命周期、线程模型与清理约定。
---

## 最小示例

```python
from uda import Uda

with Uda() as uda:
    menu = uda.create_tray_menu()
    menu.add_text("设置", lambda: print("打开设置"))
    menu.add_separator()
    menu.add_text("退出", lambda: raise SystemExit(0))

    icon = uda.create_tray_icon("我的应用", tooltip="我的应用正在运行")
    icon.menu = menu

    icon.wait()          # 阻塞直到 stop() 或 destroy()
```

Node.js 侧：

```javascript
const { Uda } = require('./uda');

const uda = new Uda();
const menu = uda.createTrayMenu();
menu.addText('设置', () => console.log('打开设置'));
menu.addSeparator();

const icon = uda.createTrayIcon('我的应用', { tooltip: '我的应用正在运行' });
icon.menu = menu;
await icon.wait();
icon.destroy();
```

## 菜单模型

跨平台统一，两侧能力一致：

| 行类型 | Python | Node.js |
|--------|--------|---------|
| 文本项 | `menu.add_text(label, callback)` | `menu.addText(label, callback)` |
| 复选框 | `menu.add_checkbox(label, checked, callback)` | `menu.addCheckbox(label, checked, callback)` |
| 分隔线 | `menu.add_separator()` | `menu.addSeparator()` |

回调签名：

- 文本项：`callback()`
- 复选框：`callback(checked: bool)`，其中 `checked` 是**点击后的新状态**

### 平台实现

| 平台 | 协议 |
|------|------|
| Linux | `org.kde.StatusNotifierItem`（SNI）+ `com.canonical.dbusmenu` |
| Windows | `Shell_NotifyIconW`（`NOTIFYICON_VERSION_4`）+ 自建弹出菜单 |

## 图标：传路径即可

```python
icon.icon = "icons/UniDesktop_3D_transparent_mini.png"
```

SDK 内部会解码 PNG（含逐行反滤波、调色板展开、非 8 位深扩展）、按目标尺寸降采样、按需做通道对齐，然后经 `uda_tray_set_icon_rgba` 提交像素。

:::caution[不要直接用 uda_tray_set_icon_path]
C-ABI 层的 `uda_tray_set_icon_path` 在 Linux 上被解释为**freedesktop 图标主题名**，而不是文件路径——这是 SNI 的语义，桌面环境会去主题目录里找同名图标。要显示自己的图片，请用 SDK 的 `icon.icon = path`，它走的是像素路径。
:::

## 线程模型

:::caution[回调在托盘工作线程上执行]
Windows 后端的托盘图标由一条专用工作线程驱动（自建消息泵），Linux 侧的回调同样不在你的主线程上。

因此回调里**不能**：

- 直接更新 GUI（请 post 到主线程 / 事件队列）；
- 阻塞等待（不要 `sleep`、不要同步 I/O、不要 join 其他线程）；
- 长时间计算。
:::

:::note[设计前提]
宿主的事件循环不被占用。托盘模块由此前提设计。
:::

## 生命周期：stop / wait / destroy

| 方法 | 作用 |
|------|------|
| `icon.wait()` | 阻塞当前线程，直到 `stop()` 或 `destroy()` 被调用 |
| `icon.stop()` | 让 `wait()` 返回，但**不**注销图标（图标仍在托盘） |
| `icon.destroy()` | 从托盘注销并销毁句柄，`wait()` 随之返回 |

典型模式：

```python
icon = uda.create_tray_icon("我的应用")
try:
    icon.wait()
finally:
    icon.destroy()
```

配合菜单项退出：

```python
def quit():
    icon.stop()      # 让 wait() 返回，finally 里再 destroy

menu.add_text("退出", quit)
icon.menu = menu
icon.wait()
icon.destroy()
```

## 显示与隐藏

```python
icon.visible = False     # 隐藏但不注销
icon.visible = True      # 恢复
```

:::note[隐藏与销毁的区别]
隐藏后句柄仍然有效，可随时恢复显示；销毁才会从托盘注销并释放句柄。
:::

## 清理

`TrayIcon` 与 `TrayMenu` 都实现了 `Drop` / `Symbol.dispose`，退出 `with` 块时自动注销；忘记释放时 `__del__` / `dispose` 会兜底。`Uda.release_all()` 可一次性释放本对象持有的全部托盘资源与常亮锁。

## 相关文档

- [StatusNotifierItem（SNI）](/internals/protocols/statusnotifieritem/)——Linux 侧协议，含 `IconPixmap` 字节序
- [DBusMenu](/internals/protocols/dbusmenu/)——以整数 id 定位的菜单树
- [Shell_NotifyIconW](/internals/protocols/notifyicon/)——Windows 侧实现
