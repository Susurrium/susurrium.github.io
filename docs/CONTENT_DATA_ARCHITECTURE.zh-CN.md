# 统一内容数据层实施规范（最终版）

本文是 Blog、Trace、Saying 统一数据层的最终开发依据。它定义数据边界、页面层级、组件契约和视觉基线；后续新增内容类型或页面时，应优先遵守本文，而不是重新设计一套页面专用数据结构。

## 1. 目标与范围

### 1.1 目标

- 将 Blog、Trace、Saying 的内容读取、筛选、排序、路由和卡片字段转换收敛到一个内容层。
- 固定所有列表页和详情页的外层层级：

  ```text
  PageData → sections → groups → items
  ```

- 让页面只决定“这一组内容在本页面中的含义”，不再直接理解三个 collection 的 frontmatter。
- 对于视觉完全相同的卡片，只保留一个视觉组件和一个公共数据契约。
- 保留现有成熟卡片、详情阅读界面、布局、动画和响应式行为的渲染基线。

### 1.2 范围

本次统一的内容类型和入口如下：

| 内容类型 | 内容集合 | 公开路由     | 默认排序                                     |
| -------- | -------- | ------------ | -------------------------------------------- |
| Blog     | `blog`   | `/blog/*`    | 编辑日期倒序（`updatedDate ?? publishDate`） |
| Trace    | `trace`  | `/traces/*`  | 发布时间倒序                                 |
| Saying   | `saying` | `/sayings/*` | 稳定 `id` 正序                               |

已纳入统一层的页面包括 Home、Blog 列表、标签页、归档页、Trace 列表、Saying 列表、三类详情页和 RSS。`docs` collection 仍是独立内容类型，不在本次 Blog/Trace/Saying 统一范围内。

### 1.3 明确不做的事情

- 不把三个物理 collection 合并成一个 Markdown 目录；它们的 schema 和正文形态仍然独立。
- 不把视觉不同的卡片强行做成一个巨型组件。
- 不为了“统一数据”重写现有卡片的 HTML、CSS、动效或详情布局。
- 不把原始 Astro collection entry 放进 `PageData` 静态路径 props。

## 2. 不可破坏的视觉基线

“视觉不变”以生产构建后的 DOM、class、资源选择、响应式断点和交互契约为基线，而不是以旧的数据耦合方式为基线。

以下实现是冻结的视觉原语，数据层迁移不得修改其最终渲染结构和样式：

- 文本卡片视觉族：`TextCard.astro`。它是唯一的通用文本卡片渲染器；`BlogTextCardAdapter.astro` 只作为 Blog 阅读时间等构建期元信息的兼容适配器，最终视觉仍落到同一套文本卡片结构。
- `TextCardCompat.astro` 保留为旧调用的兼容门面；视觉相同的无图文案统一通过 `StandardCardData` 输入。
- Trace 卡片：`TraceCard.astro` → `MediaCard.astro`。
- Saying 卡片：`SayingCard.astro` → `MediaCard.astro`，继续使用装饰图策略。
- Media 的 HTML、CSS、移动端纵向布局、偶数项镜像和图片 fallback 策略。
- Blog 详情：`BlogPost.astro` 及其正文、目录、版权卡片、图片缩放和阅读背景行为。
- Trace 详情：`TracePost.astro` 的阅读界面和导航行为；文章底部版权卡片按策略关闭。
- Saying 详情：`SayingPost.astro` 的原文/译文、署名和阅读界面；文章底部版权卡片按策略关闭。
- Home 的 Hero、Recent 两列、随机 Saying、Timeline，以及现有布局 CSS 和客户端脚本。

允许改变的是“组件收到数据的方式”和“页面如何取得数据”；不允许改变的是上述组件产出的视觉和交互结果。详情页因此保留了旧布局所需的 raw entry 传入，但 raw entry 只能在渲染边界通过稳定 key 回查，不能成为页面数据层的公共结构。

## 3. 四层职责与唯一数据流

统一层采用单向数据流：

