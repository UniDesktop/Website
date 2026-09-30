---
title: Session & power lifecycle
description: Lock, logout, suspend, hibernate, reboot and shutdown, with capability bits and the privilege dance.
---

:::danger[Destructive actions]
Every action except `lock` interrupts the user's work or stops the machine. **Query the capability bits before deciding whether to offer an entry**, and never let an automated test trigger one of them.
:::

## The six actions

```python
from uda import Uda

with Uda() as uda:
    session = uda.session

    session.lock()         # lock the session
    session.logout()       # end the current user session
    session.suspend()      # suspend to RAM
    session.hibernate()    # hibernate to disk
    session.reboot()       # reboot
    session.shutdown()     # power off
```

Node.js uses the same names: `uda.session.lock()`, `.logout()`, `.suspend()`, `.hibernate()`, `.reboot()`, `.shutdown()`.

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

Every action has its own capability bit. A UI should query the whole set before drawing the menu, and grey out or hide what is unsupported:

```python
caps = uda.session.capabilities
# {'lock': True, 'logout': True, 'suspend': True,
#  'hibernate': False, 'reboot': True, 'shutdown': True}
```

A single query:

```python
if uda.session.supports("lock"):
    uda.session.lock()
```

```javascript
console.log(uda.session.capabilities);
if (uda.session.supports('lock')) uda.session.lock();
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

- Linux: `org.freedesktop.ScreenSaver.Lock()` on the session bus, falling back to `loginctl lock-session` when the screen saver is missing or refuses. `loginctl` resolves the *calling* session, so this tier still works on a desktop that runs no screen saver service at all.
- Windows: `user32!LockWorkStation`.

`LOCK` is therefore advertised unconditionally: the CLI fallback needs no screen saver service.

## Platform backends

| Action | Linux | Windows |
|---|---|---|
| Lock | `org.freedesktop.ScreenSaver.Lock()` → `loginctl lock-session` | `LockWorkStation()` |
| Logout | `org.freedesktop.login1.Manager.TerminateSession("")` on the system bus | `ExitWindowsEx(EWX_LOGOFF, 0)` |
| Suspend | `org.freedesktop.login1.Manager.Suspend(false)` | `SetSuspendState(false, ...)` |
| Hibernate | `org.freedesktop.login1.Manager.Hibernate(false)` | `SetSuspendState(true, ...)` |
| Reboot | `org.freedesktop.login1.Manager.Reboot(false)` | `ExitWindowsEx(EWX_REBOOT \| EWX_FORCEIFHUNG, 0)` |
| Shutdown | `org.freedesktop.login1.Manager.PowerOff(false)` | `ExitWindowsEx(EWX_POWEROFF \| EWX_FORCEIFHUNG, 0)` |

`loginctl` and the `login1` calls require polkit authorisation. When refused, UDA returns `UDA_ERR_NOT_SUPPORTED` with the D-Bus error name attached (`AccessDenied` / `NotAuthorized` / `InteractiveAuthorizationRequired`), so a UI can prompt for authorisation instead of showing a generic failure.

Logout and the two sleep states need no privilege. Only the two power-off paths on Windows require the privilege sequence described below.

## Privilege requirements

`ExitWindowsEx` with `EWX_REBOOT` or `EWX_POWEROFF` fails with `ERROR_PRIVILEGE_NOT_HELD` (1314) unless the process token carries the `SeShutdownPrivilege` privilege **and** it is *enabled*. Two steps are required, and skipping either produces the same misleading failure:

1. `OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &token)` opens the token. `TOKEN_QUERY` is required because `AdjustTokenPrivileges` reports what it actually did through its `previousstate` out parameter.
2. `AdjustTokenPrivileges(token, false, &privileges, ...)` enables the privilege. It returns a *success* status even when it granted nothing, so `GetLastError()` must be checked for `ERROR_NOT_ALL_ASSIGNED` — the only reliable way to distinguish "the account lacks the privilege" from "done".

Step 2 returning `ERROR_NOT_ALL_ASSIGNED` (some held privileges were not granted) is reported as an explicit error rather than ignored: an elevation that never took effect would make `ExitWindowsEx` fail with `ERROR_PRIVILEGE_NOT_HELD` (1314), whose message cannot name the real cause.

The token handle is owned by a guard whose `Drop` calls `CloseHandle`, so every early return releases it, and a failure maps to a typed error rather than leaving the machine in an intermediate state.

## Safety posture

- **`lock` is the only non-destructive action** and may be automated unconditionally (an idle timeout, for example).
- Put every other action behind an explicit confirmation (a dialog, a second click), and name the action in full in the confirmation text.
- The `07_session` example prints the capability matrix and demonstrates only `lock`; the destructive actions are provided as commented-out lines that must be uncommented deliberately.

## Errors

An action the platform cannot deliver is refused *before* the backend is asked, so "unsupported" is always distinguishable from "tried and failed":

| Outcome | Error |
|---|---|
| Capability bit absent | `UdaError::NotSupported` |
| polkit refuses (Linux) | `NotSupported` carrying the polkit detail |
| Account lacks `SeShutdownPrivilege` | `NotSupported` (`ERROR_PRIVILEGE_NOT_HELD`) |
| Hibernation disabled | a runtime failure from `logind` / `SetSuspendState` |

## Common failures

| Symptom | Cause |
|---|---|
| `UDA_ERR_NOT_SUPPORTED` with `AccessDenied` in the message | polkit refused; authorise in the desktop environment, or run as a user with permission |
| `UDA_ERR_NOT_SUPPORTED` with `not implemented` in the message | the system has the action switched off (no swap for hibernation, disabled in the BIOS, …) |
| `ERROR_PRIVILEGE_NOT_HELD` on Windows | the account has no shutdown right (a standard user plus a policy restriction) |

## See also

- [Troubleshooting](/en/guides/troubleshooting/#session--power) — why a capability that is set still fails
- [Capability and fallback](/en/guides/capability-and-fallback/) — querying capabilities in general
- [`docs/internals/session_specs.md`](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/session_specs.md) — the full protocol mapping
