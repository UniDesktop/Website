---
title: C-ABI reference
description: Every exported function, its parameters, out-parameters, ownership rules and safety contract.
---

The stable ABI in `include/uda.h`, implemented by `crates/uda-ffi`. Python and Node.js both bind to this surface, so it changes rarely and only in ABI-compatible ways.

## Global contract

| Rule | Detail |
|---|---|
| Return value | `int32_t`; `0` is success, negative is a failure code ([see status codes](/en/reference/status-codes/)) |
| Panics | Every body runs inside `catch_unwind`, so a panic can never unwind across `extern "C"` — it becomes `UDA_ERR_PANIC` |
| Null pointers | Checked *before* any dereference; a null required pointer yields `UDA_ERR_INVALID_ARGUMENT` |
| Strings in | Borrowed for the duration of the call; read to the null terminator and validated as UTF-8 |
| Strings out | Allocated by Rust; free with `uda_free_string` |
| Borrows | No function returns a borrow — everything crossing the boundary is an integer or an owned pointer |
| Threading | Free functions with no global mutable state except the wake-lock registry (internally synchronised) and the thread-local last-error slot |

## Appearance

```c
int uda_detect_theme(int32_t *out_theme);              // 0 unknown, 1 dark, 2 light
int uda_get_accent_color(uint8_t *out_rgba);           // 4 bytes, R G B A
```

`uda_get_accent_color` leaves the slot untouched and returns `UDA_OK` when the platform exposes no accent colour — a zeroed slot means "none", which is not a failure.

## Wallpaper

```c
int uda_set_wallpaper(const char *path, int32_t fill_mode);  // 0 crop, 1 fill, 2 fit, 3 stretch
int uda_get_wallpaper(char **out_path);                      // free with uda_free_string
```

`uda_get_wallpaper` sets `*out_path` to null and returns `UDA_OK` when no wallpaper is configured — check the pointer, not the status.

## Media

```c
int uda_media_get_metadata(char **out_title, char **out_artist, char **out_album,
                           uint64_t *out_duration_ms, uint64_t *out_position_ms /* nullable */);
int uda_media_get_status(int32_t *out_status);   // 0 playing, 1 paused, 2 stopped, 3 unknown
int uda_media_send_command(int32_t command);     // 0..=5
```

Each of the three strings is a separate allocation, so they can be freed independently. An unpublished field is a null pointer, and a duration is `0`. `UDA_MEDIA_UNKNOWN` covers both "no player" and "state unreadable" — it is never an error. `out_position_ms` may be null to skip it.

## Notifications

```c
int uda_notify(const char *app_name, const char *title, const char *body,
               const char *icon, const char *actions, uint32_t *out_id);
```

- `app_name` is the identity: on Windows it is the AppUserModelID, and UDA registers it for an unpackaged process before the first toast. Empty or null selects `UniDesktop.Notification`.
- `icon` is a path or URI; empty means none. It is normalised into a `file://` URI on Windows.
- `actions` is a flat newline-separated list of `key\nlabel` records, e.g. `"open\n查看\nclose\n关闭"`. A trailing record without a label is dropped.
- All five strings may be null, which is treated as empty.
- `*out_id` is left untouched on failure. Windows returns `0`, because WinRT hands back no notification id.

## Wake locks

```c
int uda_wakelock_acquire(int32_t lock_type, const char *reason, uint64_t *out_handle);
int uda_wakelock_release(uint64_t handle);
```

`lock_type` is `UDA_WAKELOCK_DISPLAY` (0) or `UDA_WAKELOCK_SYSTEM` (1). Handles are process-local; releasing an unknown or already-released handle is `UDA_ERR_INVALID_ARGUMENT`, never a crash. Release each handle exactly once.

## Session & power

```c
int uda_session_capabilities(uint32_t *out_capabilities);  // bitmask of UDA_SESSION_CAP_*
int uda_session_lock(void);
int uda_session_logout(void);
int uda_session_suspend(void);
int uda_session_hibernate(void);
int uda_session_reboot(void);
int uda_session_shutdown(void);
```

The capability bits: management `1<<16`, lock `1<<17`, logout `1<<18`, suspend `1<<19`, hibernate `1<<20`, reboot `1<<21`, shutdown `1<<22`.

Query the capabilities *before* drawing any UI — five of the six actions end the user's session or stop the machine, and they must be gated behind an explicit user confirmation. `lock` is the only one safe to automate.

## System tray

```c
int uda_tray_create(const char *name, const char *tooltip, uint64_t *out_handle);
int uda_tray_set_tooltip(uint64_t handle, const char *tooltip);
int uda_tray_set_icon_path(uint64_t handle, const char *path);
int uda_tray_set_icon_rgba(uint64_t handle, uint32_t width, uint32_t height,
                           uint32_t stride, const uint8_t *data, size_t len);
int uda_tray_set_visible(uint64_t handle, int32_t visible);   // 0 hides, else shows
int uda_tray_destroy(uint64_t handle);

int uda_tray_menu_create(uint64_t *out_menu_handle);
int uda_tray_menu_add_text(uint64_t menu, const char *label,
                           UdaTrayTextCallback callback, void *user_data,
                           uint64_t *out_item_id);
int uda_tray_menu_add_checkbox(uint64_t menu, const char *label, int32_t checked,
                               UdaTrayCheckboxCallback callback, void *user_data,
                               uint64_t *out_item_id);
int uda_tray_menu_add_separator(uint64_t menu);
int uda_tray_set_menu(uint64_t tray_handle, uint64_t menu_handle);
int uda_tray_menu_destroy(uint64_t menu_handle);
```

Ownership of the tray surface:

- Handles start at `1`; `0` means "no handle".
- A handle is **single-use**: a second destroy of the same value is `UDA_ERR_INVALID_ARGUMENT` rather than a silent no-op, so a host cannot double-release a shell resource.
- A menu attached to an icon keeps the icon's own reference, so `uda_tray_menu_destroy` on the same menu is optional and does not clear the tray's rows.
- `uda_tray_set_icon_rgba` only reads `stride * height` bytes; `data` is borrowed. A buffer shorter than that is rejected before a pixel is read.
- Callbacks run on the **tray worker thread**, so they must be cheap, must not block, and must forward into the host's own loop rather than touching host UI state.

## Strings and diagnostics

```c
void        uda_free_string(char *s);          /* null is a no-op */
const char *uda_last_error_message(void);      /* owned by the library, free with uda_free_string */
const char *uda_status_message(int32_t code);  /* static, must NOT be freed */
```

`uda_last_error_message` is valid until the next UDA call on the same thread; copy it if it must outlive that.

## See also

- [Status codes](/en/reference/status-codes/) — the failure codes and their triggers
- [Python SDK](/en/reference/python-sdk/) / [Node.js SDK](/en/reference/nodejs-sdk/) — the ready-made bindings
