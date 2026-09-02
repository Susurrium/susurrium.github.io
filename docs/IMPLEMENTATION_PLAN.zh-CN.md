# Susurrium 博客重构实施方案

> 状态：Phase 0–5 已完成；Phase 6 的本地审计实现已完成，正式上线待最终资料与确认｜方案版本：1.1｜冻结日期：2026-08-27｜适用仓库：`Susurrium/susurrium.github.io`
> 上游基线：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`

> **当前 release-prep 记录（2026-09-02）**：候选分支为 `codex/release-prep`，从本机
> `8b05952ca54ca32843cdbbcc2f815b6d61a5a9be` 固化。Blog/Trace 空集合是当前受测试覆盖的
> 合法状态；历史内容与旧聚合路由暂不纳入当前候选并在仓库外快照/bundle 中保留，真实内容
> 是否恢复以 `docs/BRANCH_STATE_RECONCILIATION.zh-CN.md` 的逐项确认结果为准。候选尚未 push 或
> deploy。纳入、排除、隐私和素材权利决定以 `docs/RELEASE_PREP_AUDIT.zh-CN.md` 为准。

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
- 保留当前已接入的 Waline、生产 Umami、CodeTime 和公共网易云音乐配置；不新增未确认的后端 API 或在线一言服务。
- 音乐首版继续使用当前公共网易云 Meting 服务；它是明确登记的运行时例外，不代表文章正文媒体可以任意热链。
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

唯一例外是参考项目自带而 npm 1.4.6 未发布导出的 `Signature`。它已按来源完整复制到本项目的共享组件目录，由本项目直接维护并登记来源；运行时不再使用来源项目命名作为组件 API。

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

用户名站点从根路径发布，所以不能设置 `base: '/susurrium.github.io'`。正式发布前只有在严格门禁清零且用户确认后，才保留手动触发并把部署工作流增加为仅监听 `main` 的 push。

## 8. 信息架构

### 8.1 主导航

最终顺序固定为：

`Home / Blog / Traces / Projects / About / Links`

Logo 跳转 `/home`。Sayings 不进入主导航。

### 8.2 路由

| 路由                 | 用途                      |
| -------------------- | ------------------------- |
| `/`                  | 每次访问都播放的全屏入口  |
| `/home`              | 实际 Home                 |
| `/blog`              | Blog 列表                 |
| `/blog/{page}`       | Blog 分页列表（数字页）   |
| `/blog/{slug}`       | Blog 详情                 |
| `/traces`            | Trace 列表                |
| `/traces/{page}`     | Trace 分页列表（数字页）  |
| `/traces/{slug}`     | Trace 详情                |
| `/sayings`           | Saying 完整归档           |
| `/sayings/{page}`    | Saying 分页归档（数字页） |
| `/sayings/{slug}`    | Saying 详情               |
| `/projects`          | Projects                  |
| `/about`             | About                     |
| `/links`             | Links                     |
| `/search`            | 搜索                      |
| `/blog/tags`         | Blog 标签索引             |
| `/blog/tags/:tag`    | Blog 标签结果             |
| `/traces/tags`       | Trace 标签索引            |
| `/traces/tags/:tag`  | Trace 标签结果            |
| `/sayings/tags`      | Saying 标签索引           |
| `/sayings/tags/:tag` | Saying 标签结果           |
| `/archives`          | 归档                      |

不创建 `/timeline`。

三类主归档都具备分页能力，但不共用页面模板：分页 URL 和 `pageSize` 由各自配置决定，分页按钮统一使用 `← Previous` / `Next →`，卡片布局仍分别保留 Blog、Trace、Saying 的现有表现。实现上由 `src/lib/content-layer/pagination.ts` 统一构造完整 `PageData` 后再调用 Astro `paginate()`，避免跨页时丢失全局卡片索引或图片分配。

### 8.3 搜索、标签、归档与订阅边界

为避免 Blog、Trace、Saying 再次被混成一种内容，首版固定为：

| 能力                                  | Blog | Trace | Saying | 结论                                                     |
| ------------------------------------- | ---: | ----: | -----: | -------------------------------------------------------- |
| `/search`                             |   是 |    是 |     是 | 搜索三种已发布内容，并显示内容类型；`/` 入口页不进入索引 |
| `/blog/tags`、`/blog/tags/:tag`       |   是 |    否 |     否 | 仅查询 Blog，保留 Blog 标签域                            |
| `/traces/tags`、`/traces/tags/:tag`   |   否 |    是 |     否 | 仅查询 Trace，独立标签域                                 |
| `/sayings/tags`、`/sayings/tags/:tag` |   否 |    否 |     是 | 仅查询 Saying，独立标签域                                |
| `/archives`                           |   是 |    否 |     否 | 延续 Arthals 的正式文章归档体系                          |
| `/rss.xml`                            |   是 |    否 |     否 | 主 RSS 只发布 Blog；首版不新增 Trace/Saying feed         |
| Home Timeline                         |   是 |    否 |     否 | 只由 Blog 自动生成                                       |

标签机制统一、数据域隔离：同名标签在三种类型中是三个独立作用域，不做跨类型聚合。三个类型都可以通过配置关闭标签能力；当前 schema 允许 Saying 使用可选 `tags` 字段。旧 `/tags` 和 `/tags/:tag` 直接删除，不做重定向，因为当前内容仅为测试数据。

### 8.4 标签入口落地规则

为解决 Trace/Saying “有内部标签能力、但前端找不到入口”的问题，归档页采用统一的发现层：

- `/traces`、`/sayings` 标题下显示最多 6 个热门标签，并保留 `View all tags` 到各自的标签索引。
- 标签数量为 0 时仍保留索引入口，同时显示中性空状态；Saying 的 `tags` 继续是可选元数据，暂不为临时内容补造标签。
- 标签不放进 Media 整卡链接内部，卡片继续保持一个主链接；已有详情页标签链接和三组作用域标签结果页保持不变。
- 入口由共享的 `ContentArchiveTaxonomy.astro` 渲染，标签计数由统一内容层提供。以后新增类型时沿用 registry → catalog/query → shared entry 的链路。

### 8.5 搜索页的标签类型入口

主导航中的搜索图标继续直接指向 `/search`，不改成弹出菜单，也不把 Blog、Trace、Saying 追加到主导航的固定六项中。搜索页使用一个统一的 Pagefind 筛选面板：第一层切换 `All`、`Blog`、`Trace`、`Saying`，选中内容类型后才显示该类型自己的标签。

- 面板数据由 `getContentTagBrowserEntries(loadContentCatalog())` 生成；内容类型的顺序、显示名称、标签数量和标签计数都来自 registry/catalog，不在页面内手写三组分支。
- 类型按钮和标签复选框会调用 Pagefind 的 `triggerFilters()`：类型映射到 `content-type` filter，标签映射到 `tag` filter；多个标签在同一类型内按“任一标签命中”处理，类型与标签之间按“同时满足”处理。
- Pagefind 默认的内置标签面板被隐藏，只保留这一套可解释的筛选面板；标签归档仍由 `/blog/tags`、`/traces/tags`、`/sayings/tags` 提供，不把归档链接重复塞进搜索页。
- 搜索筛选状态同步到 `?type=` 和重复的 `?tag=` 参数，便于刷新或分享；移动端筛选面板默认收起，桌面端作为左侧固定筛选栏显示。未来新增带标签能力的内容类型后，只需完成 registry、policy 和对应内容数据，它会自动加入筛选面板。

## 9. Home 固定结构

Home 从上到下固定为：

1. Media 六图 Hero。
2. 四层波浪。
3. 随机 Saying 装饰图卡片。
4. 头像、站点作者名与共享个人简介（ProfileIntro）。
5. 最近 Blog 与最近 Traces 左右双栏。
6. 只由 Blog 自动生成的 Timeline。
7. Education 教育经历卡片。
8. SkyWT 居住地地图。
9. HanLife GitHub 热力图。

ProfileIntro 位于完整 Saying 区块之后。它只复用 About 页 General Talk 的角色
与介绍正文；Home 与 About 使用各自的布局，但文案来自同一份 profile 数据源。

Home 的 Saying 与 ProfileIntro 只共用一个纵向分组容器；该容器保持 `100%` 宽度，
与后续 Recent、Education、Residence 共用 Home 的外层内容轨道。Saying 的 Media
卡片只在 Home 范围内移除原归档卡片的水平外边距（保留垂直留白和斜边），因此卡片、
Saying 的 `View all`、About 标题和 `More about me` 都由同一条外层轨道确定边界，
不使用绝对定位或负外边距。About 与 Recent、Education、Residence 复用同一套标题
字号、字重和字距；语义上均为 `h2`，让 Hero 继续拥有 Home 唯一的文档级 `h1`。

Home 中所有“向前浏览”的站内入口（More about me、View all）统一使用
`astro-pure` 的 `ahead` 按钮；返回入口继续使用 `back`，标签和技能继续使用
`pill`，外部 GitHub 链接保留普通外链样式。Saying 标题在视觉上隐藏但保留可访问的
`h2`；About 使用与其他 Home 主区块一致的 `h2` 视觉规格，不新增第二个语义 `h1`。

双栏规则：

- Blog 在左，Traces 在右。
- 默认各取 3 条，彼此独立排序和截取。
- 容器变窄时转为纵向，Blog 在上、Traces 在下。

## 10. 内容模型

字段名在实现时优先兼容 Arthals 和历史项目现有 schema；以下是当前实现的最小语义契约。

### 10.1 Blog

- `title`
- `description`
- `publishDate`
- `updatedDate?`
- `tags`
- `language?`
- `draft`
- `comment?`
- `heroImage?`（含可选 `alt`、尺寸和颜色信息）
- Markdown/MDX 正文

`heroImage` 可用于详情或社交预览，但 Blog 列表始终使用无图卡片。

### 10.1.1 三类内容字段对照

| 语义              | Blog                  | Trace                           | Saying                                 |
| ----------------- | --------------------- | ------------------------------- | -------------------------------------- |
| 主标题/主句       | `title`               | `title`                         | `text`                                 |
| 列表摘要          | `description`（必填） | `description?`                  | 不设摘要字段                           |
| 发布时间          | `publishDate`         | `publishDate`（必填）           | 不设置                                 |
| 更新日期          | `updatedDate?`        | 不设置                          | 不设置                                 |
| 主题标签          | `tags`                | `tags`                          | `tags?`                                |
| 内容图片          | `heroImage?`          | `cover?`（有图时需 `coverAlt`） | 仅使用独立装饰图，不从内容字段读取图片 |
| Markdown/MDX 正文 | 完整文章              | 短记或较长记录的正文            | 仅写补充说明                           |

这个映射保持三种内容可统一检索、路由和阅读壳层，同时保留各自真正需要的字段；不通过给 Saying 或 Trace 强行补齐 Blog 字段来制造“统一”。

### 10.2 Trace

- `title`
- `description?`
- `publishDate`
- `tags`
- `draft`
- `cover?`
- `coverAlt?`
- Markdown/MDX 正文

上传内容题图时必须提供有意义的 `coverAlt`。自动回退装饰图使用空 alt。

### 10.3 Saying

- `text`（主展示短句）
- `originalText?`（有原文时作为简单的次要文本展示）
- `author?`
- `source?`（纯文本出处，可选）
- `draft`
- 无日期、无语言字段；`sourceUrl?` 和 `tags?` 仅在有数据时使用
- 可选 Markdown/MDX 正文，仅用于补充说明，不重复正文短句

迁移旧 Saying 时，删除 `publishDate`、`originalLanguage` 等不属于当前 schema 的历史字段；`sourceUrl` 和 `tags` 若存在则按当前可选字段处理，不参与日期排序。

Slug 或内容 ID 必须稳定，不能使用数组下标作为路由。

### 10.4 Saying 的两个入口与空集合

- Home 的随机 Saying 使用一张 Media 装饰图卡片；整卡及明确的“查看完整内容”链接都指向当前条目的 `/sayings/{slug}`。
- About 只提供通往 `/sayings` 完整归档的入口，不渲染第二套随机卡片或第二套归档。
- 当集合为空时，Home 整段不渲染，不保留空卡片或空白占位；About 入口仍可进入 `/sayings`，归档页展示明确空状态。
- 随机选择只在有内容时发生；单条集合必须稳定返回该条。

## 11. 卡片系统

产品上有三种卡片，代码层只有两个视觉原语。

| 业务用途 | 默认 presentation        | 视觉来源   | 图片规则                   |
| -------- | ------------------------ | ---------- | -------------------------- |
| Blog     | `text`           | Arthals    | 列表永远无图               |
| Trace    | `media-content`    | Media | 内容题图优先，否则稳定回退 |
| Saying   | `media-decorative` | Media | 独立装饰图库按归档顺序循环 |

### 11.1 三个资源池

配置必须保留三个独立数组：

- `heroSlides`
- `sayingDecorativeImages`
- `traceFallbackImages`

当前用户图库已落地：`heroSlides` 使用 6 张固定顺序图片，`sayingDecorativeImages` 使用 34 张，`traceFallbackImages` 使用 20 张；三组数据层仍保持独立，且 Saying/Trace 并集覆盖全部 54 张本地 WebP。

### 11.2 显示策略

卡片不能在内容类型内部硬编码。解析顺序为：

1. 页面上下文显式覆盖。
2. 内容类型默认 presentation。
3. 安全回退。

这允许以后在其他页面复用卡片，不会把 Blog、Trace、Saying 与某个视觉组件永久绑定。

### 11.3 图片分配

- Saying/Trace 归档页：先按每张素材已经确认的布局变体拆成“图片在左”和“图片在右”两个固定队列，再从左队列、右队列严格交替取图；绝不为了凑交替而翻转某张图片的斜边。若两队长度不同，只在较短队列均匀重复，并在运行时元数据中标记重复次数。
- Saying 的 Home 随机卡片仍复用该条目的稳定装饰图；Trace 的非归档场景仍优先使用内容题图、无图时按稳定内容 ID 哈希选择回退图片。
- Saying 装饰图与 Trace 回退图都属于装饰信息，alt 为空。

归档页的占位内容使用 `card-preview-*` 前缀生成，数量按两个固定队列中较长的一队补齐到偶数槽位，确保开发阶段可以逐张检查全部本地素材；这些文件是可识别、可批量移除的临时内容，不改变正式内容 schema。当前候选不包含这些占位文件；需要复核时才运行生成脚本，审阅后移出。

## 12. 组件来源与复用边界

| 模块                                        | 主要来源                                                                                  | 实施方式                      | 允许调整                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| 页面骨架、Header、Footer、主题、文章页、TOC | Arthals-Ink                                                                               | 直接复用 + 略调               | Astro 6、导航、配置                                      |
| Blog 内容与列表                             | Arthals-Ink                                                                               | 直接复用 + schema 适配        | 候选允许空集合；公开内容逐篇确认                         |
| Blog 无图卡片                               | Arthals-Ink                                                                               | 直接复用                      | 只做数据适配                                             |
| Traces 数据和详情                           | 历史项目 notes/traces                                                                     | 直接复用 + 重命名             | 最终 Trace schema                                        |
| Sayings 数据和详情                          | 历史项目 says                                                                             | 直接复用 + 重命名             | 路由改为 `/sayings`                                      |
| Media Hero 与波浪                      | 原网站视觉核心 + 历史 `ShokaHero` 生命周期外壳 + 本项目挂载胶水                           | 混合复用                      | 原 DOM/CSS/动画参数；仅适配 Astro、路由和 reduced-motion |
| Saying 卡片                                 | Media 原 DOM/CSS/hover/斜边 + 本项目 Saying 查询和装饰图策略                         | 直接视觉复用 + 薄封装         | 不改原视觉，只接本地数据与无障碍语义                     |
| Trace 卡片                                  | Media 原 DOM/CSS/hover/斜边 + 本项目 Trace 查询和回退策略                            | 直接视觉复用 + 薄封装         | 不改原视觉，只接内容图、回退图与无障碍语义               |
| Home 最近内容双栏                           | 历史项目                                                                                  | 略微调整                      | Blog/Traces 各 3 条                                      |
| Blog Timeline                               | 历史 `NotesPreview`                                                                       | 基本直接复用                  | 删除 notes 模式，只接 Blog                               |
| 根路径入口                                  | 历史 `EntranceScene`                                                                      | 直接复用 + 略调               | 删除 session 跳过                                        |
| 入口文字动画                                | xyx404 参数/交互 + `typed.js@2.1.0`                                                       | 原方案复用 + 必要版本固定     | 不使用原站浮动 CDN；只改文案、挂载点和销毁逻辑           |
| 音乐引擎和状态                              | 参考站 APlayer/MetingJS + 历史 `MusicPlayer` 生命周期                                     | 混合复用                      | 公共网易云歌单、持久化、单例                             |
| 音乐紧凑视觉                                | xyx404 原 DOM/CSS/可见状态 + APlayer 状态接口                                             | 混合复用                      | 直接移植 `#nav-music` 紧凑视觉；歌单 ID 集中配置         |
| George 花瓣                                 | George 原算法                                                                             | 原核心 + 历史生命周期         | Links 专用、清理                                         |
| George 点击粒子                             | George 原算法                                                                             | 原核心 + 历史过滤             | 仅空白区域                                               |
| PKU 三层背景                                | PKU 原脚本                                                                                | 直接算法 + 新管理器           | 补第三层、路由启停                                       |
| SkyWT 居住地                                | 历史项目                                                                                  | 几乎直接复用                  | 视觉参数和测试                                           |
| GitHub 热力图                               | HanLife/Astro-star                                                                        | 原组件、解析、CSS 直接复用    | 用户名、缓存、失败回退                                   |
| 一言/Saying 体系                            | Innei 仅提供产品思路；历史项目提供数据、随机、查询和详情；本项目提供 collection/路由适配  | 历史代码直接复用 + 本项目略调 | 不使用 Innei/Yohaku 代码                                 |
| About 右侧小人                              | 当前 Tracer 素材与项目校准滚动曲线 + 历史 `ScrollCompanion` 生命周期外壳 + 本项目路由胶水 | 混合复用                      | 仅 About、≥1440px；不使用 TNXG 旧仓库实现                |
| Links 基础页                                | Arthals-Ink                                                                               | 直接复用                      | 加花瓣和点击粒子                                         |
| About Sayings 入口                          | 本项目                                                                                    | 自行开发                      | 复用 Saying 查询和卡片                                   |
| `VisualEffectsHost`                         | 本项目                                                                                    | 自行开发                      | 仅启停、去重、销毁                                       |
| 卡片策略解析器                              | 本项目                                                                                    | 自行开发                      | 不实现视觉                                               |
| 图片顺序、随机、哈希回退                    | 本项目                                                                                    | 自行开发                      | 纯策略函数                                               |
| 测试                                        | 历史测试 + 新测试                                                                         | 大量复用 + 补充               | 新路由和生命周期                                         |
| Pages workflow                              | Astro/GitHub 官方模板                                                                     | 官方方案配置                  | 无 schedule                                              |

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

