---
title: C-ABI 参考
description: include/uda.h 全量导出函数：签名、参数、返回值、所有权与 Safety。
---

## 通用约定

| 规则 | 说明 |
|------|------|
| 返回值 | `int32_t`；`0` 为成功，负数为错误码（见[状态码](/reference/status-codes/)） |
| panic | 每个函数体都在 `catch_unwind` 内执行，panic 永不跨越 `extern "C"` 边界展开，而是转为 `UDA_ERR_PANIC` |
| 空指针 | 在解引用**之前**检查；必需指针为空时返回 `UDA_ERR_INVALID_ARGUMENT` |
| 字符串入参 | 调用期间借用，读取至空终止符并校验 UTF-8 |
| 字符串出参 | 由 Rust 分配，需用 `uda_free_string()` 释放 |
| 借用 | 没有任何函数返回借用——跨边界的要么是整数，要么是自有指针 |
| 线程 | 均为自由函数，无常量可变全局状态（唤醒锁注册表内部已同步，last-error 槽位为线程本地） |

- 字符串入参为 `const char *`，接受空指针，等价于空串。
- 出参字符串由库分配，调用方必须用 `uda_free_string()` 释放。
- 失败原因可通过 `uda_last_error_message()` 读取（线程本地槽位，返回指向静态缓冲的指针，**不需要释放**）。

## 状态码

| 常量 | 值 | 含义 |
|------|----|------|
| `UDA_OK` | 0 | 成功 |
| `UDA_ERR_INVALID_ARGUMENT` | -1 | 空指针、非法 UTF-8、枚举码越界 |
| `UDA_ERR_NOT_SUPPORTED` | -2 | 当前平台或会话无法提供该功能 |
| `UDA_ERR_DETECTION_FAILED` | -3 | 环境/OS 版本检测失败 |
| `UDA_ERR_IO` | -4 | 文件系统或进程派生错误 |
| `UDA_ERR_INTERNAL` | -5 | 未预期的内部错误 |
| `UDA_ERR_PANIC` | -6 | FFI 边界处兜住的 panic（正常不应出现） |

---

## 外观

### `uda_detect_theme`

```c
int32_t uda_detect_theme(int32_t *out_theme);
```

写入 `UDA_THEME_UNKNOWN`(0) / `UDA_THEME_DARK`(1) / `UDA_THEME_LIGHT`(2)。

**Safety**：`out_theme` 必须指向可写的 `int32_t`，不得为空。

### `uda_get_accent_color`

```c
int32_t uda_get_accent_color(uint8_t *out_rgba);
```

写入 R、G、B、A 四字节（各 `0..=255`）。平台无系统强调色概念时（多数 Linux 桌面）不写入缓冲区，但仍返回 `UDA_OK`——槽位为零表示「无强调色」，不是失败。

**Safety**：`out_rgba` 必须指向至少 4 字节可写空间。

---

## 壁纸

### `uda_set_wallpaper`

```c
int32_t uda_set_wallpaper(const char *path, int32_t fill_mode);
```

`fill_mode`：`UDA_FILL_CROP`(0) / `UDA_FILL_FILL`(1) / `UDA_FILL_FIT`(2) / `UDA_FILL_STRETCH`(3)。作用于所有显示器。

### `uda_get_wallpaper`

```c
int32_t uda_get_wallpaper(char **out_path);
```

`*out_path` 由库分配，需 `uda_free_string()`。未设置或不支持读取时返回 `UDA_OK` 且 `*out_path` 为 `NULL`。

**Safety**：`out_path` 不得为空；`out_path` 本身与它指向的槽位都需可写。

---

## 防休眠锁

### `uda_wakelock_acquire`

```c
int32_t uda_wakelock_acquire(int32_t lock_type,
                             const char *reason,
                             uint64_t *out_handle);
```

`lock_type`：`UDA_WAKELOCK_DISPLAY`(0) / `UDA_WAKELOCK_SYSTEM`(1)。返回句柄，`0` 不是有效值。句柄为进程本地；每个句柄只应释放一次。

