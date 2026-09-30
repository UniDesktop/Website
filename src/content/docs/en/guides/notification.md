---
title: Notifications
description: Sending native notifications with icons, urgency and actions, on FreeDesktop and WinRT toasts.
---

## Sending a notification

```python
from uda import Uda

with Uda() as uda:
    uda.notify("构建完成", "所有测试均通过。")
```

```javascript
uda.notify('构建完成', '所有测试均通过。');
```

## The four parameters

| Parameter | Meaning |
|---|---|
| `title` | single-line title |
| `body` | multi-line detail; may be an empty string |
| `icon` | icon path or URI; may be an empty string |
| `actions` | a `{key: label}` map of buttons; see below |

## The fields

| Field | Meaning |
|---|---|
| `app_name` | the sending application. On Windows this is the toast identity (the AppUserModelID). |
| `replaces_id` | `0` for a new notification; otherwise the id to replace. Windows has no replace, so this is ignored there. |
| `app_icon` | a path or URI for the card's picture; empty means none. |
| `summary` | the one-line title. |
| `body` | the multi-line body. |
| `actions` | `key` / `label` pairs rendered as buttons where the platform allows it. |
| `expire_timeout` | milliseconds; `0` is the server default, `-1` never expires. |
| `urgency` | `low`, `normal` or `critical`. |

Any string may be null in the C-ABI, which is treated as empty.

## App identity on Windows

A packaged (MSIX) application is addressed by its package identity. A classic Win32 process has none, so the parameterless `CreateToastNotifier()` fails with `ELEMENT_NOT_FOUND` and **no toast ever appears** — which is what an unpackaged `node script.js` hits.

UDA fixes it two ways, and **both are required**:

1. `CreateToastNotifierWithId(app_name)` addresses the toast to an explicit id instead of letting WinRT resolve one from the process. This is the call that actually succeeds for an unpackaged binary.
2. `SetCurrentProcessExplicitAppUserModelID(app_name)` records the same id on the process, registered once, so the shell can match it when deciding where to display the toast. A host that already set its own AUMID keeps it — overwriting it would break that host's activation routing.

Neither needs a Start-menu shortcut, so a plain `node script.js` or a Python interpreter shows a native toast. Leaving `app_name` empty selects the generic `UniDesktop.Notification` identity.

You can probe the outcome with `WindowsNotificationManager::availability()`, which reports the platform's `NotificationSetting` — `DisabledForApplication` for a process whose toasts are switched off, and a `NotSupported` error for one with no identity at all.

## Icons

`app_icon` is the *caller's* bitmap, which is separate from the icon Windows draws for the toast's identity (the small square in the card's top-left corner, taken from the AUMID registration). The two are independent, and an unpackaged process has no identity icon at all, so the `<image>` node has to be filled for any picture to appear.

The template therefore varies with the input, because the two shapes have different schemas: `ToastImageAndText02` carries the `<image>` node this fill needs, `ToastText02` does not.

`src` accepts a filesystem path, a `file://` URI or an `http(s)://` URL. A plain Windows path is converted to a `file://` URI because the notification platform resolves the attribute relative to the *shell's* context, not the sender's working directory, so a bare `C:\pics\a.png` is not reliably located. A value that already carries a scheme passes through untouched, so a caller that already built a URI is not double-prefixed.

Only the *syntax* is decided — the file's existence is deliberately not checked. A typo then produces a card without a picture, which is the same degradation an empty value already gets, rather than a hard failure.

## Urgency

`critical` is delivered immediately and may override the screen lock where the platform allows it. `low` suppresses or minimises the card. On Linux the value travels as the `urgency` hint; on Windows it selects the toast's audio and duration.

## Cross-platform comparison

| Platform | Action buttons | Source line |
|---|---|---|
| Linux (any DE) | ✅ full support | the caller's `app_name` |
| Windows, unpackaged host | ⚠️ degrades to read-only text | the AUMID registered from the caller's `app_name` |
| Windows, MSIX-packaged host | ✅ available (the host registers its own activator) | the package identity |

## Windows limitations

- **Action buttons.** Toast buttons require the `actions` content plus an activated handler that only a packaged app can register, so `Notification::actions` is accepted for trait parity but is not surfaced as buttons in an unpackaged host — the notification degrades to a read-only text card.
- **Progress.** The FreeDesktop progress concept has no direct toast equivalent; it is intentionally ignored rather than approximated.
- **Toast source name.** On a host the shell has already bound to a package identity (for example a Microsoft Store runtime), the card's source line shows that package family name and cannot be overridden.

The full protocol mapping, including package identity and action-button constraints, is in `docs/internals/notification_specs.md`.

## A complete example

```python
import sys
from pathlib import Path

from uda import Uda

APP_ICON = Path(__file__).parent.parent / "icons" / "UniDesktop_3D_transparent_mini.png"

def main() -> int:
    if not APP_ICON.is_file():
        print(f"icon not found: {APP_ICON}", file=sys.stderr)
        return 1

    with Uda() as uda:
        uda.notify(
            title="A greeting from UDA",
            body="This is a system notification sent through the UniDesktop API.",
            icon=str(APP_ICON),
            actions={"open": "View details", "later": "Remind me later"},
            app_name="UDA Notification Demo",
        )
    return 0
```

## See also

- [Troubleshooting](/en/guides/troubleshooting/#notifications) — when no toast appears
- [C-ABI: uda_notify](/en/reference/c-abi/#notifications) — the flat parameter list
- [Platform support](/en/reference/platform-support/) — the per-desktop differences
