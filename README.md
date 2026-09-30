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

线上地址：[https://unidesktop.github.io/](https://unidesktop.github.io/)


## 目录结构

```
.
├── public/                     # 静态资源，原样拷贝到站点根（favicon.png）
├── src/
│   ├── assets/                 # 构建期处理的图片（首页 hero 图标、顶栏 logo）
│   └── content/docs/           # 全部文档，root 目录即默认语言（中文）
│       ├── en/                 # 英文页（.md / .mdx）
│       └── （其余为中文页，直接位于 docs 根下）
├── astro.config.mjs            # 站点标题、logo、favicon、sidebar、locale 配置
└── package.json
```

约定：

- 每个 `.md` / `.mdx` 文件即一个路由，路径与文件名一致；`index.mdx` 是该目录的 landing page。
- frontmatter `description` 若包含英文冒号，必须加引号，否则 js-yaml 解析会报 `bad indentation of a mapping entry`。
- 首页使用 `template: splash`，`hero.image.file` 指向 `src/assets/` 下的图片，由 Starlight 自动裁剪尺寸并产出深浅色两套资源。
- sidebar 四个分组均为 `autogenerate`，新增页面放进对应目录即可自动出现在导航里，无需改配置。
- 站内互链可写绝对路径（站点部署在域名根，无需 locale 之外的额外前缀）：中文页写 `/guides/tray/`，英文页写 `/en/reference/c-abi/`；从中文首页链到英文树则写 `/en/`。

## 本地开发

需要 Node.js 20+ 与 npm。所有命令在仓库根目录执行：

| 命令 | 作用 |
| :--- | :--- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器，默认 `http://localhost:4321` |
| `npm run build` | 产出静态站点到 `dist/` |
| `npm run preview` | 本地预览构建产物，部署前自查 |

## 部署流程

仓库通过 GitHub Pages 发布到 `https://unidesktop.github.io/`（站点根，无子路径）：

1. 在 `master` 上完成改动并 `npm run build` 验证通过。
2. 推送 `master`，由 `.github/workflows/deploy.yml` 构建 `dist/` 并发布到 Pages。
3. 上线后抽查：根路径、语言切换、四个 sidebar 分组、页内锚点与站内互链。

### 根路径与语言

`astro.config.mjs` 把中文站声明为 **`root` locale**（`defaultLocale: 'root'`，`locales: { root: {...}, en: {...} }`），中文内容直接位于 `src/content/docs/` 根下。于是：

- `src/content/docs/index.mdx` → `/`，**根路径直连中文首页，无需任何跳转页**
- `src/content/docs/guides/tray.md` → `/guides/tray/`
- 英文树保留在 `src/content/docs/en/` → `/en/…`

Starlight 据此自行生成 Astro 的 i18n 路由，并接管 404 兜底：未匹配的 URL 由注入的 `[...slug]` 路由渲染**主题化 404 页面**，而非 Astro 默认页。

> Astro 自带的 `redirectToDefaultLocale` 无法替代该配置：Starlight 推导 i18n 路由时把它固定为 `false`（见 `@astrojs/starlight/dist/utils/i18n.js` 的 `getAstroI18nConfig`）。

### 为什么不使用 `base`

站点部署在域名根而非 `/Website/` 子路径：Starlight 只会为**它自己生成**的链接（sidebar、分页、`hreflang`）添加 `base`，正文里手写的绝对路径（如 `/en/guides/tray/`）会被原样输出。一旦使用 `base: '/Website/'`，这些链接会指向用户主页根并 404。部署在域名根让所有手写路径天然正确。

> 若将来确需子路径部署，需把手写链接全部改为可被 base 化的形式，或在 `astro.config.mjs` 注册一个 rehype 插件统一改写。

### 部署工作流要点

| 步骤 | 作用 |
| :--- | :--- |
| `withastro/action@v3` | 安装依赖并执行 `astro build` 产出 `dist/` |
| `touch dist/.nojekyll` | 关闭 Pages 的 Jekyll 处理。Astro 的静态资源目录名为 `_astro`，下划线开头会被 Jekyll 忽略，导致页面无样式、无脚本 |
| `actions/configure-pages@v5` | 初始化 Pages 运行环境并导出部署所需的输出 |
| `actions/upload-pages-artifact@v3` + `path: ./dist` | 显式声明上传产物为 Astro 输出根，保证 `/en/`、`/zh-cn/` 等子路径按原样发布 |
| `actions/deploy-pages@v4` | 发布到 `github-pages` 环境 |

## 内容维护规范

- **双语同步**：`en/` 的每个页面都必须在中文树（`src/content/docs/` 根下的对应分组）有对应页，且 frontmatter 的 `title` 与正文结构保持一致；不允许只更新一侧。
- **命名口径**：项目名统一写作 `UniDesktop API`（缩写 `UDA`），不得再使用旧名。
- **新增页面**：放入对应分组目录，frontmatter 补齐 `title` 与 `description`，然后确认它在两侧导航中都可见。
- **示例代码**：与 SDK 仓库 `examples/` 的实际调用保持一致，改 API 时必须同步文档。

## 相关链接

- 文档站：[https://unidesktop.github.io/](https://unidesktop.github.io/)
- SDK 仓库：[https://github.com/UniDesktop/SDK](https://github.com/UniDesktop/SDK)
- Starlight 文档：[https://starlight.astro.build/](https://starlight.astro.build/)