### 13.2 Media Hero 与波浪

- 六张静态图片。
- 总周期约 36 秒，相邻图片相差 6 秒。
- 淡入淡出并从 `scale(1)` 缓慢到约 `scale(1.1)`。
- 品牌可见区域约 50vh，背景约 70vh。
- 四层 SVG 波浪：桌面约 15vh，移动端约 10vh。
- 四层周期约 7/10/13/20 秒，并保留负延迟。

### 13.3 Media 卡片

- 桌面为 50/50 图文比例。
- 图片左右交替，斜边方向同步变化。
- Hover 约 200ms，`scale(1.05)` 并旋转约 ±1°。
- 移动端改为上下布局并保留对应斜边。
- Trace 上传图是内容图；Saying 和 Trace 回退图是装饰图。

### 13.4 xyx404 文字与音乐

- Typed.js 基准参数：`startDelay=700`、`typeSpeed=62`、`backSpeed=34`、`backDelay=1700`、循环。
- 原站当前通过浮动 CDN 加载的版本不可复现；本项目固定 `typed.js@2.1.0`（MIT），保留同一 API 和上述动画参数，并由 Astro 生命周期显式销毁。
- 文字只放在根入口视频上，不放在 Home Media Hero。
- 音乐暂通过 APlayer/MetingJS 读取参考站歌单对应的公共网易云服务。
- 首次播放必须由用户操作触发。
- ClientRouter 内部跳转时持续播放且只有一个持久化播放器；实际 Audio 由 APlayer 按需创建。
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

