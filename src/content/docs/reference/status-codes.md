---
title: 状态码
description: 六个状态码常量、典型的触发场景与诊断消息读取。
---

## 常量表

| 常量 | 值 | 含义 |
|------|----|------|
| `UDA_OK` | `0` | 调用成功 |
| `UDA_ERR_INVALID_ARGUMENT` | `-1` | 空指针、非法 UTF-8、枚举码越界 |
| `UDA_ERR_NOT_SUPPORTED` | `-2` | 当前平台或会话无法提供该功能 |
| `UDA_ERR_DETECTION_FAILED` | `-3` | 环境或 OS 版本检测失败 |
| `UDA_ERR_IO` | `-4` | 文件系统错误或进程派生失败 |
| `UDA_ERR_INTERNAL` | `-5` | 未预期的内部错误 |
| `UDA_ERR_PANIC` | `-6` | FFI 边界兜住的 panic（正常不应出现） |

所有失败码均为**负数**，因此 `status != 0` 即可判定失败。

## 典型触发场景

### `UDA_ERR_INVALID_ARGUMENT`

| 调用 | 场景 |
|------|------|
| `uda_detect_theme` | `out_theme` 为空指针 |
| `uda_set_wallpaper` | 路径为空串；`fill_mode` 不在 0..3 |
| `uda_media_send_command` | `command` 不在 0..5 |
| `uda_wakelock_release` | 句柄为 0，或是本进程未签发的句柄 |
| `uda_tray_*` | 句柄为 0 / 已销毁；把菜单句柄传给图标函数 |
| `uda_tray_set_icon_rgba` | `stride * height` 超过 `len`；尺寸为 0 或溢出 |
| `uda_session_capabilities` | `out_capabilities` 为空指针 |

### `UDA_ERR_NOT_SUPPORTED`

| 调用 | 场景 |
|------|------|
| 壁纸 | 无 Portal、无 GNOME/KDE/Hyprland/Sway IPC，且 `feh`/`nitrogen` 都不在 `PATH` |
| 强调色 | 平台没有系统级强调色概念（KDE、XFCE、Wayland 平铺 WM） |
| toast 身份 | 无法解析任何 AppUserModelID（`ELEMENT_NOT_FOUND`） |
| 会话动作 | polkit 拒绝（`AccessDenied` / `NotAuthorized` / `InteractiveAuthorizationRequired`），或系统关闭了休眠 |
| 关机/重启 | 账户无 `SeShutdownPrivilege`（`ERROR_PRIVILEGE_NOT_HELD`） |

### `UDA_ERR_DETECTION_FAILED`

OS 版本查询失败（Windows 上是 `RtlGetVersion`，Linux 上读发行版信息失败）。

### `UDA_ERR_IO`

壁纸文件不可读；`xdg-*` 工具启动失败；D-Bus socket 连接层错误。

### `UDA_ERR_INTERNAL`

后端返回了无法归类的错误，例如 WinRT 调用失败、`tokio` runtime 创建失败。

:::note[Rust 侧的错误类型]
相同的错误条件在 Rust 中以 [`UdaError`](https://docs.rs/uda-core) 变体呈现。状态码是类型化错误在 ABI 上的投影，两者始终一致。
:::

### `UDA_ERR_PANIC`

库内某处发生了 panic 并被 FFI 边界兜住。**这是 bug**——请带上 `uda_last_error_message()` 的输出提 issue。

## 读取诊断消息

失败的调用会在**线程本地**槽位里留下一条人类可读的原因：

```c
int32_t status = uda_set_wallpaper("/nope.png", UDA_FILL_FIT);
if (status != UDA_OK) {
    fprintf(stderr, "失败: %s\n", uda_last_error_message());
}
```

槽位是线程本地的：只反映**该线程上最后一次**失败。多线程环境下请在失败后立即读取。

两个 SDK 都会自动读取诊断消息并拼进异常：

```python
try:
    uda.set_wallpaper("/nope.png", FillMode.FIT)
except UdaError as e:
    print(e.status, e)      # (-2, 'Feature not supported: ...')
```

```javascript
try {
  uda.setWallpaper('/nope.png', 'fit');
} catch (e) {
  console.error(e.message);   // 已含诊断消息
}
```

## 把状态码翻译成文字

```c
printf("%s\n", uda_status_message(status));
```

返回指向静态字符串的指针，**不需要释放**，也**不是**线程本地槽位的内容——它是该状态码的通用描述，不含本次失败的具体原因。

## SDK 侧映射

| 状态码 | Python | Node.js |
|--------|--------|---------|
| 任意非 0 | 抛出 `UdaError(status, message)` | 抛出 `Error`，消息含诊断文本 |
| `UDA_ERR_NOT_SUPPORTED` | `UdaError.status == -2` | 同上 |

两个 SDK 都**不**把「没有播放器」或「平台无强调色」当异常——它们在对应的 API 上返回 `None` / `null`。只有真正的失败才走异常路径。

## 相关文档

- [C-ABI 参考](/reference/c-abi/)——完整函数表与所有权规则
- [故障排查](/guides/troubleshooting/)——症状、原因与处置
