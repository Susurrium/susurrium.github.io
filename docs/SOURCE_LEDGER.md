# 来源与复用台账

> 台账版本：1.0｜冻结日期：2026-08-27｜适用方案：[IMPLEMENTATION_PLAN.zh-CN.md](./IMPLEMENTATION_PLAN.zh-CN.md)｜状态：Phase 0 来源已锁定；组件代码将在对应开发阶段按本台账提取

## 1. 作用与边界

本文档回答每个模块的四个问题：从哪里来、锁定到哪个版本、直接复用到什么程度、为了本博客允许改什么。

用户已确认对列出的参考网站和组件取得所需授权。本台账仍保留公开来源、版本、哈希和必要差异，目的是保证实现可复现、后续可维护，并防止把“参考视觉”“历史封装”和“本项目新代码”混为一体。

生产站默认不热链参考站资源。除明确允许的 CARTO 地图瓦片外，外部脚本、图片、视频、音频和 sprite 都应在对应开发阶段复制到本仓库、再次校验哈希，并在代码邻近注释引用台账 ID。

## 2. 复用类型

| 类型       | 含义                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| 直接复用   | 主体 DOM、CSS、算法或组件代码保持不变，仅改导入、类型、路径和配置            |
| 略微调整   | 保留主体，只改路由、参数、响应式、生命周期、无障碍或冲突点                   |
| 混合复用   | 原站提供视觉/算法，历史项目提供 Astro 封装、状态或生命周期，本项目只接胶水层 |
| 自行开发   | 本项目特有的数据模型、路由、策略、宿主和测试；不重做参考特效                 |
| 不复用代码 | 只采用产品思路或作为视觉校准，不复制对方实现                                 |

“直接复用”不等于生产热链；资源仍需本地化。

## 3. 基础仓库与工具链真源

