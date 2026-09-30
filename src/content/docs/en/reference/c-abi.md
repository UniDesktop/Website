---
title: C-ABI reference
description: Every exported function, its parameters, out-parameters, ownership rules and safety contract.
---

The stable ABI in `include/uda.h`, implemented by `crates/uda-ffi`. Python and Node.js both bind to this surface, so it changes rarely and only in ABI-compatible ways.

## Status codes

| Constant | Value | Meaning |
|---|---|---|
| `UDA_OK` | 0 | the call succeeded |
| `UDA_ERR_INVALID_ARGUMENT` | -1 | a null pointer, invalid UTF-8, or an out-of-range enum code |
| `UDA_ERR_NOT_SUPPORTED` | -2 | the current platform or session cannot provide the feature |
| `UDA_ERR_DETECTION_FAILED` | -3 | environment or OS-version detection failed |
| `UDA_ERR_IO` | -4 | a filesystem error, or a process could not be spawned |
| `UDA_ERR_INTERNAL` | -5 | an unexpected internal error |
| `UDA_ERR_PANIC` | -6 | a panic caught at the FFI boundary (should never happen) |

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

### `uda_detect_theme`

```c
int32_t uda_detect_theme(int32_t *out_theme);
```

Writes `UDA_THEME_UNKNOWN`(0) / `UDA_THEME_DARK`(1) / `UDA_THEME_LIGHT`(2).

**Safety**: `out_theme` must point to a writable `int32_t` and must not be null.

### `uda_get_accent_color`

```c
int32_t uda_get_accent_color(uint8_t *out_rgba);
```

Writes R, G, B and A (each `0..=255`) to the four bytes at `out_rgba`. A platform that exposes no accent colour — most Linux desktops — leaves the bytes untouched and still returns `UDA_OK`, so a zeroed slot means "no accent", not failure.

**Safety**: `out_rgba` must point to four writable `uint8_t` values and must not be null.

## Wallpaper

### `uda_set_wallpaper`

```c
int32_t uda_set_wallpaper(const char *path, int32_t fill_mode);
```

`fill_mode` is `UDA_FILL_CROP`(0) / `UDA_FILL_FILL`(1) / `UDA_FILL_FIT`(2) / `UDA_FILL_STRETCH`(3). Applies to every monitor.

### `uda_get_wallpaper`

```c
int32_t uda_get_wallpaper(char **out_path);
```

`*out_path` is allocated by the library and must be released with `uda_free_string()`. When no wallpaper is set, or the platform cannot read one, the function returns `UDA_OK` with `*out_path` set to `NULL` — check the pointer, not the status.

**Safety**: `out_path` must not be null, and both it and the slot it points to must be writable.

## Media playback control

### `uda_media_get_metadata`

```c
int32_t uda_media_get_metadata(char **out_title,
                               char **out_artist,
                               char **out_album,
                               uint64_t *out_duration_ms,
                               uint64_t *out_position_ms);
```

When no player is running it returns `UDA_OK` with the three string out-parameters set to `NULL` and both time out-parameters set to `0`. `out_position_ms` is optional — pass `NULL` to skip it; the other four must not be null. Each of the three strings is a separate allocation, so they can be freed independently. A field the player does not publish (a radio stream with no album) is `NULL` rather than an empty string, letting a binding skip it. Free every string with `uda_free_string()`.

### `uda_media_get_status`

```c
int32_t uda_media_get_status(int32_t *out_status);
```

Writes `UDA_MEDIA_PLAYING`(0) / `UDA_MEDIA_PAUSED`(1) / `UDA_MEDIA_STOPPED`(2) / `UDA_MEDIA_UNKNOWN`(3). `UNKNOWN` covers both "no player" and "state unreadable" and is reported with `UDA_OK` — it is an answer, not a failure. A negative status code means the platform has no media backend at all.

### `uda_media_send_command`

```c
int32_t uda_media_send_command(int32_t command);
```

`command` is `UDA_MEDIA_CMD_PLAY`(0) / `PAUSE`(1) / `TOGGLE`(2) / `NEXT`(3) / `PREVIOUS`(4) / `STOP`(5). An unknown code returns `UDA_ERR_INVALID_ARGUMENT`.

## Notifications

### `uda_notify`

```c
int32_t uda_notify(const char *app_name,
                   const char *title,
                   const char *body,
                   const char *icon,
                   const char *actions,
                   uint32_t *out_id);
```

- `app_name` is the identity: on Windows it is the AppUserModelID, and UDA registers it for an unpackaged process before the first toast. Empty or null selects `UniDesktop.Notification`.
- `icon` is a path or URI; empty means none. It is normalised into a `file://` URI on Windows.
- `actions` is a flat newline-separated list of `key\nlabel` records, e.g. `"open\n查看\nclose\n关闭"`. A trailing record without a label is dropped.
- All five strings may be null, which is treated as empty.
- `*out_id` is left untouched on failure. Windows returns `0`, because WinRT hands back no notification id.

## Wake locks

### `uda_wakelock_acquire`

