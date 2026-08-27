# Susurrium 博客重构实施方案

> 状态：已确认、可实施｜方案版本：1.0｜冻结日期：2026-08-27｜适用仓库：`Susurrium/susurrium.github.io`
> 上游基线：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`

## 1. 文档作用

本文档是首版开发的唯一实施基线。它固化此前已经确认的产品边界、页面结构、内容模型、组件来源、复用方式、生命周期规则、部署策略和验收标准。

如果后续实现与本文档冲突，默认以本文档为准；确需改变时，必须先修改文档并记录原因，不能在代码中静默改变需求。

## 2. 项目目标

项目直接 Fork Arthals-Ink，并在以下方面尽可能保持 Arthals 的原貌：

- 页面骨架、留白、排版、色彩、主题切换与整体视觉语言。
- Header、Footer、文章列表、文章详情、目录、标签、归档、搜索和阅读体验。
- Astro + Pure 的静态内容架构。

在此基础上，增加已经明确的入口动画、音乐、首页 Hero、波浪、三类内容、三类卡片、全局背景、花瓣、点击粒子、时间线、居住地地图、热力图和 About 小人。

首版不是重新设计。实施原则固定为：

1. Arthals 提供站点主体。
2. 原参考网站的代码或算法负责对应效果的视觉与交互真实性。
3. 历史项目 `E:\code\homepage` 提供已经验证的 Astro 封装、业务逻辑、状态管理和生命周期处理。
4. 新代码只负责本项目特有的数据模型、路由策略、统一接口、冲突治理、降级和测试。

## 3. 明确不做

首版不包含以下事项：

- 不创建定时抓取 GitHub 热力图的任务。
- 不启用 Waline、分析统计、在线一言或新的后端 API。
- 不接入 Meting、网易云等在线音乐服务。
- 不新增独立 Timeline 页面，也不在导航或 Footer 放 Timeline 入口。
- 不将 Trace 误做成另一种 Blog，也不将 Saying 误做成 Trace。
- 不重新设计参考网站效果。
- 不自动替换最终个人内容、视频、音乐、图片和文字。
- 不盲目合并 Arthals 上游后续提交。
- 不直接修改 `node_modules`。
- 不以 Astro 7 或历史项目中的 Astro 7 覆盖为基线。

## 4. 术语

### 4.1 四种复用方式

- **直接复用**：主体代码、DOM、CSS 或算法保持不变，只改导入、类型、资源路径和配置。
- **略微调整**：保留原实现，只改参数、路由、尺寸、生命周期或冲突点。
- **混合复用**：原网站提供视觉/算法，历史项目提供 Astro 封装、状态或生命周期。
- **自行开发**：仅开发项目胶水层、统一策略和测试，不重做参考特效。

### 4.2 三种内容

| 内容   | 定义                         | 是否在主导航 | 是否有详情页 |
| ------ | ---------------------------- | -----------: | -----------: |
| Blog   | 正式、完整的长篇博客         |           是 |           是 |
| Trace  | 随手短记、动态、阶段记录     |           是 |           是 |
| Saying | 名言、一言、短句及其出处说明 |           否 |           是 |

## 5. 技术与工具链基线

| 项目         | 锁定值                                     | 说明                             |
| ------------ | ------------------------------------------ | -------------------------------- |
| Arthals 上游 | `15f5ad110af8ed8f38a1e506dd890d2d921f118f` | 开发前不可移动基线               |
| Astro        | `6.1.8`                                    | 与 Pure 1.4.6 已发布依赖完全对齐 |
| astro-pure   | `1.4.6`                                    | npm 发布包，首版唯一主题真源     |
| Node.js      | `>=22.12.0`                                | 本机验证版本为 24.18.0           |
| Bun          | `1.4.0`                                    | 安装、锁文件和 CI 均固定         |
| TypeScript   | strict                                     | 延续 Arthals 严格模式            |
| 输出         | static                                     | GitHub Pages 不使用服务端适配器  |

### 5.1 为什么不是 Astro 6.4.8

`astro-pure@1.4.6` 的已发布清单把 `astro` 精确声明为 `6.1.8`，不是 peer dependency，也不是版本范围。根项目若直接使用 6.4.8，包管理器可能安装两套 Astro，产生 Integration API、类型和内容层不一致。

因此首个可复现基线锁定 6.1.8。未来若要升级到 6.2.1 或 6.4.8，必须单独提交并同时满足：

- 依赖树只有一套 Astro。
- `astro check` 无错误。
- 静态构建通过。
- 全部路由生成。
- ClientRouter、主题、内容集合与视觉回归通过。

失败时回退 6.1.8，不升级到 Astro 7。

### 5.2 Pure 的唯一真源

应用代码从 npm `astro-pure@1.4.6` 导入。上游仓库内的 `packages/pure` 是 Arthals 当时的历史副本，不参与应用解析，并从 TypeScript 检查中排除。

唯一例外是 Arthals 自带而 npm 1.4.6 未发布导出的 `Signature`。它已按来源完整复制到本地 Arthals 组件目录，由本项目直接维护并登记来源。

若以后确实需要修改 Pure 内部 DOM，只允许以下两种方式之一：

1. 本地 wrapper；
2. 有版本、有说明、可审计的 patch/vendor。

不允许同时维护两个未标明优先级的 Pure 副本。

## 6. 仓库与分支策略

### 6.1 远端

- `origin`：`https://github.com/Susurrium/susurrium.github.io.git`
- `upstream`：`https://github.com/zhuozhiyongde/Arthals-Ink.git`
- `upstream` 的 push URL 被禁用，避免误推。