```text
Astro collections
       ↓ 仅 catalog.ts 读取
Source Adapter（adapters.ts）
       ↓
ContentCatalog / ContentRecord（内容语义）
       ↓ query + page builder
PageData → sections → groups → PageItem（页面组合）
       ↓ projection
StandardCardData / MediaCardData（视觉输入）
       ↓ render boundary 必要时 hydrate
现有视觉组件与详情布局
```

四层的职责必须保持分离：

1. **Source 层**：只负责 Astro collection entry 和 schema。
2. **Content 层**：把不同 schema 转成统一的内容语义；不包含页面位置和 CSS 决策。
3. **Page 层**：决定 section、group、顺序、分页、关联内容和本页面的含义。
4. **Presentation 层**：把内容语义投影成某个视觉原语需要的字段；不再读取 frontmatter。

生产代码中，只有 `src/lib/content-layer/catalog.ts` 可以直接调用 `getCollection()`。页面、卡片和普通组件不得直接读取 `blog`、`trace` 或 `saying` collection。

## 4. 内容层的固定契约

### 4.1 ContentRecord

统一内容本体是带判别字段的联合类型：

```ts
type ContentRecord = BlogRecord | TraceRecord | SayingRecord
```

所有记录共有以下字段：

```ts
interface ContentRecordBase {
  key: string // `${kind}:${id}`，跨页面稳定
  kind: 'blog' | 'trace' | 'saying'
  id: string // collection id，同时用于详情 slug
  href: string
  title: string // 内容语义主标题；Saying 为 quote text
  cardTitle: string // 卡片显示标题
  description?: string
  publishedAt?: Date
  updatedAt?: Date
  tags: readonly string[]
  draft: boolean
}
```

类型专属字段只放在对应的分支中：

- `BlogRecord`：`language`、`comment`、`image`。
- `TraceRecord`：`image`。
- `SayingRecord`：`originalText`、`author`、`source`、`sourceUrl`。

适配器位于 `src/lib/content-layer/adapters.ts`。适配器只做字段语义转换，不决定某个页面显示为哪种卡片。

### 4.2 ContentCatalog

`loadContentCatalog()` 是所有公开内容查询的入口，默认 `mode: 'published'`，因此公共页面不会显示 draft。只有明确的 preview 调用才可以包含 draft。同一构建上下文按 `published/preview` 分别缓存目录，读取失败会清除对应缓存；这只优化构建，不改变内容结果。

```ts
interface ContentCatalog {
  mode: 'published' | 'preview'
  all: readonly ContentRecord[]
  byKind: {
    blog: readonly BlogRecord[]
    trace: readonly TraceRecord[]
    saying: readonly SayingRecord[]
  }
}
```

`LoadedContentCatalog` 另外保存按类型索引的原始 source entry，但它只用于构建时渲染边界的回查，不得嵌套到 `PageData` 中。

查询统一使用 `queryContent()` 和 `sortContentRecords()`：

- `editorial-date-desc`：`updatedAt ?? publishedAt` 倒序；并列时保留输入顺序，兼容原 Blog 编辑顺序。
- `publish-date-desc`：`publishedAt` 倒序；并列时用稳定 key 排序。
- `id-asc`：稳定 key 正序，适用于无日期的 Saying。
- 筛选、标签匹配、offset、limit 都在同一查询策略中完成。

## 5. PageData 的固定层级

页面可以给 section 和 group 起不同的业务名称，但不能改变外层结构：

```ts
interface PageData {
  page: {
    kind: PageKind
    route: string
  }
  sections: readonly PageSection[]
}

interface PageSection {
  key: string
  meaning: string
  title?: string
  groups: readonly PageGroup[]
}

interface PageGroup {
  key: string
  meaning: string
  items: readonly PageItem[]
}

interface PageItem {
  key: string
  contentKey: string
  placement: CardPlacement
}
```

