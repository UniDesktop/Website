---
title: 防休眠锁
description: 阻止屏幕休眠与系统空闲挂起，以及 RAII 释放约定。
---

## 两种锁

```python
from uda import Uda, WakeLockType

with Uda() as uda:
    # 只阻止屏幕变暗/关闭，系统仍可待机
    with uda.wakelock(WakeLockType.DISPLAY, reason="正在演示") as lock:
        print("屏幕保持点亮")

    # 同时阻止系统空闲挂起
    with uda.wakelock(WakeLockType.SYSTEM, reason="视频转码") as lock:
        print("系统保持唤醒")
```

| 类型 | 语义 |
|------|------|
| `WakeLockType.DISPLAY` | 阻止显示器关闭。用户按电源键仍可手动休眠 |
| `WakeLockType.SYSTEM` | 阻止系统空闲判定与自动挂起 |

平台映射上，Linux 侧对应 `org.freedesktop.ScreenSaver.Inhibit` 的 flags（8 = Idle，12 = Idle + Suspend），Windows 侧对应 `SetThreadExecutionState` 的 `ES_CONTINUOUS` 加上 `ES_DISPLAY_REQUIRED` / `ES_SYSTEM_REQUIRED`。

## RAII 释放

`WakeLock` 实现了上下文管理器，离开 `with` 块即释放：

```python
with uda.wakelock(reason="下载") as lock:
    download()          # 即使抛异常，锁也会释放
```

也可以手动释放，且**重复调用是安全的**：

```python
lock = uda.wakelock(reason="下载")
lock.release()
lock.release()          # no-op
```

Node.js 侧用 `release()`：

```javascript
const lock = uda.wakelock('system', '视频转码');
// ...
lock.release();
```

## 常见误用

:::caution[不要长期持锁]
常亮锁会直接影响电池寿命与设备发热。只在确有用户可见活动时持有，活动结束立即释放。
:::

:::caution[不要在托盘/定时器回调里持锁]
回调可能被高频触发。若每次回调都申请而不释放，会快速累积多个 cookie。正确做法是在应用层维护一个「活跃理由」集合，只在集合为空时释放。
:::

:::caution[锁不能阻止用户手动休眠]
`WakeLockType.SYSTEM` 只影响系统的**空闲自动挂起**。用户主动点电源键、合盖（取决于电源策略）仍会休眠——这是预期行为，锁不是安全机制。
:::

## 句柄语义

C-ABI 返回一个 `uint64_t` 句柄，`0` 不是有效句柄。释放一个未知或已释放的句柄会返回 `UDA_ERR_INVALID_ARGUMENT`，而不是静默成功——这能让调用方发现自己重复释放了。