GitHub 上的仓库保留了真实 Fork 关系，并由原 `Susurrium/Arthals-Ink` 改名为 `susurrium.github.io`。

### 6.2 分支与标签

- `main`：生产分支；准备和开发阶段不自动部署。
- `develop`：首版集成分支。
- 功能分支：从 `develop` 创建，建议格式 `feat/<module>` 或 `chore/<topic>`。
- `arthals-upstream-2026-03-22`：不可移动的上游基线标签。

### 6.3 上游同步

不直接把未来 upstream/main 合并到定制分支。同步流程固定为：

1. `git fetch upstream`。
2. 审阅上游差异。
3. 只选择明确需要的提交。
4. 在独立分支 cherry-pick 或手动移植。
5. 运行完整检查后合并。

## 7. GitHub Pages

| 项目         | 结论                            |
| ------------ | ------------------------------- |
| 仓库         | `Susurrium/susurrium.github.io` |
| 网址         | `https://susurrium.github.io/`  |
| Astro `site` | `https://susurrium.github.io`   |
| Astro `base` | 不设置                          |
| 部署         | GitHub Actions + GitHub Pages   |
| 自动发布     | 准备阶段关闭                    |
| 手动发布     | 保留 `workflow_dispatch`        |
| 定时任务     | 不创建                          |

用户名站点从根路径发布，所以不能设置 `base: '/susurrium.github.io'`。正式发布前再把部署工作流改为监听 `main` push。

## 8. 信息架构

### 8.1 主导航

最终顺序固定为：

`Blog / Traces / Projects / About / Links`

Logo 跳转 `/home`。Sayings 不进入主导航。

### 8.2 路由

| 路由              | 用途                     |
| ----------------- | ------------------------ |
| `/`               | 每次访问都播放的全屏入口 |
| `/home`           | 实际 Home                |
| `/blog`           | Blog 列表                |
| `/blog/{slug}`    | Blog 详情                |
| `/traces`         | Trace 列表               |
| `/traces/{slug}`  | Trace 详情               |
| `/sayings`        | Saying 完整归档          |
| `/sayings/{slug}` | Saying 详情              |
| `/projects`       | Projects                 |
| `/about`          | About                    |
| `/links`          | Links                    |
| `/search`         | 搜索                     |
| `/tags`           | 标签                     |
| `/archives`       | 归档                     |