只采用“时间线/一言”的产品思路，不使用当前 Yohaku 代码。Timeline 直接使用历史项目方案，并且只从 Blog 自动生成，不产生新内容类型。Home 默认选择不晚于当前年份的最新有文年份（按 `Asia/Shanghai` 计算）；当前年份没有文章时自动回退到上一有文年份。没有可用 Blog 时，Home 整段不渲染；Blog 归档仍保留明确空状态。

### 13.10 TNXG 小人

- 只出现在 About。
- 使用项目当前的 `tracer-companion.webp`，不回退到历史图片。
- 采用连续的轻微右移与长尾淡出：动画按 About 实际可滚动距离的 88% 结束，最大右移 22%、旋转 10°，在时间轴 68% 后平滑淡出；小人不会常驻到页面底部，也不会在前段停滞或因大位移提前被裁切。
- 使用历史 `ScrollCompanion` 的 custom element/lifecycle 外壳。
- 仅在宽度 ≥1440px 时显示。
- 不增加呼吸和点击交互。

## 14. 页面特效矩阵

| 页面                                               | PKU 三层 | 点击粒子 | 花瓣 |    TNXG | 音乐       |
| -------------------------------------------------- | -------: | -------: | ---: | ------: | ---------- |
| `/`                                                |       否 |       否 |   否 |      否 | 不挂载     |
| `/home`                                            |       是 |       是 |   否 |      否 | 完整       |
| `/blog`                                            |       是 |       是 |   否 |      否 | 完整       |
| Blog 详情                                          |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/traces`                                          |       是 |       是 |   否 |      否 | 完整       |
| Trace 详情                                         |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/sayings`                                         |       是 |       是 |   否 |      否 | 完整       |
| Saying 详情                                        |       否 |       否 |   否 |      否 | 折叠、继续 |
| `/projects`                                        |       是 |       是 |   否 |      否 | 完整       |
| `/about`                                           |       是 |       是 |   否 | ≥1440px | 完整       |
| `/links`                                           |       否 |       是 |   是 |      否 | 完整       |
| `/search`、三组作用域标签页、标签分页、`/archives` |       是 |       是 |   否 |      否 | 完整       |
| 404 和其他普通静态页                               |       是 |       是 |   否 |      否 | 完整       |

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

