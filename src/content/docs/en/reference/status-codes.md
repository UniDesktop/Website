---
title: Status codes
description: The six status constants, where each one is triggered, and how to read the diagnostic message.
---

Every C-ABI entry point returns an `int32_t`. All failure codes are negative, so `status != 0` is enough to detect a failure.

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `UDA_OK` | `0` | success |
| `UDA_ERR_INVALID_ARGUMENT` | `-1` | null pointer, invalid UTF-8, out-of-range enum code |
| `UDA_ERR_NOT_SUPPORTED` | `-2` | the current platform or session cannot provide the feature |
| `UDA_ERR_DETECTION_FAILED` | `-3` | environment or OS-version detection failed |
| `UDA_ERR_IO` | `-4` | filesystem error, or a process could not be spawned |
| `UDA_ERR_INTERNAL` | `-5` | unexpected internal error |
| `UDA_ERR_PANIC` | `-6` | a panic was contained at the FFI boundary (should never appear) |

In Rust the same conditions arrive as [`UdaError`](https://docs.rs/uda-core) variants — the status code is the ABI projection of the typed error, and the two never disagree.

## Typical triggers

### `UDA_ERR_INVALID_ARGUMENT`

| Call | Situation |
|---|---|
| `uda_detect_theme` | `out_theme` is null |
| `uda_set_wallpaper` | path is an empty string; `fill_mode` outside `0..=3` |
| `uda_media_send_command` | `command` outside `0..=5` |
| `uda_wakelock_release` | handle is `0`, or was never issued by this process |
| `uda_tray_*` | handle is `0` or already destroyed; a menu handle passed to an icon function |
| `uda_tray_set_icon_rgba` | `stride * height` exceeds `len`; a zero dimension or an overflow |
| `uda_notify` | `out_id` is null |
| `uda_get_accent_color` | `out_rgba` is null |

### `UDA_ERR_NOT_SUPPORTED`

| Call | Situation |
|---|---|
| Wallpaper | no portal, no GNOME/KDE/Hyprland/Sway IPC, and neither `feh` nor `nitrogen` is on `PATH` |
| Accent colour | the platform has no system-wide accent concept (KDE, XFCE, Wayland tilers) |
| Toast identity | no AppUserModelID can be resolved (`ELEMENT_NOT_FOUND`) |
| Session action | polkit refuses (`AccessDenied` / `NotAuthorized` / `InteractiveAuthorizationRequired`), or hibernation is switched off |
| Reboot / shutdown | the account lacks `SeShutdownPrivilege` (`ERROR_PRIVILEGE_NOT_HELD`) |

### `UDA_ERR_DETECTION_FAILED`

The OS version query failed — `RtlGetVersion` on Windows, or the release-information read on Linux.

### `UDA_ERR_IO`

The wallpaper file is unreadable, an `xdg-*` tool failed to launch, or the D-Bus socket connection failed.

### `UDA_ERR_PANIC`

A panic escaped from library code and was caught by the boundary. Every export runs inside `catch_unwind`, so a panic can never unwind across `extern "C"` — it becomes this status instead. Reaching it means a bug, and the message names the panic.

## Reading the diagnostic

Every failure records a message in a thread-local slot. Read it immediately, before the next UDA call on the same thread:

```c
int status = uda_set_wallpaper("/not/a/real.png", UDA_FILL_FILL);
if (status != UDA_OK) {
    const char *why = uda_last_error_message();
    printf("failed: %s\n", why ? why : "(no message)");
    uda_free_string((char *)why);   /* may be NULL, which is a no-op */
}
```

For a static, human-readable description of a code without a second round trip, use `uda_status_message(status)` — the returned pointer stays valid for the lifetime of the library and must **not** be freed.

## See also

- [C-ABI reference](/en/reference/c-abi/) — the full function list and ownership rules
