---
title: Wake locks
description: Keeping the display or the whole system awake, with RAII release semantics.
---

## Acquiring a lock

```python
from uda import Uda

with Uda() as uda:
    # Display stays on for as long as the lock object lives
    with uda.wakelock("display", reason="播放视频") as lock:
        play_video()
    # released here
```

```javascript
const lock = uda.wakelock({ type: 'display', reason: 'playing video' });
playVideo();
lock.release();
```

```c
uint64_t handle = 0;
if (uda_wakelock_acquire(UDA_WAKELOCK_DISPLAY, "playing video", &handle) == UDA_OK) {
    /* ... */
    uda_wakelock_release(handle);
}
```

## The two lock types

| Type | Effect |
|---|---|
| `display` (`PreventDisplaySleep`) | the screen stays on; the system may still idle |
| `system` (`PreventSystemIdle`) | the system stays awake, including disk and network activity |

Pick the narrowest lock that does the job: a video player needs `display`, a build or download needs `system`.

## Release semantics

The Rust SDK exposes the lock as an RAII guard — releasing is automatic, idempotent, and safe to call twice. Dropping the `Uda` instance releases everything it holds, so a forgotten lock cannot outlive the host.

Releasing a handle that was never issued by this process, or one already released, returns `UDA_ERR_INVALID_ARGUMENT` rather than panicking — the handle table is exact, not best-effort.

## Backends

| Platform | Mechanism |
|---|---|
| Linux | `org.freedesktop.ScreenSaver.Inhibit` on the session bus; the display lock passes flag `8` (idle) and the system lock `12` (idle + suspend). Release calls `UnInhibit` with the cookie the daemon returned |
| Windows | `SetThreadExecutionState`: `ES_CONTINUOUS \| ES_DISPLAY_REQUIRED` for the display lock, plus `ES_SYSTEM_REQUIRED` for the system lock. Release restores the default `ES_CONTINUOUS` |

There is no further fallback tier: on Linux the ScreenSaver service is the only backend, and on Windows `SetThreadExecutionState` is always available. When the session bus is unreachable the call fails with a typed error.

:::note[Windows state is process-wide]
`SetThreadExecutionState` is process-wide state on the calling thread rather than a reference-counted handle — each call *replaces* the previous flags. UDA therefore exposes one lock at a time as an intentional single-lock design, and releasing restores the default `ES_CONTINUOUS` for the whole process.
:::

Note that a wake lock only **inhibits** the automatic idle behaviour; it does not prevent the user from locking the session or pressing the power button.

## Choosing `reason`

The reason string is passed to the platform for logging and diagnostics — a screensaver that shows what is holding it awake, or a Windows power-request trace. Keep it short and human-readable; it is never shown to the user as a notification.

## Handle semantics

The C-ABI returns a `uint64_t` handle, where `0` is not a valid value. Releasing an unknown or already-released handle returns `UDA_ERR_INVALID_ARGUMENT` rather than a silent success, so a host discovers its own double-release bug.

## See also

- [Capability and fallback](/en/guides/capability-and-fallback/) — when neither tier answers
- [`docs/internals/wakelock_specs.md`](https://github.com/UniDesktop/SDK/blob/develop/docs/internals/wakelock_specs.md) — the protocol-level mapping
