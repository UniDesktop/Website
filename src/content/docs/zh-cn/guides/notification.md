---
title: 系统通知
description: 标题、正文、图标与动作按钮，以及 Windows 平台的两项限制。
---

## 基本用法

```python
from uda import Uda

with Uda() as uda:
    uda.notify(
        title="下载完成",
        body="report.pdf 已保存到 ~/Downloads",
        icon="/usr/share/icons/report.png",
    )
```

### 四个参数

| 参数 | 说明 |
|------|------|
| `title` | 单行标题，必填 |
| `body` | 多行正文，可为空串 |
| `icon` | 图标路径或 URI，可为空串 |
| `actions` | 按钮表 `{key: label}`，见下文 |

## 图标

图标写进通知卡片内。Linux 侧由通知服务器解释（路径、URI 或图标主题名皆可）；Windows 侧会被规范化为 `file://` URI 后填入 toast 模板的 `<image>` 节点。

```python
uda.notify("构建成功", "共 12 个目标", icon="/home/me/Pictures/ok.png")
```

:::caution[相对路径]
请传绝对路径。UDA 不把相对路径解析到某个固定基准目录——进程工作目录变化会让同一份代码行为不同。
:::

## 紧急级别与过期时间

Rust trait 与 D-Bus 层支持 `Urgency`（Low / Normal / Critical）与 `expire_timeout`，但 **C-ABI 层的 `uda_notify` 使用默认值**：紧急度为 Normal，过期时间由系统决定。

需要自定义这两项时，请直接使用 Rust trait：

```rust
Notification {
    urgency: Urgency::Critical,
    expire_timeout: 5000,
    ..Default::default()
}
```

## 动作按钮的平台差异（重要）

:::danger[Windows 未打包环境：按钮不可见]
toast 按钮要求 XML 内含 `actions` 内容，并且有一个**已注册的 COM 激活器**在用户点击时唤醒。该激活器依赖注册表中的 `CLSID` / `AppUserModelID` 关联，只有 MSIX 打包应用能可靠注册。

未打包的脚本环境（`python script.py`、`node script.js`）无法完成注册，因此 `actions` 会被**静默降级**：通知以只读文本卡片正常显示，`notify()` 依然返回成功，但用户看不到任何按钮。
:::

:::danger[Windows 商店环境：来源显示为包名]
通过 Microsoft Store 安装的 Python / Node.js 等运行时带有 Package Identity。shell 已把进程绑定到包身份，`SetCurrentProcessExplicitAppUserModelID` 无法覆盖它，`CreateToastNotifierWithId(custom_id)` 也不改变已解析的身份。

结果是通知卡片顶部的来源显示为**包族名**，例如 `PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0`，而不是你的应用名。
:::

完整说明见 `docs/internals/notification_specs.md` §3。

### 跨平台对照

| 平台 | 动作按钮 | 来源显示 |
|------|----------|----------|
| Linux（任意 DE） | ✅ 完整支持 | 调用方 `app_name` |
| Windows + 未打包宿主 | ⚠️ 降级为只读文本 | 调用方 `app_name` 注册的 AUMID |
| Windows + MSIX 打包宿主 | ✅ 可用（宿主需自注册激活器） | 包身份 |

`app_name` 在 Windows 上就是 AppUserModelID。未打包进程没有该身份，所以 UDA 会在弹第一条 toast 前用 `app_name` 注册一个；留空则使用通用身份 `UniDesktop.Notification`。

## 完整示例

```python
import sys
from pathlib import Path

from uda import Uda

APP_ICON = Path(__file__).parent.parent / "icons" / "UniDesktop_3D_transparent_mini.png"

def main() -> int:
    if not APP_ICON.is_file():
        print(f"未找到图标 {APP_ICON}", file=sys.stderr)
        return 1

    with Uda() as uda:
        uda.notify(
            title="来自 UDA 的问候",
            body="这是一条通过 UniDesktop API 发出的系统通知。",
            icon=str(APP_ICON),
            actions={"open": "查看详情", "later": "稍后提醒"},
            app_name="UDA Notification Demo",
        )
    return 0
```