`PageItem` 是页面树中的轻量引用。需要渲染时，`hydratePageItem()` 才在构建期边界回查 `ContentRecord`、必要的 raw Astro entry，并生成 `StandardCardData`；因此 `ResolvedPageItem`/`RenderablePageItem` 属于渲染输入，不属于 `PageData` 本体。

这里的“统一”是结构统一，不是语义抹平：

- Home 的 `recent-writing/blog` 表示最近 Blog。
- Home 的 `recent-writing/trace` 表示最近 Trace。
- 归档页的 `year-2026/posts` 表示 2026 年 Blog。
- 详情页的 `article/primary` 表示当前正文，`related/posts` 表示推荐内容。

这些含义通过 `key` 和 `meaning` 表达；内容记录本身不需要为每个页面增加 `homeTitle`、`archiveTitle`、`detailTitle` 等页面专用字段。

页面构造统一使用 `createPageItem()`、`createPageGroup()`、`createPageSection()`、`createPageData()` 及相应的 `build*PageData()`。页面只负责选择记录和传递页面级 placement（例如 `detailed`、`headingLevel`、`presentation`、`actionLabel`）。

### 5.1 历史展示值的兼容边界

改名不会让历史页面配置失效。`src/lib/compatibility/content-presentation.ts` 是唯一接受旧展示值的输入边界：它把 `arthals-text`、`large-skull-content`、`large-skull-decorative` 分别归一化为 `text`、`media-content`、`media-decorative`。`resolvePresentation()` 和 `createPageItem()` 在进入内容层/页面树前完成归一化，之后只允许流通 canonical union；未知值回退到调用方提供的安全默认值。

兼容映射不应复制到 `ContentPresentation` 类型、内容类型注册表或视觉组件中。这样既能读取历史 JSON/Astro props，也不会让来源项目名称重新成为新的应用级 API。

分页器自身的 `currentPage`、`prev/next URL` 以及侧栏计数属于 Astro 路由/视图控制信息，可以作为页面 props 保留；它们不能改变内容条目的统一 `PageData` 层级，也不能重新携带 collection entry。

## 6. 卡片组件规则：相同视觉只做一个，不同视觉分别保留

这是本次方案最重要的边界。

### 6.1 真正相同的卡片

如果 Blog、Trace、Saying 在某种页面中需要完全相同的视觉，则它们都先投影为同一个：

```ts
interface StandardCardData {
  contentId: string
  contentType: ContentKind
  date?: Date
  description?: string
  footerText: string
  href: string
  image?: ContentImageInput
  title: string
}
```

然后由一个 `TextCard` 渲染（旧调用通过 `TextCardCompat` 兼容门面转入同一实现）。组件只认识这组稳定字段，不认识 Blog frontmatter、Trace schema 或 Saying schema。因此新增第四种内容类型时，只需新增适配器和 `toStandardCardData()` 的映射，不需要复制一份同样的卡片。Blog 需要阅读时间时，只有 `ContentCard` 在 render boundary 将该元信息交给同一文本卡片 renderer；这不是第二套视觉实现。

### 6.2 视觉不同的卡片

视觉不同就保留不同的组件/适配器：

```text
BlogTextCardAdapter（Blog 的增强文本卡片）
TraceCard → MediaCard（有内容图/回退图）
SayingCard → MediaCard（装饰图与 Saying 署名）
```

这不是重复数据层，而是不同的视觉策略。TraceCard 和 SayingCard 不再读取各自 frontmatter，只接收 `MediaCardData`；真正共用的是 `MediaCard` 视觉原语。

### 6.3 Blog 卡片的受控例外

Blog 的 `BlogTextCardAdapter` 仍接收原始 Blog entry，是因为它需要 Astro `render(post)` 相关的阅读时间/正文元信息，并且要锁定当前成熟输出。它是一个明确隔离的增强视觉适配器，不代表其他卡片可以重新直接读取 collection。