不创建 `/timeline`。

### 8.3 搜索、标签、归档与订阅边界

为避免 Blog、Trace、Saying 再次被混成一种内容，首版固定为：

| 能力          | Blog | Trace | Saying | 结论                                                     |
| ------------- | ---: | ----: | -----: | -------------------------------------------------------- |
| `/search`     |   是 |    是 |     是 | 搜索三种已发布内容，并显示内容类型；`/` 入口页不进入索引 |
| `/tags`       |   是 |    否 |     否 | 延续 Arthals 的正式文章标签体系                          |
| `/archives`   |   是 |    否 |     否 | 延续 Arthals 的正式文章归档体系                          |
| `/rss.xml`    |   是 |    否 |     否 | 主 RSS 只发布 Blog；首版不新增 Trace/Saying feed         |
| Home Timeline |   是 |    否 |     否 | 只由 Blog 自动生成                                       |

Trace 的 `tags` 首版仅供 Trace 页面内部展示和未来扩展，不并入 Blog 标签聚合。Saying 的 `tags` 只作元数据，不进入全站 `/tags`。如果以后增加 Trace 独立标签或 RSS，必须先更新本文档，不能静默混入 Blog 体系。

## 9. Home 固定结构

Home 从上到下固定为：

1. LargeSkull 六图 Hero。
2. 四层波浪。
3. 随机 Saying 装饰图卡片。
4. 最近 Blog 与最近 Traces 左右双栏。
5. 只由 Blog 自动生成的 Timeline。
6. SkyWT 居住地地图。
7. HanLife GitHub 热力图。

双栏规则：

- Blog 在左，Traces 在右。
- 默认各取 3 条，彼此独立排序和截取。
- 容器变窄时转为纵向，Blog 在上、Traces 在下。

## 10. 内容模型

字段名在实现时优先兼容 Arthals 和历史项目现有 schema；以下是语义底线。

### 10.1 Blog

- `title`
- `description`
- `published`
- `updated?`
- `tags`
- `category?`
- `draft`
- `heroImage?`
- `heroImageAlt?`
- Markdown/MDX 正文

`heroImage` 可用于详情或社交预览，但 Blog 列表始终使用无图卡片。

### 10.2 Trace

- `title`
- `description?`
- `published`
- `updated?`
- `tags`
- `draft`
- `cover?`
- `coverAlt?`
- Markdown/MDX 正文

上传内容题图时必须提供有意义的 `coverAlt`。自动回退装饰图使用空 alt。

### 10.3 Saying

- `text`
- `author?`
- `source?`
- `sourceUrl?`
- `published`
- `tags?`
- `draft`
- 可选 Markdown 正文，用于出处或个人说明

Slug 或内容 ID 必须稳定，不能使用数组下标作为路由。

### 10.4 Saying 的两个入口与空集合

- Home 的随机 Saying 使用一张 LargeSkull 装饰图卡片；整卡及明确的“查看完整内容”链接都指向当前条目的 `/sayings/{slug}`。
- About 只提供通往 `/sayings` 完整归档的入口，不渲染第二套随机卡片或第二套归档。
- 当集合为空时，Home 保留同尺寸的不可点击空状态卡片，避免页面布局跳变；About 入口仍可进入 `/sayings`，归档页展示明确空状态。
- 随机选择只在有内容时发生；单条集合必须稳定返回该条。

## 11. 卡片系统

产品上有三种卡片，代码层只有两个视觉原语。

| 业务用途 | 默认 presentation        | 视觉来源   | 图片规则                   |
| -------- | ------------------------ | ---------- | -------------------------- |
| Blog     | `arthals-text`           | Arthals    | 列表永远无图               |
| Trace    | `large-skull-content`    | LargeSkull | 内容题图优先，否则稳定回退 |
| Saying   | `large-skull-decorative` | LargeSkull | 独立装饰图库按归档顺序循环 |