| ID               | 对象                | 精确来源                                                                                                       | 锁定证据                                                                                                                                                                        | 实施方式                                                               |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `BASE-ARTHALS`   | 站点骨架和测试内容  | [`zhuozhiyongde/Arthals-Ink`](https://github.com/zhuozhiyongde/Arthals-Ink)                                    | commit `15f5ad110af8ed8f38a1e506dd890d2d921f118f`；本地/远端标签 `arthals-upstream-2026-03-22`                                                                                  | 直接复用；只做已登记的 Astro 6、导航、配置和新模块适配                 |
| `BASE-PURE`      | Pure 主题运行时     | npm `astro-pure@1.4.6` / [`cworld1/astro-theme-pure`](https://github.com/cworld1/astro-theme-pure)             | npm gitHead `c2bb1155b6c0b9b339d62b8289c4c95e38528075`；integrity `sha512-m6mFcLfk69LjAOaCZX7qvwgH/ROA6xP6JzpbCT6Ns09CuKnN/vHa7Q+6az4Fd4vNi7A4WmzyfYPU7HDnb6SV+A==`；Apache-2.0 | 直接使用发布包；Astro 精确对齐 6.1.8                                   |
| `BASE-ASTRO`     | Astro               | npm `astro@6.1.8`                                                                                              | lock integrity `sha512-6fT9M12U3fpi13DiPavNKDIoBflASTSxmKTEe+zXhWtlebQuOqfOnIrMWyRmlXp+mgDsojmw+fVFG9LUTzKSog==`                                                                | 直接使用；首版不漂移版本                                               |
| `BASE-SIGNATURE` | Arthals 签名组件    | `BASE-ARTHALS` 的 `packages/pure/components/user/Signature.astro`                                              | Git blob `45b373ea652808539004d528b86378a2acf48071`；本地落点 `src/components/arthals/Signature.astro`                                                                          | 直接复制到本地维护，因为 npm Pure 1.4.6 未导出它                       |
| `BASE-PAGES`     | GitHub Pages 工作流 | [Astro 官方 GitHub Pages 指南](https://docs.astro.build/en/guides/deploy/github/) 和 GitHub 官方 Pages Actions | `actions/checkout@v7`、`actions/setup-node@v6`、`actions/configure-pages@v6`、`actions/upload-pages-artifact@v5`、`actions/deploy-pages@v5`                                     | 官方方案配置；准备阶段仅 `workflow_dispatch`，无 `push`、无 `schedule` |

仓库关系：

- `origin`：`https://github.com/Susurrium/susurrium.github.io.git`
- `upstream`：`https://github.com/zhuozhiyongde/Arthals-Ink.git`
- `upstream` push URL：`DISABLED`
- `main` 保持在冻结上游基线；首版集成在 `develop`。

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
| `HIST-MUSIC`       | 全局音乐状态              | `src/components/MusicPlayer.astro`、`src/data/daily/music.ts`                                                                                                                     | 直接复用 Audio、播放列表、持久化和生命周期；换成本地最终资源             |
| `HIST-SHOKA-HERO`  | Hero 的 Astro 外壳        | `src/components/effects/ShokaHero.astro`、`src/components/home/HomeRibbonLayer.astro`                                                                                             | 只复用生命周期和页面挂载；视觉核心以 LargeSkull 原站为准                 |
| `HIST-TIMELINE`    | Blog 时间线               | `src/components/home/NotesPreview.astro`                                                                                                                                          | 基本直接复用；删除 notes 双模式，只从 Blog 自动生成                      |
| `HIST-SAYINGS`     | Saying 数据和交互         | `src/components/says/SaysCollection.astro`、`SaysCard.astro`、`src/components/home/QuoteCard.astro`、`src/content/says/**`、`src/pages/says/**`                                   | 直接复用查询、随机、归档和详情方案；命名与路由适配为 Saying/Sayings      |
| `HIST-TRACES`      | Trace 数据与页面          | `src/pages/traces/**`、`src/content/notes/**`、`src/pages/notes/**`                                                                                                               | 直接复用并统一重命名；最终落到 Trace collection                          |
| `HIST-BACKDROP`    | PKU 生命周期              | `src/components/effects/GlobalBackdropEffects.astro`、`public/vendor/canvas-fluttering-ribbon.min.js`、`public/vendor/canvas-nest@1.1.3.min.js`                                   | 复用生命周期外壳和已有两层；视觉算法以锁定的 PKU 1.1.3 三层脚本为准      |
| `HIST-GEORGE-HOST` | 花瓣/点击的生命周期与过滤 | `src/components/effects/SeasonalPetals.astro`、`ClickBurst.astro`、`src/layouts/BaseLayout.astro`                                                                                 | 只复用挂载、销毁和交互过滤；不采用历史自绘视觉核心                       |
| `HIST-RESIDENCE`   | 居住地动图                | `src/components/home/ResidenceCard.astro`、`FlightOverlay.astro`、`src/scripts/residence-map.ts`、`residence-map-geometry.ts`、`src/styles/residence-map.css`、对应 e2e/spec 文档 | 几乎直接复用；只校准原站视觉、个人位置和文案                             |
| `HIST-COMPANION`   | About 小人生命周期        | `src/components/effects/ScrollCompanion.astro`                                                                                                                                    | 复用 custom element、滚动/页面切换管理；视觉素材和公式以 TNXG 当前站为准 |
| `HIST-TESTS`       | 回归测试材料              | `tests/e2e/entrance.spec.ts`、`effects.spec.ts`、`home-ribbon.spec.ts`、`home-residence.spec.ts`、`residence-fidelity.spec.ts`、`says-about.spec.ts`、`blog-notes.spec.ts`        | 大量复用并适配最终路由和 DOM                                             |

明确不把历史 `TypewriterText.astro`、`ContributionHeatmap.astro`、`SeasonalPetals.astro` 或 `ClickBurst.astro` 的视觉核心当作最终原站真源。

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
| 参数        | `startDelay≈300`、`typeSpeed=150`、`backSpeed=50`、`loop=true`                                                            |
| 实施        | 文字参数与可分离 DOM/CSS 直接复用并适配入口；音乐仅复用紧凑可见状态/交互，音频引擎使用 `HIST-MUSIC`，不接入 Meting/网易云 |

原站核验时通过浮动 URL `https://cdn.cbd.int/typed.js/dist/typed.umd.js` 解析到 `typed.js@3.0.0`，资源 SHA-256 为 `b91711cbe4aca07f45801bdbed5df00191484cbbc740269723044af26c2902dc`。本项目不沿用浮动 CDN，固定为：

- `typed.js@2.1.0`
- Git commit `3daa3a4760dff3c563964ef0935b64ccfb0b22f8`
- npm integrity `sha512-bDuXEf7YcaKN4g08NMTUM6G90XU25CK3bh6U0THC/Mod/QPKlEt9g/EjvbYB8x2Qwr2p6J6I3NrsoYaVnY6wsQ==`
- MIT

这是为可复现构建和许可边界做的必要版本调整；不改变目标动画参数。

### 5.3 George 花瓣与点击粒子

George 当前定制脚本未发现可锁定的公开源码仓库，因此以 2026-08-27 的 Live 资源作为来源锁。实现阶段必须下载到本地并复核哈希。

| ID                 | 精确资源                                                                                |   字节 | SHA-256                                                            | 实施方式                                                          |
| ------------------ | --------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `GEORGE-SAKURA`    | `https://www.george-blog.top/wp-content/themes/argon/George/sakura.js`                  | 63,105 | `36795ed7d5ae4e34667615993287e59a2f33eff0dcb9dfbd2e4769789b430229` | 原算法直接复用；用 `HIST-GEORGE-HOST` 限定 Links、挂载/销毁和降级 |
| `GEORGE-CLICK`     | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/fireworks.js`     |  6,291 | `5828f0a7f93a62920de3dce56a29f37658c30686932c5114faa06dcc5c79ebc8` | 原算法直接复用并略调；新增“仅空白处”过滤                          |
| `GEORGE-TINYCOLOR` | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/tinycolor.min.js` | 14,583 | `af61a9951eda26670b81a7e33e49465f36086e92455e9b35fb19d15ab28d9d50` | 固定并本地化；字节与 tinycolor 1.4.2 官方资源一致                 |
| `GEORGE-ANIME`     | `https://www.george-blog.top/wp-content/themes/argon/George/fireworks/anime.min.js`     | 17,748 | `455938d7e835eec1b7ec9b05b302be31730bb4d828abb4e9076be86de8cf3a5f` | 固定并本地化；内容标识 anime.js 3.2.1                             |

附加证据：`sakura.js` Last-Modified 为 `Sat, 09 Aug 2025 14:06:34 GMT`；`fireworks.js` 为 `Sun, 10 Aug 2025 12:16:17 GMT`。原点击脚本监听整个 `document` 的 `mousedown`，本项目允许的必要调整是排除链接、按钮、表单、播放器、导航、文本选择、可交互卡片和显式禁用区。

### 5.4 PKU 三层背景

来源页：[`https://pku-cs-cjw.top/about-this-wed/`](https://pku-cs-cjw.top/about-this-wed/)。2026-08-27 的页面 HTML 精确加载 `butterfly-extsrc@1.1.3`：

| ID            | 资源                                                                              | SHA-256                                                            |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PKU-RIBBON`  | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-ribbon.min.js`            | `0397a7e1a38f78ef831c1e284cf39c81263bdd022e1b462ad4c0955acf9ea3a6` |
| `PKU-FLUTTER` | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-fluttering-ribbon.min.js` | `ae4d9f6cdc03736996029a8806cc162ec4340a92fc4bfa2bc273d4a46466b68a` |
| `PKU-NEST`    | `https://cdn.cbd.int/butterfly-extsrc@1.1.3/dist/canvas-nest.min.js`              | `2c8951c894a012c98e55c3ba80045863c627cc5d144665bd54c286ac75f2a7dd` |

三层视觉算法直接复用并本地化；`HIST-BACKDROP` 提供已有两层和生命周期参考，本项目自行开发统一 `VisualEffectsHost`，负责补齐第一层、路由启停、去重和销毁。页面源码中无关脚本、配置和凭据不复制、不记录。

### 5.5 SkyWT 居住地

| 项目           | 值                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------- |
| 台账 ID        | `SKY-RESIDENCE`                                                                                |
| 视觉校准页     | [`https://skywt.cn/`](https://skywt.cn/)；核验日期 2026-08-27                                  |
| 可维护代码真源 | `HIST-RESIDENCE` 固定快照                                                                      |
| 实施           | 历史实现几乎直接复用；仅校准飞机、原点、云影、脉冲延迟、Globe 裁切、标题、控件、个人坐标和测试 |
| 外部运行时     | 只允许 CARTO 地图瓦片；Geolocation 仅在用户主动授权后使用                                      |

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
| 实施     | 当前 WebP 与当前滚动变换作为视觉/公式真源；`HIST-COMPANION` 提供 Astro custom element 和生命周期；本项目只做 About 路由、≥1440px 和层级适配 |

不使用 TNXG 旧公开仓库代码，不增加原需求没有的呼吸或点击互动。实现阶段提取当前发布 bundle 中与滚动变换直接相关的最小片段，并把本地化文件和新哈希追加到本条目；其他 Next.js 应用代码不复制。

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

这 6 张图片可暂时同时填入 `heroSlides`、`sayingDecorativeImages` 和 `traceFallbackImages`，但三个数组必须独立，不能共享业务语义。

## 7. 完整模块分配闭环

| 最终模块                                      | 原网站/上游直接部分                   | 历史项目直接部分                      | 本项目自行开发或略调                                          |
| --------------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Header、Footer、主题、文章阅读、TOC、搜索外壳 | `BASE-ARTHALS` / `BASE-PURE`          | 无                                    | Astro 6 类型、目标配置、导航顺序和个人信息略调                |
| Blog 列表/详情/无图卡片                       | `BASE-ARTHALS`                        | 无                                    | schema 兼容、测试内容保留；视觉不重做                         |
| Trace 列表/详情                               | `LS-CARD` 视觉                        | `HIST-TRACES` 数据和页面              | Trace collection、内容图/稳定回退策略、路由适配               |
| Saying 归档/详情/Home 卡片                    | `LS-CARD` 视觉；`INNEI-IDEA` 只供思路 | `HIST-SAYINGS` 查询、随机、归档和详情 | Saying collection、两个入口、空状态和装饰图分配               |
| Home Hero/波浪                                | `LS-HERO` DOM/CSS/参数                | `HIST-SHOKA-HERO` 生命周期            | 数据配置、主题/reduced-motion 适配                            |
| 最近 Blog/Traces 双栏                         | 无                                    | 历史 Home 查询和布局                  | 各取 3 条、Blog 左/Trace 右及响应式略调                       |
| Blog Timeline                                 | `INNEI-IDEA` 只供思路                 | `HIST-TIMELINE`                       | 改为 Blog-only，无独立路由                                    |
| `/` 视频入口                                  | `XYX-TYPING` 动画参数                 | `HIST-ENTRANCE`                       | 每次访问播放、replace 导航、noindex/canonical、文案和本地媒体 |
| 全局音乐                                      | `XYX-MUSIC-UI` 可分离视觉             | `HIST-MUSIC` 引擎/状态                | 持久 DOM、详情折叠、本地资源和路由适配                        |
| Links 花瓣                                    | `GEORGE-SAKURA` 算法                  | `HIST-GEORGE-HOST` 生命周期           | Links-only、DPR/reduced-motion 适配                           |
| 点击粒子                                      | `GEORGE-CLICK` 算法与依赖             | `HIST-GEORGE-HOST` 过滤/生命周期      | 空白区域过滤、页面 profile 和销毁                             |
| PKU 全局背景                                  | `PKU-*` 三层算法                      | `HIST-BACKDROP` 已有封装              | `VisualEffectsHost`、补第一层、默认/阅读/Links profile        |
| SkyWT 居住地                                  | 原站只供视觉校准                      | `HIST-RESIDENCE` 几乎全部实现         | 个人坐标/文案、细节校准、CARTO/定位失败回退                   |
| GitHub 热力图                                 | `HAN-HEATMAP` 组件、解析、CSS         | 历史实现不采用                        | 用户名、缓存、构建失败回退；无 schedule                       |
| About 小人                                    | `TNXG-COMPANION` 素材和滚动公式       | `HIST-COMPANION` 生命周期             | About-only、≥1440px、层级和清理                               |
| 卡片 presentation 解析器                      | 无                                    | 无                                    | 自行开发纯策略；页面覆盖 > 内容默认 > 安全回退                |
| 图片顺序/随机/哈希回退                        | 无                                    | Saying 随机逻辑可复用                 | 自行开发可测试纯函数                                          |
| CI、资源门禁和 Pages                          | `BASE-PAGES` 官方方案                 | 无                                    | 固定 Node/Bun、frozen lock、手动部署和无 schedule             |

## 8. 实现阶段提取门禁

每个台账条目进入开发前必须依次完成：

1. 校验来源 commit、URL 或历史快照身份没有变化。
2. 只提取该条目需要的最小文件或代码段。
3. 外部脚本和素材复制到本地；不保留生产热链。
4. 对本地副本记录相对路径、SHA-256 和来源台账 ID。
5. 在代码文件头或邻近注释记录来源 URL、commit/版本、复用类型和必要差异。
6. 运行该模块测试、页面生命周期测试、外部请求扫描和视觉对照。
7. 来源变化时先更新本台账，再更新代码。

不得从网页源码复制与目标效果无关的分析脚本、广告、评论、统计、API 配置、密钥或用户数据。

## 9. 当前已落地与尚未提取

准备阶段已经实际落地：

- `BASE-ARTHALS` Fork、远端和冻结标签。
- `BASE-PURE` / `BASE-ASTRO` 目标依赖和 lockfile。
- `BASE-SIGNATURE` 本地组件。
- `BASE-PAGES` CI 与手动部署工作流。
- 历史项目的只读恢复快照。
- 所有外部来源的版本、URL 或视觉校准边界。

尚未落地的 Hero、卡片、动画、粒子、地图、热力图和小人均属于 Phase 1 至 Phase 5 功能开发，不是准备阶段遗漏。它们必须按本台账实施，不能临时换成自行重做的近似效果。
