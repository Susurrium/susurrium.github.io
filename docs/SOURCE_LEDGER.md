# 来源与复用台账

> 台账版本：1.7｜冻结日期：2026-08-27｜release-prep 更新：2026-09-02｜适用方案：[IMPLEMENTATION_PLAN.zh-CN.md](./IMPLEMENTATION_PLAN.zh-CN.md)｜状态：Phase 0 来源已锁定；Phase 1–6 已按本台账落地，当前候选的纳入/排除与 owner 决定见 [RELEASE_PREP_AUDIT.zh-CN.md](./RELEASE_PREP_AUDIT.zh-CN.md) 与 [OWNER_CONFIRMATION_RECORD.zh-CN.md](./OWNER_CONFIRMATION_RECORD.zh-CN.md)

## 1. 作用与边界

本文档回答每个模块的四个问题：从哪里来、锁定到哪个版本、直接复用到什么程度、为了本博客允许改什么。

用户已确认对列出的参考网站和组件取得所需授权，并在 2026-09-02 的 owner 工作单中确认当前候选媒体、字体、链接和位置范围。本台账仍保留公开来源、版本、哈希和必要差异，目的是保证实现可复现、后续可维护，并防止把“参考视觉”“历史封装”和“本项目新代码”混为一体。第三方许可证/授权证据仍应按 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 与 owner 记录留档；项目许可证本身不扩大素材授权。

生产站默认不热链参考站资源。已确认的例外仅限当前功能所需的 CARTO 地图、公共网易云 Meting 播放器运行时、生产 Umami、CodeTime 徽章、Waline、构建期 GitHub 贡献数据和现有友链头像；这些服务/路径在门禁中精确登记。文章正文的其他外部图片、视频、音频、iframe、脚本和样式仍应在最终发布前逐项审查，通常复制到本仓库并再次校验哈希。

## 2. 复用类型

| 类型       | 含义                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| 直接复用   | 主体 DOM、CSS、算法或组件代码保持不变，仅改导入、类型、路径和配置            |
| 略微调整   | 保留主体，只改路由、参数、响应式、生命周期、无障碍或冲突点                   |
| 混合复用   | 原站提供视觉/算法，历史项目提供 Astro 封装、状态或生命周期，本项目只接胶水层 |
| 自行开发   | 本项目特有的数据模型、路由、策略、宿主和测试；不重做参考特效                 |
| 不复用代码 | 只采用产品思路或作为视觉校准，不复制对方实现                                 |

“直接复用”不等于可以扩大远程白名单；除上述明确例外外，资源仍需本地化或取得单项确认。

## 3. 基础仓库与工具链真源