`ContentCard` 是唯一的页面级 presentation host：新代码传入一个 `RenderablePageItem`，它根据已经解析好的 `placement.presentation` 选择视觉族。Blog 的阅读时间在 Blog 兼容适配器的渲染边界补入；Trace/Saying 通过同一个 `MediaCard`。旧 props 仅作为迁移兼容入口，内部立即转换为同一个 `PageItem`，不得继续扩展第二套渲染逻辑。

## 7. 各页面的实现约定

| 页面          | PageData 组合                                                                                       | 内容来源/排序                          | 视觉边界                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Home          | `featured-saying/candidates`、`recent-writing/blog`、`recent-writing/trace`、`blog-timeline/year-*` | Blog/Trace 按发布时间；Saying 按 id    | 现有随机 Saying、Blog 卡片、Trace Media、Timeline 不变            |
| Blog 列表     | `content/items`                                                                                     | Blog 编辑日期倒序；独立 pageSize 分页  | 现有 Blog 卡片 DOM/CSS 不变                                            |
| Blog 标签页   | `content/items`                                                                                     | Blog 编辑日期倒序后按 tag 筛选         | 与 Blog 列表相同，路由 `/blog/tags`                                    |
| Trace 标签页  | `content/items`                                                                                     | Trace 发布时间倒序后按 tag 筛选        | 与 Trace 列表相同，路由 `/traces/tags`                                 |
| Saying 标签页 | `content/items`                                                                                     | Saying 稳定 ID 顺序后按 tag 筛选       | 与 Saying 列表相同，路由 `/sayings/tags`                               |
| 归档页        | 每年一个 `year-YYYY/posts`                                                                          | Blog 编辑日期倒序后按年份分组          | 现有年份标题和卡片间距不变                                             |
| Trace 列表    | `content/items`                                                                                     | Trace 发布时间倒序；独立 pageSize 分页 | 现有 Trace/Media 输出不变                                         |
| Saying 列表   | `content/items`                                                                                     | Saying id 正序；独立 pageSize 分页     | 现有装饰卡片输出不变                                                   |
| 三类详情      | `article/primary` + `related/*`                                                                     | 各自类型的详情排序                     | 共用阅读壳层；Blog 保留版权卡片，Trace/Saying 按策略关闭，其余布局不变 |
| RSS           | 不渲染 PageData                                                                                     | Blog 编辑日期倒序                      | 保留原 RSS 字段和可选图片处理                                          |

### 7.1 归档分页能力与独立参数

Blog、Trace、Saying 的主归档都使用同一套分页流程，但保留各自的页面外观和排序规则：

```text
站点配置 contentPagination.<kind>
        ↓
buildCollectionStaticPaths()
        ↓ 先构造完整 PageData，再由 Astro paginate() 切页
Page<PageItem>（data/currentPage/total/prev-next URL）
        ↓
各类型归档页的专属卡片布局 + 共享 Paginator
```

- 分页器组件由 `astro-pure` 提供，站点只负责把 Astro 的 `page.url.prev/next` 转换成统一的 `← Previous` / `Next →` 按钮；类型差异只出现在无障碍标签中。
- 共享逻辑位于 `src/lib/content-layer/pagination.ts`，只统一“排序、完整 PageData、切页、Paginator props”这条数据链，不统一三类页面的 DOM 或视觉。
- 每种内容类型在 `src/site.config.ts` 的 `contentPagination` 中单独设置 `enabled` 与 `pageSize`。例如 `contentPagination.trace.pageSize = 8` 不会影响 Blog 或 Saying。
- `enabled: false` 表示该类型仍走同一条构造链，但输出单页完整归档；重新开启时无需改路由。
- `/traces`、`/sayings` 由 `[...page].astro` 同时承载首页和数字页（如 `/traces/2`）；详情页仍由各自的 `[...slug].astro` 承载。为避免数字文章 ID 与分页路径冲突，启用分页时内容 ID 不能是纯数字。
- 标签结果页也复用同一页大小解析规则，但可在调用处传入不同参数，因此“主归档参数”和“标签结果参数”仍可独立演进。