### 11.1 三个资源池

配置必须保留三个独立数组：

- `heroSlides`
- `sayingDecorativeImages`
- `traceFallbackImages`

首版可暂时使用相同的 LargeSkull 占位图片，但数据层不能合并。

### 11.2 显示策略

卡片不能在内容类型内部硬编码。解析顺序为：

1. 页面上下文显式覆盖。
2. 内容类型默认 presentation。
3. 安全回退。

这允许以后在其他页面复用卡片，不会把 Blog、Trace、Saying 与某个视觉组件永久绑定。

### 11.3 图片分配

- Saying：按固定归档排序后的全局索引循环分配；Home 随机到某条 Saying 时复用该条的归档装饰图。
- Trace：上传图优先；无图时按稳定内容 ID 哈希选择回退图片，刷新和重新构建不跳图。
- Saying 装饰图与 Trace 回退图都属于装饰信息，alt 为空。

## 12. 组件来源与复用边界

| 模块                                        | 主要来源                                                                                 | 实施方式                      | 允许调整                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| 页面骨架、Header、Footer、主题、文章页、TOC | Arthals-Ink                                                                              | 直接复用 + 略调               | Astro 6、导航、配置                                      |
| Blog 内容与列表                             | Arthals-Ink                                                                              | 直接复用 + schema 适配        | 保留测试内容                                             |
| Blog 无图卡片                               | Arthals-Ink                                                                              | 直接复用                      | 只做数据适配                                             |
| Traces 数据和详情                           | 历史项目 notes/traces                                                                    | 直接复用 + 重命名             | 最终 Trace schema                                        |
| Sayings 数据和详情                          | 历史项目 says                                                                            | 直接复用 + 重命名             | 路由改为 `/sayings`                                      |
| LargeSkull Hero 与波浪                      | 原网站视觉核心 + 历史 `ShokaHero` 生命周期外壳 + 本项目挂载胶水                          | 混合复用                      | 原 DOM/CSS/动画参数；仅适配 Astro、路由和 reduced-motion |
| Saying 卡片                                 | LargeSkull 原 DOM/CSS/hover/斜边 + 本项目 Saying 查询和装饰图策略                        | 直接视觉复用 + 薄封装         | 不改原视觉，只接本地数据与无障碍语义                     |
| Trace 卡片                                  | LargeSkull 原 DOM/CSS/hover/斜边 + 本项目 Trace 查询和回退策略                           | 直接视觉复用 + 薄封装         | 不改原视觉，只接内容图、回退图与无障碍语义               |
| Home 最近内容双栏                           | 历史项目                                                                                 | 略微调整                      | Blog/Traces 各 3 条                                      |
| Blog Timeline                               | 历史 `NotesPreview`                                                                      | 基本直接复用                  | 删除 notes 模式，只接 Blog                               |
| 根路径入口                                  | 历史 `EntranceScene`                                                                     | 直接复用 + 略调               | 删除 session 跳过                                        |
| 入口文字动画                                | xyx404 参数/交互 + `typed.js@2.1.0`                                                      | 原方案复用 + 必要版本固定     | 不使用原站浮动 CDN；只改文案、挂载点和销毁逻辑           |
| 音乐引擎和状态                              | 历史 `MusicPlayer`                                                                       | 直接复用 + 略调               | 本地列表、持久化                                         |
| 音乐紧凑视觉                                | xyx404 原 DOM/CSS/可见状态 + 历史播放器状态接口                                          | 混合复用                      | 直接移植可分离视觉片段；不接入 Meting/网易云             |
| George 花瓣                                 | George 原算法                                                                            | 原核心 + 历史生命周期         | Links 专用、清理                                         |
| George 点击粒子                             | George 原算法                                                                            | 原核心 + 历史过滤             | 仅空白区域                                               |
| PKU 三层背景                                | PKU 原脚本                                                                               | 直接算法 + 新管理器           | 补第三层、路由启停                                       |
| SkyWT 居住地                                | 历史项目                                                                                 | 几乎直接复用                  | 视觉参数和测试                                           |
| GitHub 热力图                               | HanLife/Astro-star                                                                       | 原组件、解析、CSS 直接复用    | 用户名、缓存、失败回退                                   |
| 一言/Saying 体系                            | Innei 仅提供产品思路；历史项目提供数据、随机、查询和详情；本项目提供 collection/路由适配 | 历史代码直接复用 + 本项目略调 | 不使用 Innei/Yohaku 代码                                 |
| About 右侧小人                              | TNXG 当前素材与滚动公式 + 历史 `ScrollCompanion` 生命周期外壳 + 本项目路由胶水           | 混合复用                      | 仅 About、≥1440px；不使用 TNXG 旧仓库实现                |
| Links 基础页                                | Arthals-Ink                                                                              | 直接复用                      | 加花瓣和点击粒子                                         |
| About Sayings 入口                          | 本项目                                                                                   | 自行开发                      | 复用 Saying 查询和卡片                                   |
| `VisualEffectsHost`                         | 本项目                                                                                   | 自行开发                      | 仅启停、去重、销毁                                       |
| 卡片策略解析器                              | 本项目                                                                                   | 自行开发                      | 不实现视觉                                               |
| 图片顺序、随机、哈希回退                    | 本项目                                                                                   | 自行开发                      | 纯策略函数                                               |
| 测试                                        | 历史测试 + 新测试                                                                        | 大量复用 + 补充               | 新路由和生命周期                                         |
| Pages workflow                              | Astro/GitHub 官方模板                                                                    | 官方方案配置                  | 无 schedule                                              |