### `uda_wakelock_release`

```c
int32_t uda_wakelock_release(uint64_t handle);
```

未知或已释放的句柄返回 `UDA_ERR_INVALID_ARGUMENT`，而不是静默成功——这有助于发现调用方的重复释放 bug。

---

## 通知

### `uda_notify`

```c
int32_t uda_notify(const char *app_name,
                   const char *title,
                   const char *body,
                   const char *icon,
                   const char *actions,
                   uint32_t *out_id);
```

| 参数 | 说明 |
|------|------|
| `app_name` | 发送方名。在 Windows 上即 AppUserModelID；为空时使用 `UniDesktop.Notification` |
| `title` | 单行标题 |
| `body` | 多行正文，可为空 |
| `icon` | 图标路径或 URI，可为空 |
| `actions` | 扁平化列表，格式 `"key\nlabel\nkey\nlabel"`；末尾落单的记录被丢弃 |
| `out_id` | 接收服务器分配的 id |

:::caution[Windows 平台限制]
未打包环境下 `actions` 降级为只读文本；商店环境下来源显示为宿主包名。见 `docs/internals/notification_specs.md` §3。
:::

---

## 媒体播控

### `uda_media_get_metadata`

```c
int32_t uda_media_get_metadata(char **out_title,
                               char **out_artist,
                               char **out_album,
                               uint64_t *out_duration_ms,
                               uint64_t *out_position_ms);
```

无播放器时返回 `UDA_OK`，三个字符串出参设为 `NULL`，两个时间出参设为 `0`。`out_position_ms` 可选，传 `NULL` 表示不需要该项；其余四个出参不得为空。三个字符串各自独立分配，可分别释放。播放器未发布的字段（如无专辑的电台流）为 `NULL` 而非空串，便于绑定层跳过。所有字符串需 `uda_free_string()`。

### `uda_media_get_status`

```c
int32_t uda_media_get_status(int32_t *out_status);
```

写入 `UDA_MEDIA_PLAYING`(0) / `UDA_MEDIA_PAUSED`(1) / `UDA_MEDIA_STOPPED`(2) / `UDA_MEDIA_UNKNOWN`(3)。`UNKNOWN` 同时覆盖「无播放器」与「状态不可读」，且伴随 `UDA_OK` 返回——它是一个答案，不是失败。负状态码才表示平台完全没有媒体后端。

### `uda_media_send_command`

```c
int32_t uda_media_send_command(int32_t command);
```

`command`：`UDA_MEDIA_CMD_PLAY`(0) / `PAUSE`(1) / `TOGGLE`(2) / `NEXT`(3) / `PREVIOUS`(4) / `STOP`(5)。未知码返回 `UDA_ERR_INVALID_ARGUMENT`。

---

## 会话与电源

### `uda_session_capabilities`

```c
int32_t uda_session_capabilities(uint32_t *out_capabilities);
```

写入由 `UDA_SESSION_CAP_*` 组成的位掩码，`0` 表示该平台无会话后端。

| 常量 | 值 |
|------|----|
| `UDA_SESSION_CAP_MANAGEMENT` | `0x00010000u` |
| `UDA_SESSION_CAP_LOCK` | `0x00020000u` |
| `UDA_SESSION_CAP_LOGOUT` | `0x00040000u` |
| `UDA_SESSION_CAP_SUSPEND` | `0x00080000u` |
| `UDA_SESSION_CAP_HIBERNATE` | `0x00100000u` |
| `UDA_SESSION_CAP_REBOOT` | `0x00200000u` |
| `UDA_SESSION_CAP_SHUTDOWN` | `0x00400000u` |

:::danger[破坏性动作]
`LOCK` 之外的每一个动作都会中断用户工作。查询能力位只是为了决定是否显示入口，**不**代表应该无条件调用。
:::

### 六个动作