播放器使用 Astro 持久化 DOM 或等价单例状态。不得在每次页面切换时重新构造播放器。歌单 ID、服务端、API 模板和播放参数集中在 `src/data/music.ts`；音频、封面与歌词由公共 Meting 服务按需返回。

## 16. 外部服务与网络白名单

网络策略按“已确认功能例外”和“未知资源逐项审查”执行。当前已确认、可以继续保留的运行时是：

- CARTO 地图样式/瓦片，以及用户主动授权后的浏览器 Geolocation。
- 公共网易云 Meting 播放器：`cdn.cbd.int` 中登记的 APlayer/MetingJS 三个精确资源路径，以及 `api.injahow.cn/meting/` 的当前歌单接口。
- 生产 Umami：`cloud.umami.is/script.js`。
- CodeTime 徽章：`shields.jannchie.com/endpoint`。
- Waline：`https://waline-susurrium.vercel.app`（配置启用时由门禁核对配置与客户端输出）。
- 构建期 GitHub 公开贡献数据。
- `public/links.json` 中当前友链头像；Friend Circle 本身关闭，不渲染、不请求。

未知的外部 `img`、`source`、`audio`、`video`、`iframe`、脚本或样式不会在开发期阻断，但 `verify:phase6` 会报告精确 URL 和页面；`release:gate` 会要求逐项决定（通常下载到仓库内），禁止用整域名白名单掩盖文章媒体。普通正文超链接不属于这项媒体阻断。