每项精确 URL、SHA、抓取日期和授权状态见 [SOURCE_LEDGER.md](./SOURCE_LEDGER.md)。

## 13. 各参考效果验收

### 13.1 根路径入口

- 每次访问 `/` 都显示，不能用 `sessionStorage` 跳过。
- 全屏、静音、循环视频。
- xyx404 风格文字覆盖在入口视频上，逐渐出现后逐渐消失。
- 必须等待点击或键盘操作才进入 `/home`。
- 视频播放结束不能自动进入。
- 使用 history replace，避免返回键反复回到入口。
- `/` 设置 noindex，canonical 指向 `/home`。
- 入口不挂载 Header、Footer、音乐或全局特效。

### 13.2 LargeSkull Hero 与波浪

- 六张静态图片。
- 总周期约 36 秒，相邻图片相差 6 秒。
- 淡入淡出并从 `scale(1)` 缓慢到约 `scale(1.1)`。
- 品牌可见区域约 50vh，背景约 70vh。
- 四层 SVG 波浪：桌面约 15vh，移动端约 10vh。
- 四层周期约 7/10/13/20 秒，并保留负延迟。

### 13.3 LargeSkull 卡片

- 桌面为 50/50 图文比例。
- 图片左右交替，斜边方向同步变化。
- Hover 约 200ms，`scale(1.05)` 并旋转约 ±1°。
- 移动端改为上下布局并保留对应斜边。
- Trace 上传图是内容图；Saying 和 Trace 回退图是装饰图。

### 13.4 xyx404 文字与音乐

- Typed.js 基准参数：`startDelay≈300`、`typeSpeed≈150`、`backSpeed≈50`、循环。
- 原站当前通过浮动 CDN 加载的版本不可复现；本项目固定 `typed.js@2.1.0`（MIT），保留同一 API 和上述动画参数，并由 Astro 生命周期显式销毁。
- 文字只放在根入口视频上，不放在 Home LargeSkull Hero。
- 音乐来自本地音频和本地封面。
- 首次播放必须由用户操作触发。
- ClientRouter 内部跳转时持续播放且只有一个 Audio 实例。
- 内容详情页折叠 UI，但不停止当前音乐。
- 根入口不显示音乐。

### 13.5 George 花瓣与点击粒子

