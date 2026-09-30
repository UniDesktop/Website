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
| Windows | WinRT SMTC | 取当前会话的 `TryGetMediaProperties` |

### 元数据字典的坑（Linux）

MPRIS 的 `Metadata` 字典类型并不诚实：

- `xesam:title` 按规范应是字符串数组，但部分播放器（常见于早期版本）发的是单个字符串。UDA 两种都接受。
- `xesam:artist` 同理。
- `mpris:length` 是**微秒**，UDA 转换为毫秒；`0` 表示直播流而非 0 毫秒的曲目，负数视为无效。
- 类型不符时不报错，退化为空值。

## 错误分层

| 现象 | 返回 |
|------|------|
| 没有播放器 | `now_playing` 返回 `None` / `null`，`status` 返回 `STOPPED` |
| 无 D-Bus 会话 | `UdaError`（连接失败） |
| 播放器存在但不支持某指令 | `UdaError`，携带原始失败信息 |

「没有播放器」不是错误——这是正常状态，请用 `None` 分支处理。

## 当前限制

- 元数据为**一次性快照**，尚无变更监听；需要实时更新的 UI 请轮询（建议 ≥ 1 秒）。
- 播放**进度**（当前播放到第几秒）不通过 C-ABI 暴露。
- 多播放器时不提供选择器，UDA 自动取第一个正在播放的。