## 17. 静态资源预算

GitHub Pages 站点和带宽有限，视频与音乐必须在开发初期治理。

| 资源                 |     推荐目标 |       硬门禁 |
| -------------------- | -----------: | -----------: |
| 单张 Hero/卡片输出图 |     ≤500 KiB |       ≤2 MiB |
| 单个入口视频         |      ≤20 MiB |      ≤50 MiB |
| 单曲音频             |      ≤12 MiB |      ≤25 MiB |
| 首版本地音乐总量     |        0 MiB |        0 MiB |
| 单个任意仓库文件     |            — |      <50 MiB |
| `dist` 总量          | 警告 500 MiB | 失败 900 MiB |

地图和低频模块必须懒加载。动画在移动端和 reduced-motion 下按原站或方案降级。

## 18. 测试与质量门禁

### 18.1 必须通过

- `bun install --frozen-lockfile`。
- `astro check`。
- `astro build`。
- 关键策略单元测试。
- 浏览器自动化关键路径（可用 Playwright 或等价的 Chrome CDP 验证）。
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
- 连续跨 10 个页面后无重复 canvas/监听器（`verify:browser:lifecycle` 以真实 ClientRouter 点击、唯一宿主/iframe/音乐 DOM 计数和运行时异常检查验证）。
- 已保存暗色主题的直接 Home 访问不会让 PKU/点击效果 iframe 合成为遮挡内容的白色页面（`verify:browser:lifecycle` 以独立暗色目标页截图的暗像素比例验证）。

