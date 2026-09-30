---
title: 会话与电源生命周期
description: 锁屏、注销、睡眠、休眠、重启与关机，以及能力位先行查询的安全约定。
---

:::danger[破坏性动作]
除锁屏外的每一个动作都会中断用户工作或关闭机器。**务必先查询能力位再决定是否展示入口**，并且不要让自动化测试触发它们。
:::

## 六个动作

```python
from uda import Uda

with Uda() as uda:
    session = uda.session

    session.lock()         # 锁定会话
    session.logout()       # 结束当前用户会话
    session.suspend()      # 挂起到内存
    session.hibernate()    # 休眠到磁盘
    session.reboot()       # 重启
    session.shutdown()     # 关机
```

Node.js 侧同名：`uda.session.lock()`、`.logout()`、`.suspend()`、`.hibernate()`、`.reboot()`、`.shutdown()`。

## 先查询，再执行

每个动作都有独立的能力位。UI 应在画菜单前先查一遍，把不支持的项置灰或隐藏：

```python
caps = uda.session.capabilities()
# {'lock': True, 'logout': True, 'suspend': True,
#  'hibernate': False, 'reboot': True, 'shutdown': True}
```

单个查询：

```python
if uda.session.supports("lock"):
    uda.session.lock()
```

Node.js：

```javascript
console.log(uda.session.capabilities);
if (uda.session.supports('lock')) uda.session.lock();
```

### 能力位表

| 位 | 值 | 含义 |
|----|----|------|
| `UDA_SESSION_CAP_MANAGEMENT` | `0x00010000` | 至少有一个动作可达 |
| `UDA_SESSION_CAP_LOCK` | `0x00020000` | 可锁屏（**唯一可安全自动化**） |
| `UDA_SESSION_CAP_LOGOUT` | `0x00040000` | 可注销 |
| `UDA_SESSION_CAP_SUSPEND` | `0x00080000` | 可挂起 |
| `UDA_SESSION_CAP_HIBERNATE` | `0x00100000` | 可休眠 |
| `UDA_SESSION_CAP_REBOOT` | `0x00200000` | 可重启 |
| `UDA_SESSION_CAP_SHUTDOWN` | `0x00400000` | 可关机 |

:::note[能力位说的是"路存在"，不是"账户被允许"]
休眠被系统关闭的机器仍会上报 `UDA_SESSION_CAP_HIBERNATE`；真正的尝试会以 `UDA_ERR_NOT_SUPPORTED` 失败。同理，Windows 上的重启/关机需要 `SeShutdownPrivilege`，那是运行时答案。
:::

## 平台实现

| 动作 | Linux | Windows |
|------|-------|---------|
| 锁屏 | `org.freedesktop.ScreenSaver.Lock()`（会话总线）→ `loginctl lock-session` | `LockWorkStation()` |
| 注销 | GNOME/KDE 各自 D-Bus 方法 | `ExitWindowsEx(EWX_LOGOFF)` |
| 挂起 | logind `Suspend` | `SetSuspendState(FALSE)` |
| 休眠 | logind `Hibernate` | `SetSuspendState(TRUE)` |
| 重启 | logind `Reboot` | `ExitWindowsEx(EWX_REBOOT \| EWX_FORCEIFHUNG)` |
| 关机 | logind `PowerOff` | `ExitWindowsEx(EWX_SHUTDOWN \| EWX_POWEROFF \| EWX_FORCEIFHUNG)` |

logind 调用需要 polkit 授权。被拒时 UDA 返回 `UDA_ERR_NOT_SUPPORTED`，消息中带上 D-Bus 错误名（`AccessDenied` / `NotAuthorized` / `InteractiveAuthorizationRequired`），便于 UI 提示用户授权。

### Windows 提权舞步

重启与关机前，UDA 会：

1. `OpenProcessToken` 打开当前进程令牌；
2. `LookupPrivilegeValueW` 取 `SeShutdownPrivilege` 的 LUID；
3. `AdjustTokenPrivileges` 启用它；
4. 调用 `ExitWindowsEx`；
5. `TokenGuard` 的 `Drop` 恢复原状态并关闭句柄。

第 3 步返回 `ERROR_NOT_ALL_ASSIGNED`（部分持有未被授予）时，UDA 会明确报错而不是带病继续——一个未真正生效的提权会让 `ExitWindowsEx` 以 `ERROR_PRIVILEGE_NOT_HELD`（1314）失败，而那时的错误信息无法指出真正原因。

## 安全姿态

- **锁屏是唯一非破坏性动作**，可以无条件自动化（例如空闲超时）。
- 其余动作请放在显式确认之后（对话框、二次点击），且确认文案里带上动作全名。
- `07_session` 示例默认只打印能力矩阵并只演示锁屏，破坏性动作以注释形式给出，需手动取消注释。

## 常见失败

| 现象 | 原因 |
|------|------|
| `UDA_ERR_NOT_SUPPORTED`，消息含 `AccessDenied` | polkit 未授权；需要在桌面环境里授权或以有权限的用户运行 |
| `UDA_ERR_NOT_SUPPORTED`，消息含 `not implemented` | 系统关闭了休眠/挂起（无 swap、BIOS 禁用等） |
| Windows 上 `ERROR_PRIVILEGE_NOT_HELD` | 账户无关机权限（标准用户 + 策略限制） |
