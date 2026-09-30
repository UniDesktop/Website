---
title: Media playback control
description: Reading what is playing and driving the active player, on MPRIS v2 and SMTC.
---

## Reading what is playing

```python
from uda import Uda

with Uda() as uda:
    track = uda.media.now_playing        # None when nothing is playing
    if track:
        print(f"{track.title} — {track.artist}")
        print(track.album, track.duration_ms, "ms")
    print(uda.media.status)              # 'playing' | 'paused' | 'stopped' | 'unknown'
```

```javascript
const track = uda.media.nowPlaying;      // null when nothing is playing
if (track) console.log(`${track.title} — ${track.artist}`);
```

Every field is owned and pre-joined for display: MPRIS publishes `xesam:artist` as an *array*, but a UI wants one string, so the backend performs the join and the core struct stays free of the wire types. An unpublished field is an empty string — a radio stream often has no album.

## Sending commands

```python
uda.media.send("play")
uda.media.send("pause")
uda.media.send("toggle")      # switch between playing and paused
uda.media.send("next")
uda.media.send("previous")
uda.media.send("stop")
```

The full command set: `play`, `pause`, `toggle`, `next`, `previous`, `stop`.

## Playback status

`status` maps onto four values, with `unknown` as a first-class state rather than an error:

| Value | Meaning |
|---|---|
| `playing` | a track is actively progressing |
| `paused` | a track is selected and progress is halted |
| `stopped` | nothing is loaded, or playback reached the end |
| `unknown` | no session has focus, the player published nothing, or the value was unparseable |

Never treat `unknown` as `paused`.

## Platform backends

| Platform | Protocol | Notes |
|---|---|---|
| Linux | MPRIS v2 over the session bus | any player exposing `org.mpris.MediaPlayer2.*` |
| Windows | WinRT SMTC (`GlobalSystemMediaTransportControls`) | reports the session holding system focus |

Three SMTC quirks worth knowing, because they cost hours when missed:

1. **Every `Try*Async()` command returns `bool`, not a `Result`.** `false` means the session refused the command (for example `Next` when the app does not enable it), while `true` only means the app *accepted* it — it can still fail afterwards. UDA maps `false` to a typed error so a caller can tell "sent" from "refused".
2. **`TimeSpan` is in 100-nanosecond ticks.** A zero `Duration` means "unknown" (a live stream), and is reported as absent rather than `Some(0)`.
3. **"No current session" arrives as an `Err`, not a null.** The *absence* of a player looks like a failure unless the caller reads it as a value — which is exactly why a machine with nothing playing answers `Ok(None)` / `Ok(Unknown)` and only commands raise `NotSupported`. This matches the Linux backend, where a session bus with no player name yields `None`.

## What counts as a failed command

A player that refuses a command (pausing an already-paused stream, `Next` when the app disables the button) is still a **successful call**: the platform cannot distinguish "declined" from "done", and reporting an error would make a perfectly normal toggle look like a failure.

Only a genuine transport failure — no session at all — produces an error.

## See also

- [Troubleshooting](/en/guides/troubleshooting/#media) — when `now_playing` is always `None`
- [Platform support](/en/reference/platform-support/) — per-desktop coverage
