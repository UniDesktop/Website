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

| 平台 | 机制 |
|------|------|
| Linux | 会话总线上的 `org.freedesktop.ScreenSaver.Inhibit`；DISPLAY 锁传 flag `8`（idle），SYSTEM 锁传 `12`（idle + suspend）。释放时用守护进程返回的 cookie 调用 `UnInhibit` |
| Windows | `SetThreadExecutionState`：DISPLAY 锁为 `ES_CONTINUOUS \| ES_DISPLAY_REQUIRED`，SYSTEM 锁再加 `ES_SYSTEM_REQUIRED`；释放时恢复默认的 `ES_CONTINUOUS` |

没有更多回退层级：Linux 侧 ScreenSaver 服务是唯一后端，Windows 侧 `SetThreadExecutionState` 总可用。会话总线不可达时调用返回类型化错误。

:::note[Windows 侧的状态是进程级的]
`SetThreadExecutionState` 是调用线程上的进程级状态，而不是引用计数的句柄——每次调用都会**替换**此前的 flags。因此 UDA 有意设计为同时只暴露一把锁，释放时恢复整个进程的默认 `ES_CONTINUOUS`。
:::

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

## `reason` 的选择

`reason` 字符串会传给平台用于日志与诊断——例如屏幕保护程序显示是谁在阻止休眠，或 Windows 的电源请求追踪。保持简短可读；它不会作为通知展示给用户。

## 常见误用与约束

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

:::note[句柄语义]
C-ABI 返回一个 `uint64_t` 句柄，`0` 不是有效句柄。释放未知或已释放的句柄会返回 `UDA_ERR_INVALID_ARGUMENT`，而非静默成功，便于调用方发现重复释放。
:::

## 相关文档

- [能力与降级](/guides/capability-and-fallback/)——两层均不可用时的行为
- [`docs/internals/wakelock_specs.md`](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/wakelock_specs.md)——协议级映射