```c
int32_t uda_session_lock(void);
int32_t uda_session_logout(void);
int32_t uda_session_suspend(void);
int32_t uda_session_hibernate(void);
int32_t uda_session_reboot(void);
int32_t uda_session_shutdown(void);
```

---

## 系统托盘

### 生命周期

```c
int32_t uda_tray_create(const char *name, const char *tooltip, uint64_t *out_handle);
int32_t uda_tray_set_tooltip(uint64_t handle, const char *tooltip);
int32_t uda_tray_set_visible(uint64_t handle, int32_t visible);
int32_t uda_tray_destroy(uint64_t handle);
```

超过 127 字符的 tooltip 会被库截断。句柄自 `1` 开始，`0` 表示「无句柄」。菜单句柄在 `uda_tray_set_menu()` 之后仍然有效：图标持有自己的引用，因此事后销毁菜单是可选的，且不会清空已设置的菜单行。回调运行在**托盘工作线程**上，必须轻量、不得阻塞，并应转发到宿主自己的事件循环，而不是直接操作宿主 UI 状态。

### 图标

```c
// 文件路径（Windows）或图标主题名（Linux）
int32_t uda_tray_set_icon_path(uint64_t handle, const char *path);

// 原始 RGBA 像素
int32_t uda_tray_set_icon_rgba(uint64_t handle,
                              uint32_t width,
                              uint32_t height,
                              uint32_t stride,
                              const uint8_t *data,
                              size_t len);
```

:::caution[set_icon_path 在 Linux 上是主题名]
SNI 语义下该值是 freedesktop 图标主题名，桌面环境会去主题目录查找。要显示自己的图片，请用 SDK 封装（它解码 PNG 后走 `set_icon_rgba`）。
:::

`set_icon_rgba` 的 `stride * height` 必须 ≤ `len`，否则返回 `UDA_ERR_INVALID_ARGUMENT`。过大的尺寸在读取第一个字节前就会被拒绝。

### 菜单

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

回调类型：

```c
typedef void (*UdaTrayTextCallback)(uint64_t item_id, void *user_data);
typedef void (*UdaTrayCheckboxCallback)(uint64_t item_id, int32_t checked, void *user_data);
```

`out_item_id` 接收该行稳定且非零的 id，回调会收到同一个值，不得为空。`label` 为空串时返回 `UDA_ERR_NOT_SUPPORTED`（空标签会渲染成不可见的行）。`callback` 可为 `NULL`，表示静默行。复选框的存储在回调执行**之前**取反，因此 `checked` 参数为新状态，菜单不会与 shell 状态漂移。分隔线无标签、无回调、无 id，故没有出参。

`menu_handle` 设为 `0` 可移除图标上的菜单。菜单句柄在 `uda_tray_set_menu()` 之后仍然有效：图标持有自己的引用，事后销毁菜单是可选的，且不会清空已设置的菜单行。

:::caution[回调线程]
回调在托盘工作线程上执行，不得阻塞或直接操作 GUI。
:::

---

## 字符串与错误

```c
void uda_free_string(char *s);              // 释放库分配的字符串；NULL 为 no-op
const char *uda_last_error_message(void);   // 线程本地诊断消息，不需释放
const char *uda_status_message(int32_t status);  // 状态码 → 静态描述，不需释放
```

## 线程模型

- 所有函数都是同步的，可从任意线程调用。
- 托盘回调运行在专用工作线程。
- 库内部为每次调用创建临时的单线程 tokio runtime（Linux 侧需要 D-Bus 连接时），因此不要求宿主持有 runtime，也不会常驻工作线程。
- FFI 边界处兜住 panic：任何 panic 转换为 `UDA_ERR_PANIC` 而不是跨 FFI 边界传播。

## 相关文档

- [状态码](/reference/status-codes/)——返回值常量与典型触发场景
- [Python SDK](/reference/python-sdk/) / [Node.js SDK](/reference/nodejs-sdk/)——基于本 ABI 的绑定
- [系统托盘](/guides/tray/)——托盘模块的上层用法