### 18.3 Arthals 视觉基线门禁

“视觉和架构基本完全一致”按可验证基线执行，不只依赖主观描述：

- 以冻结的 Arthals 上游构建为参照，把其首页 `/` 与本项目实际 Home `/home` 对照。
- 对照 Header、Footer、Blog 列表、Blog 详情、标签、归档、搜索、About 和 Links。
- 每个基准页面至少覆盖桌面、移动端、明色和暗色四种组合。
- 允许差异只包括本文登记的导航、内容结构、目标组件、个人配置以及 Astro/Pure 兼容适配。
- 未登记的字号、间距、颜色、圆角、布局或交互差异视为视觉回归失败；必要差异必须先写入方案或来源台账。

可重复取证命令为 `bun run capture:visual-baseline`。它以冻结上游的 `/` 对当前 `/home`，并采集七个默认共享页面的桌面/移动、明/暗主题顶部和底部截图（112 张）；详情页通过 `VISUAL_CURRENT_BLOG_DETAIL_PATH` 等环境变量按当前内容可选加入，最多九页、144 张。结果及 DOM 壳层量测写入不纳入版本控制的 `artifacts/visual-baseline/manifest.json`。截图由人工依照 `docs/VISUAL_BASELINE.md` 的差异台账复核；由于首版明确包含动态特效、个人内容和目标组件，不能以未经掩码的像素差异替代该台账。

## 19. 开发阶段

### Phase 0：来源和基线冻结

交付：

- 上游 SHA 和标签。
- 参考来源台账。
- 历史项目状态和安全快照。
- 目标工具链验证。

状态：已完成。仓库、来源台账、历史快照、目标构建、准备提交和 GitHub Linux CI 均已闭环；后续功能阶段均以该冻结基线为准。

### Phase 1：信息架构与内容模型

交付：

- `/` 与 `/home` 分离。
- Blog、Trace、Saying 三个 collection。
- 列表/详情路由和最终导航。
- 测试占位内容。

验收：所有路由静态生成，无重复 slug，生产构建排除 draft。