```c
int32_t uda_wakelock_acquire(int32_t lock_type,
                             const char *reason,
                             uint64_t *out_handle);
```

`lock_type` is `UDA_WAKELOCK_DISPLAY`(0) / `UDA_WAKELOCK_SYSTEM`(1). Returns a handle; `0` is not a valid value. Handles are process-local; release each handle exactly once.

### `uda_wakelock_release`

```c
int32_t uda_wakelock_release(uint64_t handle);
```

An unknown or already-released handle returns `UDA_ERR_INVALID_ARGUMENT` rather than a silent success — this helps a host discover its own double-release bug.

## Session & power

### `uda_session_capabilities`

```c
int32_t uda_session_capabilities(uint32_t *out_capabilities);
```

Writes a bitmask of `UDA_SESSION_CAP_*`; `0` means the platform has no session backend.

| Constant | Value |
|---|---|
| `UDA_SESSION_CAP_MANAGEMENT` | `0x00010000u` |
| `UDA_SESSION_CAP_LOCK` | `0x00020000u` |
| `UDA_SESSION_CAP_LOGOUT` | `0x00040000u` |
| `UDA_SESSION_CAP_SUSPEND` | `0x00080000u` |
| `UDA_SESSION_CAP_HIBERNATE` | `0x00100000u` |
| `UDA_SESSION_CAP_REBOOT` | `0x00200000u` |
| `UDA_SESSION_CAP_SHUTDOWN` | `0x00400000u` |

:::danger[Destructive actions]
Every action except `LOCK` interrupts the user's work. Querying a capability bit only decides whether an entry is shown — it does **not** mean the action should be called unconditionally.
:::

### The six actions

```c
int32_t uda_session_lock(void);
int32_t uda_session_logout(void);
int32_t uda_session_suspend(void);
int32_t uda_session_hibernate(void);
int32_t uda_session_reboot(void);
int32_t uda_session_shutdown(void);
```

## System tray

### Lifecycle

```c
int32_t uda_tray_create(const char *name, const char *tooltip, uint64_t *out_handle);
int32_t uda_tray_set_tooltip(uint64_t handle, const char *tooltip);
int32_t uda_tray_set_visible(uint64_t handle, int32_t visible);   // 0 hides, else shows
int32_t uda_tray_destroy(uint64_t handle);
```

A tooltip longer than 127 `char`s is truncated by the library. Handles start at `1`; `0` means "no handle".

### Icons

```c
// a file path (Windows) or an icon-theme name (Linux)
int32_t uda_tray_set_icon_path(uint64_t handle, const char *path);

// raw RGBA pixels
int32_t uda_tray_set_icon_rgba(uint64_t handle,
                               uint32_t width,
                               uint32_t height,
                               uint32_t stride,
                               const uint8_t *data,
                               size_t len);
```

:::caution[`set_icon_path` is a theme name on Linux]
Under SNI semantics the value is a freedesktop icon-theme name and the desktop environment resolves it against its theme directories. To show your own image, use the SDK wrapper, which decodes a PNG and submits pixels through `set_icon_rgba`.
:::

`set_icon_rgba` requires `stride * height <= len`, otherwise it returns `UDA_ERR_INVALID_ARGUMENT`. An oversized size is rejected before the first byte is read.

### Menu

```c
int32_t uda_tray_menu_create(uint64_t *out_menu_handle);

int32_t uda_tray_menu_add_text(uint64_t menu_handle,
                               const char *label,
                               UdaTrayTextCallback callback,
                               void *user_data,
                               uint64_t *out_item_id);

int32_t uda_tray_menu_add_checkbox(uint64_t menu_handle,
                                   const char *label,
                                   int32_t checked,
                                   UdaTrayCheckboxCallback callback,
                                   void *user_data,
                                   uint64_t *out_item_id);

int32_t uda_tray_menu_add_separator(uint64_t menu_handle);
int32_t uda_tray_set_menu(uint64_t tray_handle, uint64_t menu_handle);
int32_t uda_tray_menu_destroy(uint64_t menu_handle);
```

Callback types:

```c
typedef void (*UdaTrayTextCallback)(uint64_t item_id, void *user_data);
typedef void (*UdaTrayCheckboxCallback)(uint64_t item_id, int32_t checked, void *user_data);
```

`out_item_id` receives the row's stable, non-zero id; the callback gets the same value. It must not be null. A blank `label` returns `UDA_ERR_NOT_SUPPORTED`, because it would render an invisible row. `callback` may be `NULL` for a silent row. The checkbox's stored value is inverted *before* `callback` runs, so the `checked` argument is the new state and the menu cannot drift out of sync with the shell. A separator has no label, no callback and no id, so there is no out-parameter.

Setting `menu_handle` to `0` removes the icon's menu. The menu handle stays valid after `uda_tray_set_menu()`: the icon holds its own reference, so destroying the menu afterwards is optional and does not clear the rows.

:::caution[Callback thread]
Callbacks run on the tray worker thread; they must be cheap, must not block, and must forward into the host's own loop rather than touching host UI state.
:::

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