详情页的 `PageData` 负责当前条目、关联条目和页面语义；正文渲染前通过 `getSourceEntry(catalog, kind, id)` 回查 raw entry，再在渲染边界投影为 `ReadingHeaderData`。raw entry 只用于正文渲染和无法提前得到的构建元信息，不进入公共页面数据或阅读组件。

## 8. 代码组织与新增内容类型流程

当前统一层目录：

```text
src/lib/content-layer/
├── types.ts       # ContentRecord、PageData、卡片输入契约
├── adapters.ts    # collection entry → ContentRecord
├── catalog.ts     # 唯一 getCollection 边界、published/preview、source 回查
├── queries.ts     # 纯排序、筛选策略
├── page-data.ts   # PageData 树和卡片投影
├── card-data.ts   # 视觉族 view model 和投影
├── reading-data.ts # 详情页头/尾的标准数据投影
├── reading-policy.ts # 页面级阅读能力开关和语义布局解析
├── hydration.ts   # 渲染边界回挂 raw source
├── policy.ts       # baseline/uniform/custom 能力和视觉策略
├── registry.ts     # 内容类型、路由、能力和默认 profile 注册表
├── tags.ts         # 按内容类型隔离的标签查询和静态路径
├── pagination.ts    # 主归档/标签页的共享分页构造与 Paginator props
└── index.ts       # 公共出口
```

新增内容类型时按以下顺序处理：

1. 在其独立 collection 中定义 schema。
2. 在 `types.ts` 增加判别分支和必要的类型专属字段。
3. 在 `adapters.ts` 增加适配器和稳定 route/key。
4. 在 `catalog.ts` 增加 source 读取和 published 过滤。
5. 在 `toStandardCardData()` 中补充公共卡片投影；只有视觉确实不同才新增 presentation adapter。
6. 用现有 `PageData` 层级接入页面，不新增页面专用顶层数据形状。
7. 在 `src/pages/<kind>/tags` 下增加薄路由，复用同一标签索引和详情组件；标签查询始终传入明确的 `kind`。
8. 增加 adapter、query、PageData、标签隔离和渲染输出测试。

### 8.1 详情阅读页的公共能力和页面决策

三类详情页共用 `ContentReadingPage`、`ContentReadingShell`、`ReadingHeader` 和 `ReadingFooter`。页头不再接收 Blog/Trace/Saying 的 collection entry，而是接收两份独立契约：

- `ReadingHeaderData`：标题、描述、日期、阅读时间、语言、作用域标签、首图和引文等“有什么数据”。适配器在这里把三种 schema 的字段差异解释一次。
- `ReadingPageConfig.background/header/footer/body`：阅读背景、首图及其附属模糊层、草稿标记、发布日期、更新时间、阅读时间、语言、标签、描述、评论信息、原文、署名、来源链接、分隔线、图片缩放、签名、版权、相关推荐和相邻导航等“当前页面是否展示”。

页头有两个语义布局配方：`article`/`media-first-article` 和 `quote`。它们只负责内容顺序与语义；`ReadingBackground`、`ReadingStats`、`ReadingTags`、`ReadingDescription`、`ReadingOpeningMedia`、`ReadingOpeningMediaBackdrop`、`ReadingEngagement`、`ReadingDivider` 等能力组件负责可复用的局部输出。首图后的模糊层是 Opening Media 的可选附属能力，不属于 Blog 专属组件；当前 Blog 与 Trace 都使用 `layered-blur` 首图配方并开启 `backdrop: { mode: 'on', variant: 'blur' }`，Saying 保持关闭，未来任意类型都可以独立选择。

阅读背景由 `ContentReadingShell` 决策、由 `BaseLayout` 的根层命名插槽承载。当前 `gradient` 变体复刻原有蓝色渐变的节点位置、层级、透明度和 CSS 变量；以后新增背景只需扩展 `ReadingBackgroundVariant` 和对应渲染器，不需要把背景重新塞回全局布局。非 Reading 页面仍保留 `BaseLayout` 原有的 `highlightColor` 回退行为。