状态：已完成。根入口与 Home 已分离；Blog、Trace、Saying 三个 collection、归档/详情静态路由、主导航边界和空集合行为均已建立。`verify:phase1` 已覆盖 draft 排除、路由、导航和 Blog-only 聚合边界；历史内容暂不纳入当前候选并由外部快照保留，恢复与公开仍需逐项确认。

### Phase 2：卡片与 Home 主体

交付：

- Arthals Blog 卡片。
- Media 通用卡片。
- 三种 presentation 策略。
- Hero、waves、随机 Saying、双栏和 Blog Timeline。

状态：已完成。Media 锁定图仍保留用于回归，当前用户图库已本地化为 54 张 WebP；Home 按确认顺序输出 6 张 Hero、四层波浪、客户端逐访随机 Saying、ProfileIntro、Blog/Traces 3+3 双栏、Blog-only 时间线、Education、Residence 和 GitHub 活动。ProfileIntro 与 About 共享同一份介绍数据，头像与 About 标题采用已确认的 Home 视觉层级；所有站内前进型入口统一使用 `ahead` 按钮。所有列表和 Home 的卡片都经统一策略宿主解析；无日期 Saying 以内容 ID 固定归档顺序；归档卡片在 767px 以下保持原站纵向斜边布局，About 已提供唯一的 Saying 归档入口。`verify:phase2`、纯策略测试、静态构建和 Home 浏览器核验均已通过。

### Phase 3：入口与音乐

交付入口视频、Typed.js、手动进入、持久音乐和详情页折叠。

状态：已完成。`/` 独立为每次直达都播放的本地视频入口，保留键盘进入并以 `location.replace('/home')` 进入 Home；Typed.js 固定在本地 `2.1.0`。正常页面配置唯一、持久化的 APlayer/MetingJS 网易云播放器，歌单暂锁定参考站 `12812783625`，详情页使用紧凑控制且首次播放仍需用户操作。ClientRouter 下的 Header、随机 Saying、签名、图片放大和版权二维码均具备明确的挂载/断连清理；图片放大和二维码运行时已从 Pure 的 CDN 改为固定的本地依赖。针对 Chromium 原生 View Transition `ready` 的可恢复中止，已加入窄范围 rejection guard，不掩盖其他错误。生产构建、`verify:phase1`、Phase 2 策略/静态验证、`verify:phase3`、资源预算以及入口到 Blog/Trace/Saying 的实际 Chrome 连续点击回归均已通过。

### Phase 4：全局效果

交付 PKU 三层、George 点击粒子、Links 花瓣和统一生命周期。

状态：已完成。PKU 三层和 George 花瓣/点击所需的原始脚本已按锁定 SHA-256 本地化，运行时无参考站、CDN 或第三方效果脚本热链。项目自行开发的 `VisualEffectsHost` 以短生命周期同源 iframe 隔离并按原顺序执行原算法，负责 Astro ClientRouter 切换、页面隐藏、减少动画和设备条件变化时的创建、去重与彻底释放；原脚本本身不改写。`standard`（PKU + 点击）、`reading`（全关）、`links`（花瓣 + 点击）和 `about`（PKU + 点击，等待 Phase 5 小人）已接入全站页面 profile。PKU 保留来源页的三层参数，Links 保留原 50 花瓣，空白点击桥接至原 20 粒子与圆环实现；正文/页脚在内容层，Header 和播放器不被内容壳的堆叠上下文限制，始终在花瓣/点击层之上。静态 SHA/产物检查、profile 策略测试和生产预览中的桌面、移动、减少动画、滚动转发、空白点击过滤及多轮连续路由回归均已通过。

### Phase 5：特色模块

交付 SkyWT 居住地、HanLife 热力图、TNXG 小人和 About Sayings 入口。

状态：已完成。Home 在 Blog-only Timeline 之后按 Education → Residence 顺序接入教育卡片和来自历史项目的 `ResidenceCard`、`FlightOverlay`、地图控制器、几何函数和 CSS；只将内容配置、图标和 Astro base path 适配到当前项目。MapLibre `5.24.0` 的已构建 UMD JS/CSS 固定在本仓库并在组件进入视口前后才加载，保留静态 poster、CARTO/OSM 地图失败回退、Globe、定位、航线、主题切换、减少动画和 ClientRouter 清理。HanLife 热力图直接复用了 53 周 DOM、公开 GitHub HTML 解析和视觉层级，用户名为 `Susurrium`；不使用 Token、定时任务或伪造数据，失败时仅显示中性骨架。About 小人使用项目当前的本地 `tracer-companion.webp`，以连续轻微右移（最大 22%、10°）和长尾淡出（时间轴 68% 开始、页面可滚动距离 88% 结束）适配新素材；历史 `ScrollCompanion` 只提供 custom element 和生命周期；仅 About、宽度 ≥1440px 且非减少动画时显示，容器按本项目 70rem 主内容宽度校准。About 的 Saying 完整入口已在 Phase 2 随 Sayings 路由提供，本阶段完成回归确认。`test:phase5`、`verify:phase5`、生产构建和浏览器回归均为验收门槛。

