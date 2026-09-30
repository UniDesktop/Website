---
title: Python SDK
description: 零第三方依赖的 ctypes 封装：成员表、命名空间与异常模型。
---

## 安装与导入

无需 `pip install`——`ctypes` 是标准库。把 `examples/python/` 加入路径即可：

```python
from uda import Uda
```

库解析顺序：显式 `library_path` → `UDA_LIBRARY` 环境变量 → `cargo metadata` 报告的 target 目录。

## 常量类

| 类 | 成员 |
|----|------|
| `Theme` | `DARK` / `LIGHT` / `UNKNOWN` |
| `FillMode` | `CROP` / `FILL` / `FIT` / `STRETCH` |
| `WakeLockType` | `DISPLAY` / `SYSTEM` |
| `MediaCommand` | `PLAY` / `PAUSE` / `TOGGLE` / `NEXT` / `PREVIOUS` / `STOP` |
| `PlaybackStatus` | `PLAYING` / `PAUSED` / `STOPPED` / `UNKNOWN` |
| `SessionAction` | `LOCK` / `LOGOUT` / `SUSPEND` / `HIBERNATE` / `REBOOT` / `SHUTDOWN` |
| `SessionCapability` | `MANAGEMENT` / `LOCK` / `LOGOUT` / `SUSPEND` / `HIBERNATE` / `REBOOT` / `SHUTDOWN` |

## `Uda`

| 成员 | 类型 | 说明 |
|------|------|------|
| `Uda(library_path=None)` | 构造 | 加载库并声明原型 |
| `uda.theme` | `str` 属性 | `'dark'` / `'light'` / `'unknown'` |
| `uda.accent_color` | `tuple[int,int,int,int] \| None` | RGBA；平台无此概念时为 `None` |
| `uda.wallpaper` | `str \| None` 属性（可写） | 当前壁纸路径；赋值等同 `set_wallpaper(path, FILL)` |
| `uda.set_wallpaper(path, fill_mode)` | 方法 | 显式指定填充模式 |
| `uda.notify(title, body, icon, actions, app_name)` | 方法 → `int` | 返回通知 id |
| `uda.wakelock(lock_type, reason)` | 方法 → `WakeLock` | 上下文管理器 |
| `uda.create_tray_icon(name, tooltip, icon)` | 方法 → `TrayIcon` | |
| `uda.create_tray_menu()` | 方法 → `TrayMenu` | |
| `uda.media` | `_MediaController` 属性 | 媒体命名空间 |
| `uda.session` | `_SessionController` 属性 | 会话命名空间 |
| `uda.release_all()` | 方法 | 释放本对象持有的全部锁与托盘资源 |
| `__enter__` / `__exit__` | 上下文管理 | `with Uda() as uda:` |

## 命名空间 `uda.media`

| 成员 | 类型 |
|------|------|
| `now_playing` | `MediaTrack \| None` 属性 |
| `status` | `str` 属性（`PlaybackStatus` 常量） |
| `send(command)` | 方法，接受指令名字符串或常量 |
| `play()` / `pause()` / `play_pause()` / `next()` / `previous()` / `stop()` | 便捷方法 |

`MediaTrack` 字段：`title`、`artists`（`list[str]`）、`album`、`duration_ms`。

## 命名空间 `uda.session`

| 成员 | 类型 |
|------|------|
| `capabilities` | `dict[str, bool]` 属性 |
| `supports(action)` | `bool`，`action` 为动作名 |
| `lock()` / `logout()` / `suspend()` / `hibernate()` / `reboot()` / `shutdown()` | 方法 |

## `WakeLock`

| 成员 | 说明 |
|------|------|
| `handle` | 库分配句柄 |
| `release()` | 释放；重复调用安全 |
| `__enter__` / `__exit__` | `with` 语句 |

## `TrayIcon`

| 成员 | 类型 |
|------|------|
| `handle` | 句柄；销毁后为 0 |
| `tooltip` | `str` 属性（可写）；超 127 字符被截断 |
| `icon` | `str` 属性（可写）；从图片文件设置 |
| `visible` | `bool` 属性（可写） |
| `menu` | `TrayMenu \| None` 属性（可写） |
| `wait()` | 阻塞至 `stop()` / `destroy()` |
| `stop()` | 让 `wait()` 返回，不注销 |
| `destroy()` | 注销并销毁 |
| `__enter__` / `__exit__` | `with` 语句 |

## `TrayMenu` / `TrayItem`

| 成员 | 说明 |
|------|------|
| `add_text(label, callback)` | 文本项，回调无参 |
| `add_checkbox(label, checked, callback)` | 复选框，回调接收点击后的新状态 |
| `add_separator()` | 分隔线 |
| `handle` | 句柄 |
| `items` | 已添加的行（含分隔线），按顺序 |
| `item_for(item_id)` | 按 id 查找 |
| `destroy()` | 销毁菜单句柄 |

`TrayItem` 字段：`item_id`、`label`、`kind`、`checked`、`enabled`。

## 异常模型

```python
class UdaError(RuntimeError):
    status: int       # 负状态码
    # 消息由 uda_last_error_message() 提供；读取失败时退回状态码描述
```

`__del__` 兜底只在忘记释放时触发，正常路径请用 `with` 或显式 `destroy()` / `release()`。