- Links 使用原 50 花瓣 sprite/算法。
- 其他允许页面不显示花瓣。
- 点击空白处使用原 20 个蓝色粒子和圆环效果。
- 链接、按钮、表单、卡片交互区、播放器、导航、文本选择和显式禁用区不触发。

### 13.6 PKU 背景

完整保留三层：

1. `canvas-ribbon`
2. `canvas-fluttering-ribbon`
3. `canvas-nest`

历史项目已有后两层，本项目补齐第一层原算法。移动端按原站关闭。所有层必须由统一管理器创建和销毁。

### 13.7 SkyWT 居住地

直接复用历史项目的：

- `ResidenceCard`
- `FlightOverlay`
- `residence-map.ts`
- MapLibre 懒加载、地球、定位、距离、航线和测试材料

只校准飞机、原点、云影、脉冲延迟、Globe 裁切、标题和控件；不重写为 React/Framer。

### 13.8 HanLife 热力图

- 复用 HanLife/Astro-star 的 53 周紧凑无边框组件、解析和 CSS。
- 用户名为 `Susurrium`。
- 普通构建可抓取公开贡献，并有缓存/本地测试数据回退。
- 抓取失败不能使构建失败。
- 首版不创建定时任务，也不保存 GitHub Token。

### 13.9 Innei 与 Timeline

只采用“时间线/一言”的产品思路，不使用当前 Yohaku 代码。Timeline 直接使用历史项目方案，并且只从 Blog 自动生成，不产生新内容类型。

### 13.10 TNXG 小人

- 只出现在 About。
- 使用 TNXG 当前 WebP 素材和滚动公式。
- 使用历史 `ScrollCompanion` 的 custom element/lifecycle 外壳。
- 仅在宽度 ≥1440px 时显示。
- 不增加呼吸和点击交互。

## 14. 页面特效矩阵

