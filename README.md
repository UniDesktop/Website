<div align="center">

  
# <image src="./src/assets/mini.png" height="30"/>  UniDesktop Website

UniDesktop API（UDA）官方文档站，基于 [Astro](https://astro.build) + [Starlight](https://starlight.astro.build) 构建。

[Main Repo](https://github.com/UniDesktop/SDK)

</div>

## 站点定位

本站是 UDA 的官方文档源：安装引导、能力与降级模型、按模块的 API 参考、平台支持矩阵、排障手册与协议细节。

内容按四个 sidebar 分组组织，且 `en/` 与 `zh-cn/` 两棵目录逐页镜像：

| 分组 | 内容 |
|------|------|
| `getting-started` | 安装、从源码构建、Hello desktop |
| `guides` | 外观、壁纸、通知、托盘、媒体、会话、WakeLock、能力与降级、排障 |
| `reference` | C-ABI、状态码、平台支持矩阵、Python / Node.js SDK |
| `internals` | 架构、降级引擎、协议细节（Portal / SNI / DBusMenu / NotifyIcon）、贡献指南 |

线上地址：[https://unidesktop.github.io/Website/](https://unidesktop.github.io/Website/)


## 目录结构

```
.
├── public/                     # 静态资源，原样拷贝到站点根（favicon.png）
├── src/
│   ├── assets/                 # 构建期处理的图片（首页 hero 图标、顶栏 logo）
│   └── content/docs/           # 全部文档，按 locale 分目录
│       ├── en/                 # 英文页（.md / .mdx）
│       └── zh-cn/              # 简体中文页，defaultLocale
├── astro.config.mjs            # 站点标题、logo、favicon、sidebar、locale 配置
└── package.json
```

约定：

- 每个 `.md` / `.mdx` 文件即一个路由，路径与文件名一致；`index.mdx` 是该目录的 landing page。
- frontmatter `description` 若包含英文冒号，必须加引号，否则 js-yaml 解析会报 `bad indentation of a mapping entry`。
- 首页使用 `template: splash`，`hero.image.file` 指向 `src/assets/` 下的图片，由 Starlight 自动裁剪尺寸并产出深浅色两套资源。
- sidebar 四个分组均为 `autogenerate`，新增页面放进对应目录即可自动出现在导航里，无需改配置。
- 站内互链写绝对路径并带 locale 前缀，例如 `/zh-cn/guides/tray/`、`/en/reference/c-abi/`。

## 本地开发

需要 Node.js 20+ 与 npm。所有命令在仓库根目录执行：

| 命令 | 作用 |
| :--- | :--- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器，默认 `http://localhost:4321` |
| `npm run build` | 产出静态站点到 `dist/` |
| `npm run preview` | 本地预览构建产物，部署前自查 |

## 部署流程

仓库通过 GitHub Pages 发布到 `https://unidesktop.github.io/Website/`：

1. 在 `master` 上完成改动并 `npm run build` 验证通过。
2. 推送 `master`，由仓库的 Pages 设置将 `dist/` 发布到线上。
3. 上线后抽查：首页 hero、语言切换、四个 sidebar 分组、页内锚点与站内互链。

`astro.config.mjs` 中的 `defaultLocale` 为 `zh-cn`，因此根路径 `/` 直接渲染中文首页，英文站位于 `/en/`。

## 内容维护规范

- **双语同步**：`en/` 的每个页面都必须在 `zh-cn/` 有对应页，且 frontmatter 的 `title` 与正文结构保持一致；不允许只更新一侧。
- **命名口径**：项目名统一写作 `UniDesktop API`（缩写 `UDA`），不得再使用旧名。
- **新增页面**：放入对应分组目录，frontmatter 补齐 `title` 与 `description`，然后确认它在两侧导航中都可见。
- **示例代码**：与 SDK 仓库 `examples/` 的实际调用保持一致，改 API 时必须同步文档。

## 相关链接

- 文档站：[https://unidesktop.github.io/Website/](https://unidesktop.github.io/Website/)
- SDK 仓库：[https://github.com/UniDesktop/SDK](https://github.com/UniDesktop/SDK)
- Starlight 文档：[https://starlight.astro.build/](https://starlight.astro.build/)