`ReadingStats` 负责静态阅读指标（发布日期、更新时间、阅读时长、语言），`ReadingTags` 继续独立负责类型作用域标签；`ReadingEngagement` 只作为 Waline 页面浏览/评论计数的轻量适配器，和页脚评论表单分离。所有指标都遵守“无数据则隐藏”的规则，当前不引入字数、阅读进度、真实停留时长或虚构统计。

页面配置集中在 `src/lib/content-layer/reading-policy.ts` 的 `readingPageConfig`。解析优先级为：显式页面 override → `readingPageConfig` 中的页面 override → 旧 `contentPolicy` 的全局/类型默认 → 当前视觉基线。示例：

```ts
export const readingPageConfig = {
  overrides: {
    'trace-detail': {
      header: {
        openingMedia: {
          mode: 'on',
          variant: 'standard',
          backdrop: { mode: 'on', variant: 'blur' }
        },
        readingTime: 'on'
      },
      background: { mode: 'on', variant: 'gradient' },
      footer: { copyright: 'on' }
    }
  }
}
```

三类兼容路由布局还会把可选的 `readingOverride`/`readingConfig` 透传到公共组合根，适合只影响某一个特殊路由的临时或局部决策；没有传入时始终使用上述集中配置和当前基线。

`auto` 只在数据存在时输出，`on` 表达页面明确需要该能力但仍不伪造缺失数据，`off` 完全关闭。标签始终在适配器中生成当前类型自己的 href；统一的是标签组件和展示能力，不是把三个 taxonomy 合并。Blog/Trace/Saying 当前基线分别保留媒体优先文章头、普通文章头和引文头；Footer 继续保留 Blog 版权/推荐、Trace/Saying 相邻导航的差异。Blog 底部成熟的 `ArticleBottom` 输出通过 `relatedVariant: 'article-bottom'` 显式选择，其他页面默认使用不依赖 collection 的 `cards` 变体；这是一项视觉兼容选择，不是公共组件根据类型做隐式判断。

新增文章类型时，只需增加 schema/adapter/registry，选择 `article`、`media-first-article` 或 `quote` 配方，并在页面配置中打开所需能力；只有出现新的内容语义顺序时才新增一个小型 layout，不复制整套页头或页脚。

### 8.2 当前路由和策略开关

三个标签域的路由固定如下：

```text
/blog/tags              Blog 标签索引
/blog/tags/:tag         Blog 标签结果
/traces/tags            Trace 标签索引
/traces/tags/:tag       Trace 标签结果
/sayings/tags           Saying 标签索引
/sayings/tags/:tag      Saying 标签结果
```

旧 `/tags` 与 `/tags/:tag` 已直接删除，不保留重定向。它们对应的文章和标签是开发期测试数据，不需要 URL 兼容迁移。

策略配置位于 `src/lib/content-layer/policy.ts`，目前支持：

```text
baseline  保持 Blog/Trace/Saying 当前成熟视觉和底部差异
uniform   三种类型使用同一组卡片、阅读头部和相关内容策略
custom    在统一默认值上按 kind 覆盖单项策略
```

三种模式都不会把标签跨类型聚合，也不会为缺失日期、图片或出处制造虚假值。页面级 `placement` 可以在不修改组件的情况下改变同一内容在不同页面的卡片视觉和密度。

### 8.3 归档页的标签可发现性

标签路由存在并不等于访客能够发现它。当前已确定并落地的入口规则如下：

