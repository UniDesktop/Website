---
title: Session & power lifecycle
description: Lock, logout, suspend, hibernate, reboot and shutdown, with capability bits and the privilege dance.
---

## The six actions

| Action | Destructive | Safe to automate |
|---|---|---|
| `lock` | no | **yes** — reversible, destroys nothing |
| `logout` | yes | no — requires user confirmation |
| `suspend` | yes (RAM) | no |
| `hibernate` | yes (disk) | no |
| `reboot` | yes | no |
| `shutdown` | yes | no |

Five of the six end the user's session or stop the machine. The library provides the destination, not the guard: the host application must confirm with the user.

## Ask first, then act

```python
from uda import Uda

with Uda() as uda:
    caps = uda.session.capabilities()          # {'lock': True, 'suspend': True, ...}
    if uda.session.supports("suspend"):
        if confirm_with_user():                # your own dialog
            uda.session.suspend()
```

The capability query is **static and side-effect-free**, so a UI can call it freely — on startup, on every menu shown — without touching the machine's power state.

### Capability bits

| Constant | Bit | Meaning |
|---|---|---|
| `UDA_SESSION_CAP_MANAGEMENT` | `1 << 16` | a session backend exists at all |
| `UDA_SESSION_CAP_LOCK` | `1 << 17` | the session can be locked |
| `UDA_SESSION_CAP_LOGOUT` | `1 << 18` | this user's session can be logged out |
| `UDA_SESSION_CAP_SUSPEND` | `1 << 19` | the machine can be suspended to RAM |
| `UDA_SESSION_CAP_HIBERNATE` | `1 << 20` | the machine can be hibernated to disk |
| `UDA_SESSION_CAP_REBOOT` | `1 << 21` | the machine can be rebooted |
| `UDA_SESSION_CAP_SHUTDOWN` | `1 << 22` | the machine can be powered off |

`0` means "no session backend exists on this target". A set bit means **"the code path exists"**, not "the account is allowed": a machine that could sleep but has hibernation switched off still reports `HIBERNATE`, and the attempt then fails with a typed error rather than `Unsupported`.

## The lock path

`lock` is deliberately the safest of the six, because every program keeps running:

- Linux: `org.freedesktop.ScreenSaver.Lock()` on the session bus, falling back to `loginctl lock-session`.
- Windows: `user32!LockWorkStation`.

## Platform backends

| Action | Linux | Windows |
|---|---|---|
| Lock | `org.freedesktop.ScreenSaver.Lock()` → `loginctl lock-session` | `LockWorkStation()` |
| Logout | `org.freedesktop.login1.Manager.TerminateSession("")` → the desktop's own session manager | `ExitWindowsEx(EWX_LOGOFF, 0)` |
| Suspend | `org.freedesktop.login1.Manager.Suspend(false)` | `SetSuspendState(false, ...)` |
| Hibernate | `org.freedesktop.login1.Manager.Hibernate(false)` | `SetSuspendState(true, ...)` |
| Reboot | `org.freedesktop.login1.Manager.Reboot(false)` | `ExitWindowsEx(EWX_REBOOT \| EWX_FORCEIFHUNG, 0)` |
| Shutdown | `org.freedesktop.login1.Manager.PowerOff(false)` | `ExitWindowsEx(EWX_POWEROFF \| EWX_FORCEIFHUNG, 0)` |

Logout and the two sleep states need no privilege. Only the two power-off paths on Windows go through the privilege dance.

## Why the privilege dance exists

`ExitWindowsEx` with `EWX_REBOOT` or `EWX_POWEROFF` fails with `ERROR_PRIVILEGE_NOT_HELD` (1314) unless the process token carries the `SeShutdownPrivilege` privilege **and** it is *enabled*. Two steps are needed, and skipping either produces the same misleading failure:

1. `OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &token)` opens the token. `TOKEN_QUERY` is required because `AdjustTokenPrivileges` reports what it actually did through its `previousstate` out parameter.
2. `AdjustTokenPrivileges(token, false, &privileges, ...)` enables the privilege. It returns a *success* status even when it granted nothing, so `GetLastError()` must be checked for `ERROR_NOT_ALL_ASSIGNED` — the only reliable way to tell "the account lacks the privilege" from "done".

The token handle is owned by a guard whose `Drop` calls `CloseHandle`, so every early return releases it, and a failure maps to a typed error rather than half-rebooting the machine.

## Errors

An action the platform cannot deliver is refused *before* the backend is asked, so "unsupported" is always distinguishable from "tried and failed":

| Outcome | Error |
|---|---|
| Capability bit absent | `UdaError::NotSupported` |
| polkit refuses (Linux) | `NotSupported` carrying the polkit detail |
| Account lacks `SeShutdownPrivilege` | `NotSupported` (`ERROR_PRIVILEGE_NOT_HELD`) |
| Hibernation disabled | a runtime failure from `logind` / `SetSuspendState` |

## See also

- [Troubleshooting](/en/guides/troubleshooting/#session--power) — why a capability that is set still fails
- [`docs/internals/session_specs.md`](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/session_specs.md) — the full protocol mapping