| ID                 | 对象                | 精确来源                                                                                                       | 锁定证据                                                                                                                                                                        | 实施方式                                                                 |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `BASE-ARTHALS`     | 站点骨架和测试内容  | [`zhuozhiyongde/Arthals-Ink`](https://github.com/zhuozhiyongde/Arthals-Ink)                                    | commit `15f5ad110af8ed8f38a1e506dd890d2d921f118f`；本地/远端标签 `arthals-upstream-2026-03-22`                                                                                  | 直接复用；只做已登记的 Astro 6、导航、配置和新模块适配                   |
| `BASE-PURE`        | Pure 主题运行时     | npm `astro-pure@1.4.6` / [`cworld1/astro-theme-pure`](https://github.com/cworld1/astro-theme-pure)             | npm gitHead `c2bb1155b6c0b9b339d62b8289c4c95e38528075`；integrity `sha512-m6mFcLfk69LjAOaCZX7qvwgH/ROA6xP6JzpbCT6Ns09CuKnN/vHa7Q+6az4Fd4vNi7A4WmzyfYPU7HDnb6SV+A==`；Apache-2.0 | 直接使用发布包；Astro 精确对齐 6.1.8                                     |
| `BASE-ASTRO`       | Astro               | npm `astro@6.1.8`                                                                                              | lock integrity `sha512-6fT9M12U3fpi13DiPavNKDIoBflASTSxmKTEe+zXhWtlebQuOqfOnIrMWyRmlXp+mgDsojmw+fVFG9LUTzKSog==`                                                                | 直接使用；首版不漂移版本                                                 |
| `BASE-SIGNATURE`   | Arthals 签名组件    | `BASE-ARTHALS` 的 `packages/pure/components/user/Signature.astro`                                              | Git blob `45b373ea652808539004d528b86378a2acf48071`；本地落点 `src/components/shared/Signature.astro`                                                                          | 直接复制到本地维护，因为 npm Pure 1.4.6 未导出它                         |
| `BASE-FOOTER`      | Pure Footer         | `astro-pure@1.4.6` 的 `components/basic/Footer.astro`                                                          | 本地落点 `src/components/layout/SiteFooter.astro`；对应 npm 固定版本见 `BASE-PURE`                                                                                                  | 直接复制 DOM/CSS/config 契约；仅为所有新标签页链接补 `noopener noreferrer` |
| `BASE-MEDIUM-ZOOM` | 文章图片放大运行时  | npm `medium-zoom@1.1.0` / [`francoischalifour/medium-zoom`](https://github.com/francoischalifour/medium-zoom)  | lock integrity `sha512-ewyDsp7k4InCUp3jRmwHBRFGyjBimKps/AJLjRSox+2q/2H4p/PNpQf+pwONWlJiOudkBXtbdmVbFjqyybfTmQ==`；MIT                                                           | 保留 Pure 的交互/样式契约，固定为本地 `dist/pure` 入口，不使用运行时 CDN |
| `BASE-QRCODEJS`    | 文章二维码运行时    | npm `qrcodejs@1.0.0` / [`davidshimjs/qrcodejs`](https://github.com/davidshimjs/qrcodejs)                       | lock integrity `sha512-67rj3mMBhSBepaD57qENnltO+r8rSYlqM7HGThks/BiyDAkc86sLvkKqjkqPS5v13f7tvnt6dbEf3qt7zq+BCg==`；MIT                                                           | 本地 Vite 资源加载；保留 Pure 版权区 UI，不使用其运行时 CDN              |
| `BASE-PAGES`       | GitHub Pages 工作流 | [Astro 官方 GitHub Pages 指南](https://docs.astro.build/en/guides/deploy/github/) 和 GitHub 官方 Pages Actions | `actions/checkout@v7`、`actions/setup-node@v6`、`actions/configure-pages@v6`、`actions/upload-pages-artifact@v5`、`actions/deploy-pages@v5`                                     | 官方方案配置；准备阶段仅 `workflow_dispatch`，无 `push`、无 `schedule`   |

`BASE-GITHUB-CARD`：复用 `astro-pure@1.4.6` 的 `components/advanced/GithubCard.astro` 视觉层级；本地落点为 `src/components/shared/StaticGitHubCard.astro`。实现方式为略微调整：保留仓库链接和卡片语言，移除浏览器 GitHub REST 请求，并为新标签页链接补安全 `rel`。

仓库关系：

- `origin`：`https://github.com/Susurrium/susurrium.github.io.git`
- `upstream`：`https://github.com/zhuozhiyongde/Arthals-Ink.git`
- `upstream` push URL：`DISABLED`
- `main` 与 `develop` 本轮保持不变；发布准备候选为 `codex/release-prep`，从 `8b05952ca54ca32843cdbbcc2f815b6d61a5a9be` 开始整理。

## 4. 历史项目固定快照

### 4.1 身份与恢复证据

| 项目                       | 锁定值                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| 原路径                     | `E:\code\homepage`                                                 |
| 分支                       | `codex/pure-migration`                                             |
| HEAD                       | `1e968f3b076ffb02dad45a6a5f2db216a5d9d700`                         |
| tracked diff 指纹          | `4a00654f8d7e40f7fc295016743297fb16672613`                         |
| untracked 路径清单指纹     | `0faee75a235128878fc1c19e18f9bb1e53d3a4cc`                         |
| 固定快照                   | `E:\code\homepage-snapshots\2026-08-27-pre-blog-migration`         |
| repository bundle SHA-256  | `39A2FC583856AF0F3E322C66DB8BA6E5B5B45C7A2DB5A868AC0B615831DF1040` |
| working-tree patch SHA-256 | `79E01C1EE429D5768DEB8ADBD84C399A5F5E940DE8A0E5909AB58633117258D0` |
| untracked 快照             | 49 个文件，保持相对路径                                            |

历史仓库是只读素材源。默认从上述固定快照提取；如果当前工作树的任一身份或指纹变化，必须先建立新快照和新台账记录，不能把不同时间点的代码混用在同一个 `HIST-*` 来源下。

### 4.2 历史模块索引

| ID                 | 目标用途                  | 固定快照中的主要路径                                                                                                                                                              | 复用边界                                                                 |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `HIST-ENTRANCE`    | 根路径视频入口            | `src/components/entrance/EntranceScene.astro`                                                                                                                                     | 直接复用场景、视频降级和进入流程；删除 session 跳过，导航改为 replace    |
| `HIST-MUSIC`       | 全局音乐状态              | `src/components/MusicPlayer.astro`、`src/data/music.ts`                                                                                                                          | 保留持久化和生命周期；引擎改为公共 APlayer/MetingJS 网易云歌单             |
| `HIST-SHOKA-HERO`  | Hero 的 Astro 外壳        | `src/components/effects/ShokaHero.astro`、`src/components/home/HomeRibbonLayer.astro`                                                                                             | 只复用生命周期和页面挂载；视觉核心以 LargeSkull 原站为准                 |
| `HIST-TIMELINE`    | Blog 时间线               | `src/components/home/NotesPreview.astro`                                                                                                                                          | 基本直接复用；删除 notes 双模式，只从 Blog 自动生成                      |
| `HIST-SAYINGS`     | Saying 数据和交互         | `src/components/says/SaysCollection.astro`、`SaysCard.astro`、`src/components/home/QuoteCard.astro`、`src/content/says/**`、`src/pages/says/**`                                   | 直接复用查询、随机、归档和详情方案；命名与路由适配为 Saying/Sayings      |
| `HIST-TRACES`      | Trace 数据与页面          | `src/pages/traces/**`、`src/content/notes/**`、`src/pages/notes/**`                                                                                                               | 直接复用并统一重命名；最终落到 Trace collection                          |
| `HIST-BACKDROP`    | PKU 生命周期              | `src/components/effects/GlobalBackdropEffects.astro`、`public/vendor/canvas-fluttering-ribbon.min.js`、`public/vendor/canvas-nest@1.1.3.min.js`                                   | 复用生命周期外壳和已有两层；视觉算法以锁定的 PKU 1.1.3 三层脚本为准      |
| `HIST-GEORGE-HOST` | 花瓣/点击的生命周期与过滤 | `src/components/effects/SeasonalPetals.astro`、`ClickBurst.astro`、`src/layouts/BaseLayout.astro`                                                                                 | 只复用挂载、销毁和交互过滤；不采用历史自绘视觉核心                       |
| `HIST-RESIDENCE`   | 居住地动图                | `src/components/home/ResidenceCard.astro`、`FlightOverlay.astro`、`src/scripts/residence-map.ts`、`residence-map-geometry.ts`、`src/styles/residence-map.css`、对应 e2e/spec 文档 | 几乎直接复用；只校准原站视觉、个人位置和文案                             |
| `HIST-COMPANION`   | About 小人生命周期        | `src/components/effects/ScrollCompanion.astro`                                                                                                                                    | 复用 custom element、滚动/页面切换管理；视觉素材参考来源，滚动曲线按当前项目素材和导轨校准 |
| `HIST-TESTS`       | 回归测试材料              | `tests/e2e/entrance.spec.ts`、`effects.spec.ts`、`home-ribbon.spec.ts`、`home-residence.spec.ts`、`residence-fidelity.spec.ts`、`says-about.spec.ts`、`blog-notes.spec.ts`        | 大量复用并适配最终路由和 DOM                                             |

明确不把历史 `TypewriterText.astro`、`ContributionHeatmap.astro`、`SeasonalPetals.astro` 或 `ClickBurst.astro` 的视觉核心当作最终原站真源。

### 4.3 上游 README 历史截图

`.github/assets/body.webp`、`.github/assets/header.webp` 和
`.github/assets/lighthouse-score.png` 曾随上游 README 更新提交
`fd5a9cd18b3cec43054563afaafdb57c1f2d7cf5` 提供 README 展示图。当前候选的
`README.md` 已不再引用它们，它们也不会进入 Astro 产物，因此不属于发布源或临时构建
输入；本候选将其移出工作树，原件按原路径保存在发布隔离区
`historical-readme-assets-before-remove/`，需要时可由快照或 bundle 恢复。

## 5. 外部参考实现锁定

### 5.1 LargeSkull Hero、波浪和带图卡片

| 项目        | 值                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 台账 ID     | `LS-HERO`、`LS-CARD`                                                                                                                                                                     |
| 页面        | [`https://largeskull.github.io/`](https://largeskull.github.io/)                                                                                                                         |
| 仓库        | [`LargeSkull/LargeSkull.github.io`](https://github.com/LargeSkull/LargeSkull.github.io)                                                                                                  |
| commit      | `9599a54f23cdfc4606f2f5edc07e8138e050205b`                                                                                                                                               |
| 核心文件    | `index.html` blob `94e2d7ff9bbe5094b76144947034ae69fc7384e1`；`css/app.css` blob `58ccef75ad383715983fca4ed3d78888f35be167`；`js/app.js` blob `f765979a33efbc0f86c9d0464e1ee753953e3dbe` |
| Live 一致性 | Live `index.html` 与锁定提交一致；33,752 bytes；SHA-256 `332750ae889eb00d994a9773a8064a2fc5fec11951bbdbe7cf036325a410a1e2`                                                               |
| 实施        | 原站 DOM/CSS/动画参数直接复用；`HIST-SHOKA-HERO` 只提供 Astro 生命周期；本项目只接数据、路由、主题变量和 reduced-motion                                                                  |

同一 LargeSkull 卡片视觉原语用于 Trace 内容题图卡片和 Saying 装饰图卡片；两者数据、图片池和 alt 规则保持独立。Blog 不使用该卡片。

### 5.2 xyx404 入口文字与音乐外观

| 项目        | 值                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| 台账 ID     | `XYX-TYPING`、`XYX-MUSIC-UI`                                                                                              |
| 页面        | [`https://xyx404.github.io/`](https://xyx404.github.io/)                                                                  |
| 仓库        | [`xyx404/xyx404.github.io`](https://github.com/xyx404/xyx404.github.io)                                                   |
| commit      | `d4e1efc207e106f562bcf758acececd41f7635e7`                                                                                |
| 核心文件    | `index.html` blob `0c207012b2a1f9dd51646b01de42284940e85016`                                                              |
| Live 一致性 | Live HTML 与锁定提交一致；105,797 bytes；SHA-256 `2ad74c6a3b86178ae006ccf9663a84165279c59c4e72a5f2350cca0828452c63`       |
| 参数        | 参考外观记录为 `startDelay≈300`、`typeSpeed=150`、`backSpeed=50`；本项目经需求确认固定为 `startDelay=700`、`typeSpeed=62`、`backSpeed=34`、`backDelay=1700`、`loop=true` |
| 实施        | 文字参数与可分离 DOM/CSS 直接复用并适配入口；音乐复用紧凑可见状态/交互，并接入参考站同款 APlayer/MetingJS 网易云歌单 |

原站核验时通过浮动 URL `https://cdn.cbd.int/typed.js/dist/typed.umd.js` 解析到 `typed.js@3.0.0`，资源 SHA-256 为 `b91711cbe4aca07f45801bdbed5df00191484cbbc740269723044af26c2902dc`。本项目不沿用浮动 CDN，固定为：

- `typed.js@2.1.0`
- Git commit `3daa3a4760dff3c563964ef0935b64ccfb0b22f8`
- npm integrity `sha512-bDuXEf7YcaKN4g08NMTUM6G90XU25CK3bh6U0THC/Mod/QPKlEt9g/EjvbYB8x2Qwr2p6J6I3NrsoYaVnY6wsQ==`
- MIT

这是为可复现构建和许可边界做的必要版本调整；不改变目标动画参数。

### 5.3 George 花瓣与点击粒子

George 当前定制脚本未发现可锁定的公开源码仓库，因此以 2026-08-27 的 Live 资源作为来源锁。2026-08-27 已下载到本地并逐项复核哈希。

| ID                 | 精确资源                                                                                |   字节 | SHA-256                                                            | 实施方式                                                          |
| ------------------ | --------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `GEORGE-SAKURA`    | `https://www.george-blog.top/wp-content/themes/argon/George/sakura.js`                  | 62,929 | `4c82981d16b44ea6f7c25cea1700d9a3c4a708c453b10b93616c676cc79fd17a` | 原算法直接复用；用 `HIST-GEORGE-HOST` 限定 Links、挂载/销毁和降级 |
| `GEORGE-CLICK`     | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/fireworks.js`     |  6,111 | `d505e5aeeb885dc1f2a88b7464ad12677a456ceb70038f6db02ed1e29695ea42` | 原算法直接复用并略调；新增“仅空白处”过滤                          |
| `GEORGE-TINYCOLOR` | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/tinycolor.min.js` | 14,583 | `af61a9951eda26670b81a7e33e49465f36086e92455e9b35fb19d15ab28d9d50` | 固定并本地化；字节与 tinycolor 1.4.2 官方资源一致                 |
| `GEORGE-ANIME`     | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/anime.min.js`     | 17,741 | `5cbda29ea5096ac9404c59c77493a2f467d0eb4a27f16c750b61fc0d888dd716` | 固定并本地化；内容标识 anime.js 3.2.1                             |

附加证据：`sakura.js` Last-Modified 为 `Sat, 09 Aug 2025 14:06:34 GMT`；`fireworks.js` 为 `Sun, 10 Aug 2025 12:16:17 GMT`。原点击脚本监听整个 `document` 的 `mousedown`，本项目允许的必要调整是排除链接、按钮、表单、播放器、导航、文本选择、可交互卡片和显式禁用区。

### 5.4 PKU 三层背景

来源页：[`https://pku-cs-cjw.top/about-this-wed/`](https://pku-cs-cjw.top/about-this-wed/)。2026-08-27 的页面 HTML 精确加载 `butterfly-extsrc@1.1.3`：

| ID            | 资源                                                                              | SHA-256                                                            |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PKU-RIBBON`  | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-ribbon.min.js`            | `0397a7e1a38f78ef831c1e284cf39c81263bdd022e1b462ad4c0955acf9ea3a6` |
| `PKU-FLUTTER` | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-fluttering-ribbon.min.js` | `ae4d9f6cdc03736996029a8806cc162ec4340a92fc4bfa2bc273d4a46466b68a` |
| `PKU-NEST`    | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-nest.min.js`              | `2c8951c894a012c98e55c3ba80045863c627cc5d144665bd54c286ac75f2a7dd` |

三层视觉算法直接复用并本地化；`HIST-BACKDROP` 提供已有两层和生命周期设计参考，本项目自行开发统一 `VisualEffectsHost`，负责补齐第一层、路由启停、去重和销毁。页面源码中无关脚本、配置和凭据不复制、不记录。

### 5.5 SkyWT 居住地

| 项目           | 值                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------- |
| 台账 ID        | `SKY-RESIDENCE`                                                                                |
| 视觉校准页     | [`https://skywt.cn/`](https://skywt.cn/)；核验日期 2026-08-27                                  |
| 可维护代码真源 | `HIST-RESIDENCE` 固定快照                                                                      |
| 实施           | 历史实现几乎直接复用；仅校准飞机、原点、云影、脉冲延迟、Globe 裁切、标题、控件、城市级坐标和测试 |
| 本地实现       | `src/components/home/ResidenceCard.astro`、`FlightOverlay.astro`、`src/scripts/residence-map.ts`、`residence-map-geometry.ts`、`src/assets/styles/residence-map.css` |
| 本地运行时     | `public/vendor/maplibre-gl@5.24.0/maplibre-gl.js`（1,056,837 bytes；SHA-256 `45a9b07a9189ce56054c620a947ccf41e291e58c95e9b61533b740aaa65ee5cb`）与 `maplibre-gl.css`（70,024 bytes；SHA-256 `ab1e70d59ec40465bae7e7030da2f3ccf28133fd502e62bd598eefbadfd7a732`） |
| 外部运行时     | 只允许 CARTO/OSM 地图请求；Geolocation 仅在用户打开 Globe 后由浏览器授权流程使用              |

飞机、云影、地图回退图和访客头像已经从 `HIST-RESIDENCE` 固定快照复制到 `public/media/residence/` 并由 `verify:phase5` 核验哈希。访客头像仍为 597 bytes，SHA-256 `415fb6bebdbcdafdac6031086e85cbf9ec9d4649878f1cc667b01ceaf2435351`。当前候选只公开 `39.9, 116.4` 的城市级坐标（`publicPrecision: 'city'`），该粒度已由 owner 确认；不记录或输出历史的精确居住地。MapLibre 固定为 `5.24.0`（BSD-3-Clause）：npm 依赖保留精确 TypeScript 类型，已经构建好的 UMD JS/CSS 本地惰性加载。此调整避免 Vite 在每个静态入口构建时重复处理约 1 MiB 的第三方运行时，不改变地图算法或加载时机，并兼容 GitHub Pages 的纯静态输出。

当前公开仓库中未找到与 SkyWT 当前居住地动图一一对应的可维护源码，因此不能把同作者的其他 Daydreamer/Map 组件误记为真源，也不重写为 React/Framer。

### 5.6 HanLife 热力图

| 项目    | 值                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 台账 ID | `HAN-HEATMAP`                                                                                                                                                                                 |
| 页面    | [`https://hanlife02.com/`](https://hanlife02.com/)                                                                                                                                            |
| 仓库    | [`hanlife02/Astro-star`](https://github.com/hanlife02/Astro-star)                                                                                                                             |
| commit  | `e20aad1bab5d24ce397e4bda1ec975311acd326c`                                                                                                                                                    |
| 组件    | `src/components/content/ArchiveActivityHeatmap.astro` blob `5a6aa6a0f953ba3d29aee2ce62d6d1af8f457ab9`；`src/components/home/githeatmap.astro` blob `a6c642ff1cfbb828d112a78a248daa652e59d840` |
| CSS     | `archive-activity-heatmap.css` blob `33624c97bbd76f73bcfc4d38a8f1b1af04642588`；`githeatmap.css` blob `196dee74b834832acb80c5cbed2d3889b432cb89`                                              |
| 数据    | `src/utils/github-contributions.ts` blob `c918eef3dd5c96c849d5f2adac970eff5aa4e79e`                                                                                                           |
| 实施    | 原组件结构、53 周视觉、解析和 CSS 直接复用；只适配 Astro 6、本项目样式变量、用户名 `Susurrium`、缓存与失败回退                                                                                |

最终文件为 `src/components/home/GitHubContributionHeatmap.astro`、`src/data/github-contributions.ts` 与 `src/assets/styles/github-contribution-heatmap.css`。组件在静态构建时读取 GitHub 公开 contributions HTML，进程内缓存为 6 小时；超时、结构变化或网络失败时渲染 53 周中性骨架，不伪造贡献数量，也不会让 GitHub Pages 构建失败。

首版不创建定时抓取任务，不存 GitHub Token。该组件只展示公开 GitHub 贡献，不把 Blog/Trace 伪装成 GitHub 数据。

### 5.7 Innei Timeline / 一言思路

| 项目     | 值                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| 台账 ID  | `INNEI-IDEA`                                                                                                      |
| 页面     | [`https://innei.in/`](https://innei.in/)；核验日期 2026-08-27                                                     |
| 采用内容 | 笔记时间线与一言入口的产品思路                                                                                    |
| 不采用   | 当前 Yohaku 代码、数据模型和另一种文章类型                                                                        |
| 最终实现 | Timeline 使用 `HIST-TIMELINE` 且只从 Blog 自动生成；Saying 使用 `HIST-SAYINGS`，本项目做 collection/路由/卡片适配 |

### 5.8 TNXG About 小人

| 项目     | 值                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 台账 ID  | `TNXG-COMPANION`                                                                                                                            |
| 校准页   | [`https://www.tnxg.moe/`](https://www.tnxg.moe/)；2026-08-27 重定向到 `/en`                                                                 |
| 当前素材 | `https://cdn.tnxg.top/images/cover/background_aijo_karen.webp`                                                                              |
| 素材证据 | 407,100 bytes；SHA-256 `bdfa95bf30097a9bd10500e8847c33bbf28cbf9a7013f933db3f63b5ea57f511`                                                   |
| 本地原始素材 | `public/media/effects/tnxg-background-aijo-karen.webp`；保留上述 SHA-256                                                               |
| 当前使用素材 | `public/media/effects/tracer-companion.webp`；基于项目确认的 PNG 抠图生成并将蓝色推进尾焰调整为更浅的冰蓝；SHA-256 `a68c070b24760685b2329e088edd30d951d6833154096fbb13fecfe2920c3af0` |
| 实施     | 当前 WebP 与当前滚动变换作为视觉/公式真源；`HIST-COMPANION` 提供 Astro custom element 和生命周期；本项目只做 About 路由、≥1440px、70rem 容器和层级适配 |

最终组件为 `src/components/effects/ScrollCompanion.astro`：运行时只使用当前项目的 `tracer-companion.webp`；针对新素材右侧主体和窄导轨，采用最大右移 `22%`、最大旋转 `10deg` 的连续轻微漂移，退出时间轴按 About 实际可滚动距离的 `88%` 动态计算，并在时间轴 `68%` 后以平滑长尾淡出；路由切换、页面隐藏、bfcache、减少动画和阈值宽度变化都会暂停或释放更新。

不使用 TNXG 旧公开仓库代码，不增加原需求没有的呼吸或点击互动。实现阶段只提取当前发布 bundle 中与滚动变换直接相关的最小片段；其他 Next.js 应用代码不复制。

## 6. LargeSkull 首版占位图锁

下列图片只用于首版开发占位。实现阶段下载本地并复核哈希；正式发布前由用户资源替换。

| 顺序 | 来源 URL                                              | SHA-256                                                            |
| ---: | ----------------------------------------------------- | ------------------------------------------------------------------ |
|    1 | `https://s2.loli.net/2025/05/25/KovNu7AWXHlkqIP.jpg`  | `e77260690388904ca6f0ca2b19f5f3206468f97b6d7272a06c920df1d9cb0e6d` |
|    2 | `https://s2.loli.net/2024/10/09/JRETbWIesO9BSDk.webp` | `319f2a38009f13e8ae5f1c6cbea9013b74e5408f29b6958fa1ac1571e991b8ca` |
|    3 | `https://s2.loli.net/2024/10/09/zOf8drntiSX1pIm.jpg`  | `010664a398386fa5f387764e9c41c28f2bc729151915229dc172fbe11abb9909` |
|    4 | `https://s2.loli.net/2024/10/09/9fEdCwYiGLz1Rme.webp` | `235f105fcc5bbf6ea9acb69f2b75def95fb8f79867be0beafc27fa153da35dc4` |
|    5 | `https://s2.loli.net/2024/10/09/RVXtojLyeF4PQ5l.webp` | `d7f20af3e09c32dd6a1494af6a02383599218131a2796a71c33e4f796bd615c6` |
|    6 | `https://s2.loli.net/2024/10/09/CuX1zTdq9PLv7ek.png`  | `277c5db8d016a8993467481d88ad840926adc8d54f8b49de5213e047476f6c0f` |

历史首版可暂时同时填入 `heroSlides`、`sayingDecorativeImages` 和 `traceFallbackImages`，但三个数组必须独立，不能共享业务语义。当前用户图库配置见下方 §6.1.1。

### 6.1 Phase 2 本地化核验

2026-08-27 已下载并逐项复核原始 SHA-256；历史回归构建保留并核验下列本地路径，不再热链 `loli.net`。两张大 JPEG 仍低于 2 MiB 硬门槛，当前候选继续保留它们作为历史回归/回滚夹具，资源门禁会提示推荐尺寸警告；它们不属于当前 Home 媒体入口。

| 顺序 | 本地路径                                |    字节数 | SHA-256                                                            |
| ---: | --------------------------------------- | --------: | ------------------------------------------------------------------ |
|    1 | `public/images/largeskull/hero-01.jpg`  | 1,915,733 | `e77260690388904ca6f0ca2b19f5f3206468f97b6d7272a06c920df1d9cb0e6d` |
|    2 | `public/images/largeskull/hero-02.webp` |   190,834 | `319f2a38009f13e8ae5f1c6cbea9013b74e5408f29b6958fa1ac1571e991b8ca` |
|    3 | `public/images/largeskull/hero-03.jpg`  | 1,845,471 | `010664a398386fa5f387764e9c41c28f2bc729151915229dc172fbe11abb9909` |
|    4 | `public/images/largeskull/hero-04.webp` |    57,512 | `235f105fcc5bbf6ea9acb69f2b75def95fb8f79867be0beafc27fa153da35dc4` |
|    5 | `public/images/largeskull/hero-05.webp` |   110,742 | `d7f20af3e09c32dd6a1494af6a02383599218131a2796a71c33e4f796bd615c6` |
|    6 | `public/images/largeskull/hero-06.png`  |   735,786 | `277c5db8d016a8993467481d88ad840926adc8d54f8b49de5213e047476f6c0f` |

实现文件：`src/data/home-media.ts`（三个独立资源池与稳定分配策略）、`src/components/cards/ContentCard.astro`（页面覆盖 → 类型默认 → 安全回退的唯一策略宿主）、`src/components/home/HeroGallery.astro`（原 Hero / wave DOM 与时序）、`src/components/cards/MediaCard.astro`（原 `.segments` 斜边卡片）。必要适配仅包括 Astro 局部样式、当前主题变量、无障碍的单一链接语义、原站 767px/容器响应式和 `prefers-reduced-motion`；无日期 Saying 以内容 ID 作为固定归档键。

### 6.1.1 当前用户图库（2026-08-30）

用户已确认将 `E:\UserData\Desktop\blog_image` 中的全部 54 张图片投入当前本地候选，并在 owner 工作单中确认当前候选的媒体公开范围。原图统一转为 WebP（保持原始构图，宽度上限 1920px）并写入 `public/images/home-media/`；因此生产页面不再依赖桌面路径。图中第三方角色/Logo/水印的来源证据仍应随 owner 记录留档。三组资源池在 `src/data/home-media.ts` 中保持独立：

| 资源池 | 数量 | 当前配置 |
| ------ | ---: | -------- |
| `heroSlides` | 6 | `thumb-1920-1381117` → `43935854_p0_master1200` → `thumb-1920-949729` → `thumb-1920-725406` → `thumb-1920-986446` → `thumb-1920-556375` |
| `sayingDecorativeImages` | 34 | 角色/插画/图形类图片，包含用户保留的 Logo、水印和文字 |
| `traceFallbackImages` | 20 | 环境/风景类图片，按 Trace 内容 ID 稳定哈希选择 |

Saying 与 Trace 两个清单的并集恰好覆盖 54 个源文件且各自不重复；Hero 允许复用其中六张。旧 `public/images/largeskull/hero-*` 文件及其 SHA 锁仍保留，仅用于历史回归和回滚，不再作为当前 Home 媒体入口。

#### 6.1.2 斜边方向参考与裁切人工审核

本轮不再按卡片索引奇偶交替 `is-even`。`src/data/home-media.ts` 的
`cardCutSideByFilename` 以文件名为键，为每张本地素材固定 `left` 或 `right`：

- `right`：桌面卡片图片留在左侧，右上角斜切；手机卡片右下角斜切。
- `left`：桌面卡片图片移到右侧，左下角斜切；手机卡片左下角斜切。

方向依据主体位置、文字/Logo 是否需要保留、视觉动线以及被切角落的信息密度逐张判断，
不是为了凑数量或保持交替。当前 54 张的固定清单如下（`L`/`R` 与预览文件名一致）：

| 方向 | 文件名 |
| ---- | ------ |
| L | `thumb-1920-1100118`、`thumb-1920-1305986`、`thumb-1920-1348996`、`thumb-1920-206280`、`thumb-1920-25430`、`thumb-1920-330278`、`thumb-1920-411820`、`thumb-1920-556375`、`thumb-1920-582756`、`thumb-1920-655990`、`thumb-1920-689823`、`thumb-1920-695454`、`thumb-1920-704042`、`thumb-1920-705101`、`thumb-1920-710137`、`thumb-1920-719184`、`thumb-1920-723809`、`thumb-1920-725406`、`thumb-1920-769914`、`thumb-1920-806818`、`thumb-1920-83606`、`thumb-1920-893435`、`thumb-1920-919958`、`thumb-1920-920085`、`thumb-1920-939173`、`thumb-1920-949729`、`thumb-1920-986446` |
| R | `13534647_p0_master1200`、`43935854_p0_master1200`、`85970602_p0_master1200`、`riki32-naruto-7203819`、`thumb-1920-1083849`、`thumb-1920-1110448`、`thumb-1920-1199807`、`thumb-1920-1377699`、`thumb-1920-1381117`、`thumb-1920-432644`、`thumb-1920-444982`、`thumb-1920-476288`、`thumb-1920-484717`、`thumb-1920-568874`、`thumb-1920-608170`、`thumb-1920-655989`、`thumb-1920-672421`、`thumb-1920-704341`、`thumb-1920-704565`、`thumb-1920-705691`、`thumb-1920-729590`、`thumb-1920-76071`、`thumb-1920-888035`、`thumb-1920-905838`、`thumb-1920-916541`、`thumb-1920-919724`、`thumb-1920-934905` |

相同文件无论出现在 Hero 复用、Saying 随机卡片还是 Trace 无图回退卡片中，都沿用同一条
**装饰斜边**参考；Hero 本身仍是完整背景，不应用斜边卡片规则。桌面/手机四组历史预览见
`artifacts/home-media-card-previews/09`–`12`。

2026-08-31 起，图片源内容的左右裁切不再由这张斜边表推断。原因是卡片内部的
`object-fit: cover` 会根据卡片比例裁掉源图内容；例如左侧人物的宽图在方形 Trace 卡片中使用居中裁切时，人物可能先于斜边被裁掉。新增本地统一裁剪工作台
`/tools/card-crop-review`（实现见 `src/components/tools/CardCropEditor.astro` 与
`src/scripts/card-crop-editor.ts`）：

- 每个唯一文件只出现一次，即使它同时被 Saying、Trace 或 Hero 复用；
- 提供“斜边在左/斜边在右”两个与正式 LargeSkull 媒体框同步的框，斜边方向与图片焦点分离；导出里的 640×448 仅是稳定的参考坐标；
- 图片可在框下拖动、滚轮/滑杆缩放，并记录 `cover/contain` 适配方式；
- 可确认一个框、确认两个框都可以，或明确标记两个框都不合适；
- 草稿保存在浏览器并可导出/导入，确认前不会改变正式页面。

确认后的 JSON 用 `scripts/apply-card-crops.mjs` 校验源图、计算标准化 crop rectangle，写入
`src/data/card-crop-selections.generated.ts`。`MediaCard` 通过 `ResolvedCardImage.crop`
读取已应用记录，没有记录时继续使用旧的文件名斜边和安全回退。完整操作说明见
`docs/CARD_CROP_REVIEW.md`。工作台源代码作为内部开发工具随候选保留，但不等同于访问控制；
当前候选不提交 `card-preview-*` 文章、截图或其他预览产物。

### 6.2 Phase 3 根路径入口媒体本地化核验

入口媒体来自 `HIST-ENTRANCE` 的固定历史快照（`E:\code\homepage-snapshots\2026-08-27-pre-blog-migration`），在 2026-08-27 复制至 `public/media/` 后逐项复核。生产根路径仅引用下列本地资源；不保留视频、海报或 Typed.js 的运行时热链。

| 本地路径                                 |  字节数 | SHA-256                                                            |
| ---------------------------------------- | ------: | ------------------------------------------------------------------ |
| `public/media/entrance-loop-waterfall.webm`        | 994,319 | `ff6488f821cb87d4cbd77770701d8895eba61d8d6f23f52f3ee8709da11f3598` |
| `public/media/entrance-loop-waterfall.mp4`         | 3,399,550 | `991e7e350af89c3550f206411a1be46a56042badf05e60ac40b2da5e5c1d59c7` |
| `public/media/entrance-loop-waterfall-mobile.webm` | 409,629 | `a0d777e8446c1b3ff9e5a0ff969de5b11a91596d8b46bc46f8e2f59995b3fae2` |
| `public/media/entrance-loop-waterfall-mobile.mp4`  | 1,318,413 | `706182ed35e8ad6064aeabb2d9e3c3dceffc68fc9b15a8014ae4b29df770dec6` |
| `public/media/entrance-waterfall-poster.webp`      | 209,276 | `39d7ee3b42f3fb48d4d546973418bf564061c67a9549e6a98b738494febfd2a4` |
| `public/media/entrance-waterfall-poster-mobile.webp` | 49,362 | `f946e566bfd85df014f7f8dc6a202d9f9832fb1bc7a734109cb6780e2ceafabf` |

旧的 `entrance-loop*` / `entrance-poster.webp` 文件已从本候选删除，仅作为历史快照信息记录，不应与本候选的 waterfall 媒体混用；原件保存在发布隔离区，可按快照/bundle 恢复。上述新媒体的 owner 决定已记录，来源/许可证据仍按 `THIRD_PARTY_NOTICES.md` 和 owner 记录留档。

实现文件为 `src/data/entrance.ts`、`src/components/entrance/EntranceScene.astro`、`src/components/entrance/EntranceTypedText.astro` 和 `src/layouts/EntranceLayout.astro`。`HIST-ENTRANCE` 的场景、视频降级、页面可见性与键盘进入逻辑直接复用；必要差异为删除 `sessionStorage` 跳过、用 `location.replace()` 进入 `/home`、补充 `AbortController` 清理与缓存视频 `play()` 成功后的就绪状态。`XYX-TYPING` 的锁定文字参数以本地 `typed.js@2.1.0` 实现，版本和完整性见 §5.2。

音乐首版暂使用参考站的公共网易云歌单 `12812783625`。`src/data/music.ts` 集中声明服务端、歌单 ID、Meting API 模板及播放参数；`MusicPlayer` 只负责持久化壳层、无障碍状态和详情页紧凑模式，APlayer/MetingJS 负责按需取得音频、封面与歌词。后续切换到第二个参考站歌单时，只需把 ID 改为 `8152976493`。

`src/components/reading/ArticleImageZoom.astro` 保留 `BASE-PURE` 的图片放大契约和样式，但以锁定的 `BASE-MEDIUM-ZOOM` 本地 `dist/pure` 入口替换其运行时 CDN。该库本身不提供 `destroy()`，所以本项目只在每个浏览器文档建立一个共享实例；当前文章在进入时 `attach()`，在 `astro:before-preparation`、`astro:before-swap` 与元素断开时关闭并 `detach()`，避免 ClientRouter 跨页留下遮罩或累积全局监听器。

`src/components/reading/ContentCopyright.astro` 为 `BASE-PURE` 版权区的本地适配：保留其 DOM/UI，二维码改由锁定的 `BASE-QRCODEJS` 经 Vite 同源资源加载，并以 custom element 管理复制、展开、加载和断连。`src/components/ViewTransitionRejectionGuard.astro` 位于 `ClientRouter` 前，仅消费 Chromium 对已完成 DOM 交换的原生 View Transition 所产生的三类已知、可恢复 `ready` 拒绝（`AbortError`、`InvalidStateError`、`TimeoutError`）；其他 Promise 拒绝仍正常冒泡。

### 6.3 Phase 4 全局效果本地化核验

2026-08-27 已将 §5.3 与 §5.4 锁定的原始脚本原样复制到 `public/vendor/`，逐项复核字节数和 SHA-256。生产效果运行时只加载以下同源路径，不热链 PKU、George、anime.js 或 tinycolor。

| 台账 ID            | 本地路径                                                  | 字节数 | SHA-256                                                            |
| ------------------ | --------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `PKU-RIBBON`       | `public/vendor/pku/canvas-ribbon@1.1.3.min.js`            |  1,235 | `0397a7e1a38f78ef831c1e284cf39c81263bdd022e1b462ad4c0955acf9ea3a6` |
| `PKU-FLUTTER`      | `public/vendor/pku/canvas-fluttering-ribbon@1.1.3.min.js` |  5,928 | `ae4d9f6cdc03736996029a8806cc162ec4340a92fc4bfa2bc273d4a46466b68a` |
| `PKU-NEST`         | `public/vendor/pku/canvas-nest@1.1.3.min.js`              |  1,805 | `2c8951c894a012c98e55c3ba80045863c627cc5d144665bd54c286ac75f2a7dd` |
| `GEORGE-SAKURA`    | `public/vendor/george/sakura.js`                          | 62,929 | `4c82981d16b44ea6f7c25cea1700d9a3c4a708c453b10b93616c676cc79fd17a` |
| `GEORGE-CLICK`     | `public/vendor/george/fireworks.js`                       |  6,111 | `d505e5aeeb885dc1f2a88b7464ad12677a456ceb70038f6db02ed1e29695ea42` |
| `GEORGE-TINYCOLOR` | `public/vendor/george/tinycolor.min.js`                   | 14,583 | `af61a9951eda26670b81a7e33e49465f36086e92455e9b35fb19d15ab28d9d50` |
| `GEORGE-ANIME`     | `public/vendor/george/anime.min.js`                       | 17,741 | `5cbda29ea5096ac9404c59c77493a2f467d0eb4a27f16c750b61fc0d888dd716` |

`src/components/effects/VisualEffectsHost.astro` 是本项目自行开发的生命周期宿主；它不改写原始算法，而是在短生命周期、同源 iframe 中按原顺序执行脚本。删除 iframe 即可同步清理原脚本建立的 canvas、RAF、定时器和监听器，适配 Astro ClientRouter 的页面切换。`HIST-BACKDROP`、`HIST-GEORGE-HOST` 只提供这类挂载、清理和交互过滤的设计参考。

这些字节锁定的原始脚本作为静态资源，不参与 Astro 的 TypeScript 语义分析；`verify:phase4` 负责它们的 SHA-256、生产产物存在性、原始参数、profile 映射和无运行时热链检查，避免为了消除诊断提示而改写来源字节。

PKU 保留原页参数：`canvas-ribbon` 的 `mobile=false`、`zIndex=-1`、`alpha=0.6`、`size=150`、`data-click=false`，`canvas-fluttering-ribbon` 的 `mobile=false`，以及 `canvas-nest` 的 `mobile=false`、`zIndex=-1`、`color=0,0,255`、`opacity=0.7`、`count=99`。宿主只把父页面的鼠标、离开和滚动状态转发给隔离上下文，使原算法保有页面级的交互输入；宽度小于 768px、粗指针设备或用户启用减少动画时不创建 PKU 层。

George 花瓣在 Links 原样保留 50 个 sprite 花瓣；点击效果按原 `tinycolor → anime → fireworks` 顺序执行，并保留原 20 粒子加圆环视觉。本项目只在父页面过滤链接、按钮、表单、播放器、导航、文字选择和卡片等非空白交互区，再把允许的空白点击桥接给原脚本。

页面 profile 为：`standard`（PKU + 点击粒子）、`reading`（全关）、`links`（花瓣 + 点击粒子）、`about`（PKU + 点击粒子 + TNXG 小人）。所有未单列的普通页面使用 `standard`。`prefers-reduced-motion`、页面隐藏、离开、ClientRouter 切换和设备条件变化都会释放效果实例；恢复条件满足后按当前 profile 重建。

## 7. 完整模块分配闭环

| 最终模块                                      | 原网站/上游直接部分                                             | 历史项目直接部分                      | 本项目自行开发或略调                                          |
| --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Header、Footer、主题、文章阅读、TOC、搜索外壳 | `BASE-ARTHALS` / `BASE-PURE` / `BASE-FOOTER`                    | 无                                    | Astro 6 类型、目标配置、导航顺序、外链安全属性和个人信息略调   |
| Blog 列表/详情/无图卡片                       | `BASE-ARTHALS`                                                  | 无                                    | schema 兼容、候选允许空集合；视觉不重做                       |
| Blog 文章图片放大                             | `BASE-PURE` 交互/样式契约，`BASE-MEDIUM-ZOOM` 本地 pure runtime | 无                                    | 每文 attach/detach、导航前关闭、无 CDN                        |
| Blog 版权区与二维码                           | `BASE-PURE` 版权区 UI，`BASE-QRCODEJS` 本地 runtime             | 无                                    | custom element 生命周期、同源延迟加载、无 CDN                 |
| Trace 列表/详情                               | `LS-CARD` 视觉                                                  | `HIST-TRACES` 数据和页面              | Trace collection、内容图/稳定回退策略、路由适配               |
| Saying 归档/详情/Home 卡片                    | `LS-CARD` 视觉；`INNEI-IDEA` 只供思路                           | `HIST-SAYINGS` 查询、随机、归档和详情 | Saying collection、两个入口、空状态和装饰图分配               |
| Home Hero/波浪                                | `LS-HERO` DOM/CSS/参数                                          | `HIST-SHOKA-HERO` 生命周期            | 数据配置、主题/reduced-motion 适配                            |
| 最近 Blog/Traces 双栏                         | 无                                                              | 历史 Home 查询和布局                  | 各取 3 条、Blog 左/Trace 右及响应式略调                       |
| Blog Timeline                                 | `INNEI-IDEA` 只供思路                                           | `HIST-TIMELINE`                       | 改为 Blog-only，无独立路由                                    |
| `/` 视频入口                                  | `XYX-TYPING` 动画参数                                           | `HIST-ENTRANCE`                       | 每次访问播放、replace 导航、noindex/canonical、文案和本地媒体 |
| 全局音乐                                      | `XYX-MUSIC-UI` 可分离视觉、参考站 APlayer/MetingJS 契约          | `HIST-MUSIC` 生命周期                  | `#nav-music` 视觉壳、公共网易云歌单、持久单例、详情紧凑控制   |
| Links 花瓣                                    | `GEORGE-SAKURA` 原算法                                          | `HIST-GEORGE-HOST` 生命周期设计参考   | 本地 iframe 宿主、Links-only、DPR/reduced-motion 适配         |
| 点击粒子                                      | `GEORGE-CLICK` 原算法与依赖                                     | `HIST-GEORGE-HOST` 过滤/生命周期参考  | 本地 iframe 宿主、空白区域过滤、profile 和销毁                |
| PKU 全局背景                                  | `PKU-*` 原三层算法                                              | `HIST-BACKDROP` 生命周期设计参考      | `VisualEffectsHost`、隔离执行、补第一层和 profile 映射        |
| SkyWT 居住地                                  | 原站只供视觉校准                                                | `HIST-RESIDENCE` 几乎全部实现         | 个人坐标/文案、细节校准、CARTO/定位失败回退                   |
| GitHub 热力图                                 | `HAN-HEATMAP` 组件、解析、CSS                                   | 历史实现不采用                        | 用户名、缓存、构建失败回退；无 schedule                       |
| About 小人                                    | `TNXG-COMPANION` 素材和当前项目校准曲线                         | `HIST-COMPANION` 生命周期             | About-only、≥1440px、层级和清理                               |
| 卡片 presentation 解析器                      | 无                                                              | 无                                    | 自行开发纯策略；页面覆盖 > 内容默认 > 安全回退                |
| 图片顺序/随机/哈希回退                        | 无                                                              | Saying 随机逻辑可复用                 | 自行开发可测试纯函数                                          |
| CI、资源门禁和 Pages                          | `BASE-PAGES` 官方方案                                           | 无                                    | 固定 Node/Bun、frozen lock、手动部署和无 schedule             |

## 8. 实现阶段提取门禁

每个台账条目进入开发前必须依次完成：

1. 校验来源 commit、URL 或历史快照身份没有变化。
2. 只提取该条目需要的最小文件或代码段。
3. 非例外的外部脚本和素材复制到本地；不保留未审查的生产热链。
4. 对本地副本记录相对路径、SHA-256 和来源台账 ID。
5. 在代码文件头或邻近注释记录来源 URL、commit/版本、复用类型和必要差异。
6. 运行该模块测试、页面生命周期测试、外部请求扫描和视觉对照。
7. 来源变化时先更新本台账，再更新代码。

不得从网页源码复制与目标效果无关的分析脚本、广告、评论、统计、API 配置、密钥或用户数据。

## 9. 当前已落地与尚未提取

已经实际落地：

- `BASE-ARTHALS` Fork、远端和冻结标签。
- `BASE-PURE` / `BASE-ASTRO` 目标依赖和 lockfile。
- `BASE-SIGNATURE` 本地组件。
- `BASE-PAGES` CI 与手动部署工作流。
- 历史项目的只读恢复快照。
- 所有外部来源的版本、URL 或视觉校准边界。
- Phase 1 的三类内容模型、静态路由、锁定六项主导航和测试内容。
- Phase 2 的 LargeSkull 锁定图、Hero/波浪、统一卡片策略、随机 Saying、双栏与 Blog Timeline。
- Phase 3 的可重复根入口、本地视频/Typed.js、持久公共网易云音乐壳、详情紧凑模式、局部生命周期清理、本地二维码与图片放大运行时。
- Phase 3 的生产构建、三套静态契约检查、实际 Chrome 点击回归和同源网络扫描。
- Phase 4 的 PKU 三层、George 点击粒子、Links 花瓣、本地化原始 vendor 脚本和统一 `VisualEffectsHost` 生命周期。
- Phase 4 的 SHA/产物静态核验、profile 策略测试、生产预览中的桌面/移动/减少动画/多次 ClientRouter 路由回归及同源网络扫描。
- Phase 5 的 SkyWT 居住地完整历史模块（本地资源、MapLibre 惰性运行时、Globe/定位/地图回退和 ClientRouter 清理）。
- Phase 5 的 HanLife 53 周 GitHub 热力图（公开 HTML 解析、6 小时缓存和非声明性中性骨架回退）。
- Phase 5 的本地 TNXG 小人素材、当前滚动公式、About-only 响应式与生命周期外壳；About Saying 入口已随 Phase 2 的 Saying 路由落地。
- Phase 5 的静态 SHA/产物检查和专业模块纯函数回归；浏览器回归结果随本阶段提交记录。
- Phase 6 的 `BASE-FOOTER` 本地安全适配、noindex/sitemap/RSS 修复、生产产物审计、严格发布门禁和移动端目录浏览器回归。

最终个人位置、头像、文案和真实内容的本轮决定已按 owner 工作单落地（93 个历史内容不恢复）；未来新增内容仍按发布清单逐项确认。在严格发布门禁通过且用户另行确认上线前，不得启用自动部署或将测试产物发布到 Pages。