| 页面                                      | PKU 三层 | 点击粒子 | 花瓣 |    TNXG | 音乐       |
| ----------------------------------------- | -------: | -------: | ---: | ------: | ---------- |
| `/`                                       |       否 |       否 |   否 |      否 | 不挂载     |
| `/home`                                   |       是 |       是 |   否 |      否 | 完整       |
| `/blog`                                   |       是 |       是 |   否 |      否 | 完整       |
| Blog 详情                                 |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/traces`                                 |       是 |       是 |   否 |      否 | 完整       |
| Trace 详情                                |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/sayings`                                |       是 |       是 |   否 |      否 | 完整       |
| Saying 详情                               |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/projects`                               |       是 |       是 |   否 |      否 | 完整       |
| `/about`                                  |       是 |       是 |   否 | ≥1440px | 完整       |
| `/links`                                  |       否 |       是 |   是 |      否 | 完整       |
| `/search`、`/tags`、标签分页、`/archives` |       是 |       是 |   否 |      否 | 完整       |
| 404 和其他普通静态页                      |       是 |       是 |   否 |      否 | 完整       |

“详情页”统一使用专注阅读 profile，不叠加 PKU、花瓣、点击粒子或小人。

未单列的新路由默认使用普通页面 profile：PKU 三层背景和点击粒子开启，花瓣与小人关闭，音乐完整。只有 `/`、三类内容详情页和 `/links` 可以覆盖这一默认值。

## 15. 前端架构

### 15.1 统一生命周期

建立 `VisualEffectsHost` 或等价层，所有 canvas、粒子、花瓣和滚动组件按路由策略启停。

每个效果必须满足：

- 同一时刻只有一个实例。
- 页面离开时清除 canvas、RAF、定时器和监听器。
- Astro 页面切换前停止，切换完成后重新按策略挂载。
- 默认 `pointer-events: none`。
- 使用统一 z-index 层级。
- 支持 `prefers-reduced-motion`。
- 不能将原脚本无管理地永久挂到 `window`。

### 15.2 层级

建议固定：

1. 页面背景色/背景图。
2. PKU canvas 背景。
3. 正文和卡片。
4. Links 花瓣。
5. 点击粒子。
6. Header、播放器、About 小人。
7. Modal/搜索。

具体值由 token 定义，组件内不散落任意 z-index。

### 15.3 音乐持久化

播放器使用 Astro 持久化 DOM 或等价单例状态。不得在每次页面切换时重新构造 Audio。播放列表、封面、音频全部本地化。

## 16. 外部服务与网络白名单

首版运行时只允许：

- CARTO 地图瓦片。
- 浏览器 Geolocation（仅用户授权后）。

构建期额外允许：

- GitHub 公开贡献数据。

当前明确禁用：

- Waline。
- Umami、Google Analytics。
- 在线一言 API。
- Meting、网易云。
- Substats。
- Arthals 的 CodeTime/访问量 badge。
- 其他未登记的 CDN、API 和热链资源。

除 CARTO 外，参考网站的脚本、图片、视频、音频和 sprite 原则上本地化。

## 17. 静态资源预算

GitHub Pages 站点和带宽有限，视频与音乐必须在开发初期治理。

| 资源                 |     推荐目标 |       硬门禁 |
| -------------------- | -----------: | -----------: |
| 单张 Hero/卡片输出图 |     ≤500 KiB |       ≤2 MiB |
| 单个入口视频         |      ≤20 MiB |      ≤50 MiB |
| 单曲音频             |      ≤12 MiB |      ≤25 MiB |
| 首版本地音乐总量     |      ≤80 MiB |     ≤150 MiB |
| 单个任意仓库文件     |            — |      <50 MiB |
| `dist` 总量          | 警告 500 MiB | 失败 900 MiB |

地图和低频模块必须懒加载。动画在移动端和 reduced-motion 下按原站或方案降级。

## 18. 测试与质量门禁

### 18.1 必须通过

- `bun install --frozen-lockfile`。
- `astro check`。
- `astro build`。
- 关键策略单元测试。
- Playwright 关键路径。
- 桌面和移动端视觉回归。
- 外部请求白名单扫描。
- 资源体积扫描。
- 最终发布前占位内容扫描。

### 18.2 必测策略

- 内容 schema。
- Saying 顺序图分配。
- Trace 稳定哈希回退。
- 页面到效果 profile 的映射。
- 随机 Saying 的空、单条、多条集合。
- 特效 `start/pause/destroy`。
- 音乐单例和跨导航。
- GitHub 抓取失败回退。
- 深层路由和 404。
- 连续跨 10 个页面后无重复 canvas/监听器。

### 18.3 Arthals 视觉基线门禁

“视觉和架构基本完全一致”按可验证基线执行，不只依赖主观描述：

- 以冻结的 Arthals 上游构建为参照，把其首页 `/` 与本项目实际 Home `/home` 对照。
- 对照 Header、Footer、Blog 列表、Blog 详情、标签、归档、搜索、About 和 Links。
- 每个基准页面至少覆盖桌面、移动端、明色和暗色四种组合。
- 允许差异只包括本文登记的导航、内容结构、目标组件、个人配置以及 Astro/Pure 兼容适配。
- 未登记的字号、间距、颜色、圆角、布局或交互差异视为视觉回归失败；必要差异必须先写入方案或来源台账。

## 19. 开发阶段

### Phase 0：来源和基线冻结

交付：

- 上游 SHA 和标签。
- 参考来源台账。
- 历史项目状态和安全快照。
- 目标工具链验证。

状态：已完成。仓库、来源台账、历史快照、目标构建、准备提交和 GitHub Linux CI 均已闭环；功能开发尚未开始。

### Phase 1：信息架构与内容模型

交付：

- `/` 与 `/home` 分离。
- Blog、Trace、Saying 三个 collection。
- 列表/详情路由和最终导航。
- 测试占位内容。

验收：所有路由静态生成，无重复 slug，生产构建排除 draft。

### Phase 2：卡片与 Home 主体

交付：

- Arthals Blog 卡片。
- LargeSkull 通用卡片。
- 三种 presentation 策略。
- Hero、waves、随机 Saying、双栏和 Blog Timeline。

### Phase 3：入口与音乐

交付入口视频、Typed.js、手动进入、持久音乐和详情页折叠。

### Phase 4：全局效果

交付 PKU 三层、George 点击粒子、Links 花瓣和统一生命周期。

### Phase 5：特色模块

交付 SkyWT 居住地、HanLife 热力图、TNXG 小人和 About Sayings 入口。

### Phase 6：发布审计

交付 SEO、RSS、sitemap、404、性能、无障碍、占位扫描、网络扫描和正式 Pages 自动部署。

## 20. 主要风险与处理

| 风险                             | 处理                                                 |
| -------------------------------- | ---------------------------------------------------- |
| Pure 与 Astro 小版本不一致       | 首版锁 6.1.8；升级必须独立验证                       |
| npm Pure 缺少 Arthals 自定义导出 | 本地登记并维护单一 Arthals 组件                      |
| 仓库内旧 Pure 被误检查           | `tsconfig` 排除 `packages/pure`                      |
| 重复 Astro/Shiki/HAST            | 删除未使用依赖并固定 overrides                       |
| 原网站无可维护源码               | 先锁作者源码；否则以历史封装和原站录屏校准并记录偏差 |
| 多个特效泄漏                     | 统一生命周期宿主                                     |
| ClientRouter 重复初始化          | 页面切换事件显式销毁/挂载                            |
| 音乐被页面替换                   | 持久化 DOM + 单一状态源                              |
| GitHub 数据结构变化              | 缓存和本地回退                                       |
| 历史 dirty worktree 被污染       | 只读提取 + 已创建快照                                |
| 本地媒体超出 Pages 能力          | 资源预算和 CI 门禁                                   |
| 上游同步覆盖定制                 | 只选择性 cherry-pick                                 |

## 21. 明确不用的实现

- 历史项目的 Astro 7 覆盖。
- 历史项目中不够准确的 LargeSkull 视觉核心。
- 历史自制花瓣绘制核心。
- 历史自制点击粒子绘制核心。
- 历史自制 Typewriter 核心。
- 历史热力图视觉。
- 当前 Innei Yohaku 代码。
- xyx404 的 Meting/网易云依赖。
- 完整 SkyWT React/Framer 应用。
- TNXG 旧公开仓库代码。
- 不受生命周期管理的全局脚本。

## 22. 最终发布前替换清单

- 入口视频。
- Typed.js 文案。
- 六张 Hero 图。
- Saying 装饰图库。
- Trace 回退图库。
- 本地音乐、封面和曲目信息。
- 头像、Logo、站名、简介和社交链接。
- 居住地坐标与文案。
- Projects、Links、About。
- Blog、Trace、Saying 测试内容。
- OG 图、favicon、站点描述。
- 原作者占位资源和文字。
- 所有 TODO、demo、placeholder 和测试域名。

开发期间允许占位存在；正式发布门禁必须报告并清除。

## 23. 已锁定与仍需输入

核心产品与架构已经闭环，不再需要开发前产品决策。

后续仍需由用户在相应阶段提供：

- 最终个人内容与媒体资源。
- 最终居住地信息。
- 最终音乐播放列表。
- 如果作者提供了非公开源代码，对应文件或 commit。
- 是否在正式发布时启用自定义域名。

这些输入不会阻塞 Phase 1 至 Phase 5 的占位开发。

## 24. 变更控制

以下变化必须先更新本文档：

- 新增第四种内容类型。
- 改变主导航或 Home 顺序。
- 改变任何参考效果的来源优先级。
- 新增运行时外部服务。
- 启用定时任务。
- 将详情页重新加入背景特效。
- 更换部署平台或 Astro 主版本。

普通文案、占位图片、轻微参数校准和测试补充不需要重新确认产品方案。
