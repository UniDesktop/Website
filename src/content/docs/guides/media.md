---
title: 媒体播控
description: 读取当前播放曲目与控制播放器，覆盖 MPRIS v2 与 SMTC。
---

## 读取正在播放

```python
from uda import Uda

with Uda() as uda:
    track = uda.media.now_playing      # 无播放器时为 None

    if track:
        print(track.title)                        # 标题
        print(", ".join(track.artists))           # 艺人列表
        print(track.album)                        # 专辑
        print(f"{track.duration_ms} ms")          # 时长（毫秒）
    else:
        print("当前没有播放器在运行")
```

Node.js 侧：

```javascript
const uda = new Uda();
const now = uda.media.nowPlaying;     // 无播放器时为 null
if (now) {
  console.log(now.title);
  console.log(now.artists.join(', '));
  console.log(now.album);
  console.log(now.durationMs);
}
```

## 查询播放状态

```python
from uda import PlaybackStatus

status = uda.media.status      # PlaybackStatus 常量之一
```

| 值 | 含义 |
|----|------|
| `PlaybackStatus.PLAYING` | 正在播放 |
| `PlaybackStatus.PAUSED` | 已加载并暂停 |
| `PlaybackStatus.STOPPED` | 未加载，或已播放到结尾 |
| `PlaybackStatus.UNKNOWN` | 播放器报告了无法识别的状态 |

## 发送控制指令

```python
uda.media.send("play")         # 也接受 MediaCommand 常量
```

| 指令 | 常量 |
|------|------|
| `"play"` | `MediaCommand.PLAY` |
| `"pause"` | `MediaCommand.PAUSE` |
| `"play_pause"` | `MediaCommand.TOGGLE` |
| `"next"` | `MediaCommand.NEXT` |
| `"previous"` | `MediaCommand.PREVIOUS` |
| `"stop"` | `MediaCommand.STOP` |

SDK 另提供便捷方法：`uda.media.play()` / `.pause()` / `.play_pause()` / `.next()` / `.previous()` / `.stop()`。

Node.js：`uda.media.send('play_pause')`。

## 平台后端

| 平台 | 协议 | 要点 |
|------|------|------|
| Linux | MPRIS v2 over session D-Bus | 在 `org.mpris.MediaPlayer2.*` 名字中挑选**第一个正在播放**的播放器 |
| Windows | WinRT SMTC（`GlobalSystemMediaTransportControls`） | 取持有系统焦点的会话 |

Windows SMTC 有三个容易踩的细节：

1. **每个 `Try*Async()` 命令返回 `bool` 而非 `Result`。** `false` 表示会话拒绝了该命令（例如应用未启用 `Next`），`true` 只表示应用*接受*了命令——之后仍可能失败。UDA 把 `false` 映射为类型化错误，使调用方能区分「已发送」与「被拒绝」。
2. **`TimeSpan` 以 100 纳秒为单位。** 零 `Duration` 表示「未知」（直播流），会被上报为缺失而非 `Some(0)`。
3. **「没有当前会话」以 `Err` 到达，而不是 null。** 播放器的缺失看起来像一次失败，除非调用方把它当作一个值来读——这正是无播放的机器返回 `Ok(None)` / `Ok(Unknown)`、而只有命令抛出 `NotSupported` 的原因。这与 Linux 后端一致：总线上没有播放器名字时得到 `None`。

### MPRIS 元数据字典的类型差异（Linux）

MPRIS 的 `Metadata` 字典在实际实现中与规范存在偏差，读取时需按以下规则处理：

- `xesam:title` 按规范应为字符串数组，部分播放器（多为早期版本）发送单个字符串。UDA 同时接受两种形式。
- `xesam:artist` 同上。
- `mpris:length` 单位为**微秒**，UDA 转换为毫秒；`0` 表示直播流，而非时长为 0 的曲目，负值视为无效。
- 类型不符时不返回错误，退化为空值。

### 状态值映射

`status` 映射到四个值，`unknown` 是一等状态而非错误：

| 值 | 含义 |
|----|------|
| `playing` | 曲目正在推进 |
| `paused` | 已加载曲目且进度停止 |
| `stopped` | 未加载内容，或已播放到结尾 |
| `unknown` | 无会话获得焦点、播放器未发布状态，或值无法解析 |

:::caution[不要把 unknown 当作 paused]
`unknown` 表示无法判定，与「已暂停」是不同状态。把它当作 `paused` 会让 UI 在无播放器时显示错误的播放按钮。
:::

完整指令集：`play`、`pause`、`toggle`、`next`、`previous`、`stop`。

## 错误分层

| 现象 | 返回 |
|------|------|
| 没有播放器 | `now_playing` 返回 `None` / `null`，`status` 返回 `STOPPED` |
| 无 D-Bus 会话 | `UdaError`（连接失败） |
| 播放器存在但不支持某指令 | `UdaError`，携带原始失败信息 |

:::note[没有播放器属于正常状态]
「没有播放器」不是错误。`now_playing` 返回 `None`，请以该分支处理。
:::

## 当前限制

- 元数据为**一次性快照**，尚无变更监听；需要实时更新的 UI 请轮询（建议 ≥ 1 秒）。
- 多播放器时不提供选择器，UDA 自动取第一个正在播放的。

:::note[播放进度]
播放进度（当前播放到第几秒）由 `uda_media_get_metadata` 的 `out_position_ms` 出参提供，Python 与 Node.js SDK 分别暴露为 `MediaTrack.position_ms` 与 `nowPlaying.positionMs`。后端无法上报时为 `0`。
:::

## 相关文档

- [故障排查](/guides/troubleshooting/#媒体)——`now_playing` 一直为 `None` 时的排查
- [平台支持矩阵](/reference/platform-support/)——各平台的媒体后端
- [C-ABI 参考](/reference/c-abi/)——`uda_media_*` 函数签名