### Phase 6：发布审计

交付 SEO、RSS、sitemap、404、性能、无障碍、基于最终渲染产物的占位扫描、网络扫描和受门禁保护的 Pages 部署。

当前实施边界：

- 已建立面向最终生成 DOM/资源的生产产物审计与严格发布门禁；当前候选的渲染结果必须在新构建后通过严格门禁。历史内容暂不纳入候选是当前阶段的工作树边界，不等于站长确认永久删除或历史重写。
- 入口页、404 和搜索工具页必须 `noindex`；sitemap 只收录可索引公开路由，不收录 `/` 入口页或 draft。
- RSS 只输出 Blog；无题图的文章不生成空的图片或 enclosure URL。
- 当前部署仍只有手动触发；workflow 在上传产物前强制执行严格门禁，且不执行会写回链接清单的检查。替换最终资料并通过严格门禁后，再经用户确认启用 `main` 自动部署和 GitHub Pages 的真实设置。

验收命令：`bun run ci`（含 `test:all`）、`bun run links:check:dry` 与 `bun run release:gate --strict`。线上发布还需验证 GitHub Actions 成功、`https://susurrium.github.io/` 可访问，以及 canonical、RSS、sitemap 与 404 均指向最终域名。

状态：本地 CI、生产产物审计、移动端目录浏览器回归和真实 ClientRouter 跨页生命周期回归均已实现并按候选构建验证；后者包含入口重放、公共音乐唯一性、各页面特效 profile、About-only 小人、空白点击过滤、reduced-motion、Blog/Trace 公共 Opening Media 滚动恢复、直接暗色 Home 的透明 iframe 合成和无未捕获异常。Home 的 Saying 与 Blog Timeline 在对应集合为空时整段不渲染，Blog/Trace/Saying 归档仍保留明确空状态；Timeline 按 Asia/Shanghai 选择不晚于当前年的最新有文年份。Links 的 Friend Circle 已从输出和请求路径移除，但历史代码可保留。Waline、生产 Umami、CodeTime 和公共音乐按已登记例外保留；未知远程媒体由严格门禁逐项列出。候选已完成干净 worktree 验证、素材/隐私权利复核记录和自动化视觉/浏览器检查；当前没有修改远端 Pages 设置、没有推送到 `main`，也没有触发部署。

## 20. 主要风险与处理

| 风险                             | 处理                                                 |
| -------------------------------- | ---------------------------------------------------- |
| Pure 与 Astro 小版本不一致       | 首版锁 6.1.8；升级必须独立验证                       |
| npm Pure 缺少参考项目自定义导出 | 本地登记并维护单一共享组件，并通过来源台账追溯原始实现 |
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
- 历史项目中不够准确的 Media 视觉核心。
- 历史自制花瓣绘制核心。
- 历史自制点击粒子绘制核心。
- 历史自制 Typewriter 核心。
- 历史热力图视觉。
- 当前 Innei Yohaku 代码。
- 未登记的音乐 API、播放器脚本或热链资源。
- 完整 SkyWT React/Framer 应用。
- TNXG 旧公开仓库代码。
- 不受生命周期管理的全局脚本。

## 22. 最终发布前替换清单

- 入口视频。
- Typed.js 文案。
- 六张 Hero 图（当前用户图库已完成；发布前人工复核）。
- Saying 装饰图库（当前用户图库已完成；发布前人工复核）。
- Trace 回退图库（当前用户图库已完成；发布前人工复核）。
- 公共音乐歌单 ID 与运行时参数（如需替换）。
- 头像、Logo、站名、简介和社交链接。
- 居住地坐标与文案。
- Projects、Links、About。
- Blog、Trace、Saying 测试内容。
- `retrospective` 开发测试材料（最终发布时直接删除，不在日常开发测试中删除）。
- Projects 中的测试项目、测试链接和相关说明。
- OG 图、favicon、站点描述。
- 原作者占位资源和文字。
- 所有 TODO、demo、placeholder 和测试域名。

开发期间允许占位存在；正式发布门禁必须报告并清除。最终发布时先删除/替换已确认的测试内容，再逐项处理门禁列出的未知远程媒体；不需要现在为了让开发测试通过而清空内容。每一项的唯一替换入口和发布顺序见 [最终内容替换与 GitHub Pages 发布交接](./FINAL_RELEASE_HANDOFF.zh-CN.md)。

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