- `/traces` 和 `/sayings` 的标题下方统一渲染 `ContentArchiveTaxonomy.astro`；页面只从 `loadContentCatalog()` 得到 `getContentTagCounts()` 的结果，不直接读取 collection 或手写标签 URL。
- 归档页最多预览 6 个标签，按使用次数倒序、名称正序排列；`View all tags` 始终保留，指向当前内容类型自己的标签索引。即使该类型暂时没有标签，也显示明确的空状态和索引入口，不伪造标签数据。
- 每个预览标签都指向对应的作用域路由（例如 `/traces/tags/:tag`），不创建跨类型聚合入口；详情页的 `ReadingTags` 能力组件负责当前条目的逐标签链接，旧 `ReadingTagList` 仅保留兼容门面。
- Trace/Saying 的 `MediaCard` 保持单一主链接。标签不嵌套进整卡链接，而放在归档边界，避免无效的嵌套交互元素，也不改变已冻结的卡片 DOM、CSS 和 hover/移动端行为。
- 新增内容类型时，只需在 registry/policy 中声明标签能力，在归档页传入同一个组件和类型化计数；不复制标签视图、不在页面重新实现查询。

### 8.4 搜索页的类型级标签入口

`/search` 是三类内容的统一全文搜索入口，同时提供一个与 Pagefind 联动的筛选面板。搜索页调用 `getContentTagBrowserEntries(loadContentCatalog())`，由 registry 顺序生成 `All / Blog / Trace / Saying` 类型切换和每个类型的标签计数；选择类型后只展开该类型的标签复选框。类型和标签通过 Pagefind 的真实 filters 联合筛选，不把同名标签跨内容类型混在一起。标签归档仍分别位于 `/blog/tags`、`/traces/tags` 和 `/sayings/tags`，搜索页不再额外渲染一套重复的标签导航。新增内容类型只要注册标签能力并提供内容数据，就会自动进入筛选面板。

文章详情底部的版权/分享/二维码卡片属于独立的 `copyright` surface，不属于文章正文数据，也不由各详情路由单独决定。当前基线为 Blog 开启、Trace 和 Saying 关闭；关闭时同时移除卡片下方的 `Support the author` 行。若未来新增内容类型，只需在策略中选择该 surface 是否启用，公共 `ReadingFooter` 无需复制或分叉。全站公共 `Footer` 和 Projects 中的赞助页面不受此开关影响。

## 9. 验收标准

每次修改内容层或卡片契约都必须通过：

```text
bun run astro check --noSync
bun run test:phase2
bun run test:content-layer
bun run verify:phase1
bun run verify:phase2
bun run verify:phase3
bun run test:phase4
bun run verify:phase4
bun run test:phase5
bun run verify:phase5
bun run verify:phase6
bun run check:assets
```

生产构建必须成功，并重点检查：

- 三类列表和详情路由数量、draft 过滤、排序结果不变。
- Home 的六张 Hero 图、随机 Saying 候选、最近 Blog/Trace 数量和 Timeline 年份不变。
- Blog、Trace、Saying 卡片的 DOM 标记、图片来源、响应式布局和交互不变。
- Blog 详情的正文、目录、版权、图片缩放和 compact music 行为不变。
- Blog 详情显示完整版权卡片；Trace/Saying 详情不生成版权/分享/二维码卡片及其 `Support the author` 行，同时保留相关导航、评论和全站公共页脚。
- 只有统一 catalog 直接读取 collection；页面和普通组件无 direct collection read。
- `PageData` 不包含 raw Astro entry，静态路径不会因重复嵌套正文对象而膨胀。

## 10. 后续禁止事项

- 不在页面中重新调用 `getCollection()` 或按 collection 自己实现一套排序/草稿过滤。
- 不为同一视觉卡片复制 `BlogCard`、`TraceCard`、`SayingCard` 三份仅字段名不同的实现。
- 不把 `ContentRecord` 改成所有类型字段都可选的无判别大对象；类型专属字段必须留在 discriminated union 分支。
- 不在 `PageData` 中保存 `CollectionEntry`、`Content` 组件或不可序列化的正文渲染对象。
- 不以统一数据层为理由改动冻结的卡片/详情 DOM、CSS 和交互；若确需视觉变化，必须作为独立视觉变更评审。

这套边界的实际收益是：内容 schema 可以继续独立演进，页面组合可以表达不同含义，而同一视觉组件只实现一次；同时通过 source adapter、PageData 和 render boundary 把“内容是什么”“页面怎么组织”“视觉怎么显示”三个变化轴真正解耦。
