# 分支、检查点与工作树对账报告

> **报告状态（2026-09-02，Asia/Shanghai）**：技术历史审计已经完成，内容和个人公开资料的最终确认尚未完成。本报告是发布准备的事实底稿，不是上线授权，也不等同于“所有历史文件都应恢复”。在站长完成本文第 7.4 节的确认前，不得把待确认内容重新公开、推送或部署。

## 1. 先给结论

用户关于“以前某个分支可能有领先实现”的担心是合理的，但对本仓库目前证据的准确表述应是：

1. **没有发现一个仍可见、包含独有已提交实现的隐藏主题分支。** 当前 `develop` 与 `codex/release-prep` 指向同一个提交；29 个旧 topic 分支在冻结快照时全部指向 `8b05952`，没有独有 commit。`reflog` 和不可达 commit 也只显示整合提交的 amend 版本，没有额外的主题实现提交。
2. **确实发现了“比当前树更丰富”的历史检查点。** 这些是 Codex 工作流在未提交状态保存的 tree/checkpoint，不是普通分支 commit。最新的丰富检查点有 86 篇 Blog、25 篇 Trace、39 篇 Saying；当前发布树只保留 5 篇 Saying，并将 Blog/Trace 作为正式空集合处理。
3. **About 的长版个人简介确实曾存在。** blob `c6082808…` 在连续三个检查点中出现，比当前 `src/data/profile.ts` 多一段说明文字。这证明当前简介在“文案内容”上可能落后于一个历史候选，但不能证明长版就是最终应公开的版本；它没有独立 commit，也没有站长在本报告中的公开确认。
4. **技术架构并非简单落后。** 当前 About 和 Home 通过同一份 `profileIntro` 数据渲染，旧组件、旧路由和旧资源已被新架构替代。不能用整棵旧 tree 覆盖当前树，否则会重新引入旧身份、旧链接、废弃路由和临时预览文件。
5. **处理原则是“逐路径、逐事实决策”，不是机械合并。** 临时物、生成预览和已被替代的运行时代码可以排除；真实内容、个人事实、外部媒体和授权事项必须进入 `USER_CONFIRM` 清单；未分类项数量必须为零后才能形成发布提交。

因此，当前最稳妥的结论是：**技术基线可以继续以 `codex/release-prep`（与 `develop` 同树）为基础；About 长版及历史内容进入待确认队列，不直接 cherry-pick 或整树恢复。**

## 2. 审计范围、基准和证据

### 2.1 当前基准

| 项目 | 值 |
| --- | --- |
| 仓库 | `E:\code\blog_susurrium` |
| 最终比较 HEAD | 以最终审计 `run.json` 的 `head.commitSha` 为准（见外部交付记录） |
| 最终 tree | 以最终审计 `run.json` 的 `head.treeSha` 为准（见外部交付记录） |
| 最终提交父项 | 以最终 bundle 和外部交付记录中的 `git log -1` 为准 |
| 当前工作分支 | `develop` |
| 对等发布分支 | `codex/release-prep` |
| Git 版本 | `git version 2.54.0.windows.1` |
| 审计工具 | `scripts/branch-state-audit.mjs`（只读扫描；不 checkout、reset、clean 或写入索引） |
| 审计输出目录（分类器版本 1，最终 HEAD 校验） | `E:\code\branch-state-audit-final-20260902-1115` |
| 比较范围 | 所有可见 refs、reflog、提供的 bundles、两个外部快照；仓库全路径 |

最终外部审计运行的 `run.json` 是 refs、source、state、tree、path、fsck、快照证据、分类、错误和警告计数的唯一权威；外部交付记录逐项保存该文件及每个 CSV 的 SHA-256。`path-diffs.csv` 只省略未变化行；未变化行按每个 state 计数，因此“行数”不能直接当作“独立文件数”。

### 2.2 发现的来源

审计同时读取了三类来源：

- **Git refs / reflog**：3 个本地分支、3 个 `origin` refs、1 个 tag、150 条 reflog 记录，以及工作流检查点 refs。
- **冻结快照**：
  - `E:\code\release-prep-snapshot-20260902-021211`：冻结时 HEAD 为 `8b05952`；记录 staged 9 项、unstaged 199 项、untracked 2959 项。快照中的 `untracked.txt` 共 175,485 bytes，SHA-256 为 `84046F7BCAD6E22B29FB94F917A994039AF08ACC1F1C65466B65CD293F4EDBF5`；`snapshot.json` SHA-256 为 `2FCF7C423C35C7AA31E6CBBA17F302A96CD7F1151F09E7D8D17E687FA14A7BA3`。
  - `E:\code\develop-sync-snapshot-20260902-083331`：记录 `develop` 从 `86ef868` 本地快进到 `5fabdb5`，没有 push、merge 到 `main`、部署或历史改写；`RESULT.md` SHA-256 为 `A0612672663FCB9E6247B686E7EA21C5BD08DEC30663A2089F7C96299B58497F`。
- **完整 bundle**：均已 `git bundle verify` 通过，保留在仓库外，不应删除或覆盖（哈希见第 10 节）。

`fsck --full --no-reflogs --unreachable` 的最终运行发现 4,316 个对象，其中 15 个不可达 commit、881 个 tree、3,420 个 blob。默认审计只把不可达 commit 纳入 state；内部 subtree tree 作为对象清单保留，不把 881 个目录节点误当成 881 个独立版本。若要逐个检视 subtree，应先由路径所属的可达 commit/tree 定位，不能把孤立 tree 当作产品意图。

### 2.3 上游边界

`origin` 是 `https://github.com/Susurrium/susurrium.github.io.git`，本地已存在 `origin/main` 与 `origin/develop`。`upstream` 指向 Arthals-Ink，但本地没有 `refs/remotes/upstream/*`；只读 `git ls-remote` 当时只返回 `main`（`d4f1fa02d6f4e0ea247635a7a1be0f51d02d50f1`）。因此本报告不能声称已审计上游所有历史；若未来要纳入上游，须另立任务、先 fetch 并保存新快照/bundle。

## 3. 分支关系和历史提交结论

### 3.1 当前 refs

| ref | commit | tree | 与当前 `HEAD` 的关系 |
| --- | --- | --- | --- |
| `develop` | 见最终审计 `run.json` 的 `head.commitSha` | 见最终审计 `run.json` 的 `head.treeSha` | 当前工作分支 |
| `codex/release-prep` | 见最终审计 `run.json` 的 `head.commitSha` | 见最终审计 `run.json` 的 `head.treeSha` | 与 `develop` 完全同 commit/tree |
| `origin/develop` | `86ef868d5a5a6e7082e5fe4b937c59dbec5297e3` | `9d62e0b93857aad3c6b880869b6a9b4e0f27ffb0` | 本地 `develop` 领先 21 个提交；尚未 push |
| `main` / `origin/main` | `15f5ad110af8ed8f38a1e506dd890d2d921f118f` | `1a5575efca76231469c9f3b50b773226d5fc7caa` | 旧线上基线；没有被本轮修改 |

`git log --left-right --cherry-pick develop...codex/release-prep` 为空，说明两者没有互相独有的 commit；最终 commit/tree 和相对 `origin/develop` 的 ahead 数以最终交付记录为准。两分支之间的提交是本地整合、审计和验证工具链，不代表同数量的额外 topic 分支独立贡献。

### 3.2 旧 topic 分支、reflog 与不可达 commit

初始快照中的 29 个本地 topic 分支全部指向 `8b05952`。逐分支检查没有发现只存在于某个 topic 分支的提交；它们是旧指针别名，不应被误判为“29 份待合并功能”。

reflog 中可见的整合链为：

```text
c02c1ac → fa11c29 → 6fec4f8 → 23c6742 → 4ccd418 → 7b6c1ae
→ 4f35a38 → 84e023b → 53fb7bf → c1c1874 → bb494e6 → b5a584b
→ e6cce21 → 8b05952 → 5fabdb5 → a879563 → be416c8 → d48d8ff
→ beaf2b3 → c829426 → 本次最终交付提交（完整 reflog 见审计 `refs.csv`）
```

不可达的 15 个 commit 都是 `5fabdb5` 整合提交的 amend 版本，父项为 `8b05952`；没有发现隐藏的独立主题 commit。amend 历史仍可由 reflog/bundle 复核，但不应把早期 SHA 当作最终发布对象。

## 4. 检查点时间线：哪里确实比当前树“更丰富”

Codex 检查点是保存了某一时刻完整 tree 的工作流对象；它们可能包含未提交的工作树内容。以下是去重后的代表性 tree（41 个 checkpoint refs 对应 36 个唯一 checkpoint trees）：

| checkpoint tree | 总路径 | `src` 路径 | `src/content` | 内容构成 | 测试文件 | 解释 |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| `3757501e49bd3c3ab544e0e5db0c80eb66faf7cf` | 409 | 222 | 94 | Blog 86 / Trace 5 / Saying 3 | 3 | 早期整合候选 |
| `c736368c641c4cdc08b73de5537da7d201663d01` | 560 | 268 | 95 | Blog 86 / Trace 5 / Saying 4 | 4 | 内容仍完整 |
| `b3f67fd349129aa7fd18b186fd222f3386ea8e88` | 713 | 272 | 95 | Blog 86 / Trace 5 / Saying 4 | 5 | 运行时代码增加 |
| `54ebb1f69515a793f21530dcc0c53bdff9037f30` | 819 | 296 | 95 | Blog 86 / Trace 5 / Saying 4 | 7 | 个人资料长版首次可核对 |
| `46b579b64f2374886012f1998afbb3888c3ef35b` | 826 | 296 | 95 | Blog 86 / Trace 5 / Saying 4 | 8 | 长版仍在 |
| `76300e78e6245b10b8de372e04cd3a5fa819c30d` | 984 | 354 | 150 | Blog 86 / Trace 25 / Saying 39 | 9 | 最丰富的已发现工作树 |
| 整合前基线 `2667580fa7c719ae2de8d98f3d701eaca99cbf6d` | 445 | 184 | 7 | Blog `.gitkeep` / Trace `.gitkeep` / Saying 5 | 11 | 审计工具提交前的整合树 |
| 最终 HEAD（tree 见最终审计 `run.json`） | 447 | 184 | 7 | Blog `.gitkeep` / Trace `.gitkeep` / Saying 5 | 11 | 最终发布准备树；增加审计/验证工具和文档 |

时间戳由 checkpoint ref 名称中的 Unix 毫秒值给出；上述关键点约对应北京时间 2026-08-29 至 2026-09-02。`76300e78…` 与整合前基线 tree `2667580f…` 的差异为：历史独有 568 条 state-path 行、当前独有 29 条、同路径内容变化 98 条；按独立路径归并后，历史独有候选为 150 个 content、404 个临时/产物、3 个 README 遗留截图、58 个运行时/运维项。

这条时间线支持“有历史候选被裁掉”的担心，但不支持“某个分支有一个未合并的完整新功能”这一更强断言。必须继续按路径和功能边界审阅。

## 5. 全路径差异矩阵和分类规则

### 5.1 机器矩阵的读法

最终审计归并出 935 个独立变化路径决定：

| 独立路径状态 | 数量 | 含义 |
| --- | ---: | --- |
| `CHANGED` | 173 | 当前和历史都存在，但 blob/mode 不同；通常是架构演进，需检查是否有语义回退 |
| `CURRENT_MISSING` | 272 | 当前树新增、历史树没有；通常是当前架构、测试或文档的新增 |
| `HISTORICAL_MISSING` | 615 | 历史树有、当前树没有；只是候选，不是自动恢复或自动删除结论 |

124 个路径在不同 state 中同时出现多个状态（例如先存在、后被重命名或再次新增），所以三类数字不能简单相加当作互斥文件数。完整 blob/mode/state 证据在 `path-diffs.csv`，来源别名在 `refs.csv`，state 去重在 `states.csv`。

### 5.2 历史独有 615 路径的决定分区

| 类别 | 数量 | 决定 | 典型范围 |
| --- | ---: | --- | --- |
| `QUARANTINE_TEMP` | 404 | 移出仓库并外部保留；窄规则忽略，不进入提交 | `.tmp-favicon-c-preview/*` 305、`.tmp-favicon-preview/*` 23、`.tmp-tnxg/*`/`.tmp-tnxg.html` 28、根目录截图/日志/HTML/头像预览等 48 |
| `REJECT_ORPHAN_DOC_ASSET` | 3 | 不纳入站点资源；外部保留来源 | `.github/assets/body.webp`、`header.webp`、`lighthouse-score.png` |
| `USER_CONFIRM_CONTENT` | 93 | 逐篇由站长确认公开、脱敏、版权和 URL 后再决定 | 86 篇真实 Blog、4 篇非预览 Trace、3 篇非预览 Saying |
| `REJECT_GENERATED_CONTENT` | 55 | 生成的卡片预览，不恢复为正式文章 | 20 个 `card-preview-trace-*`、35 个 `card-preview-saying-*` |
| `REJECT_DRAFT_CONTENT` | 2 | 草稿只进入外部归档/隔离区，不进入发布树 | 1 个 `draft-*` Trace、1 个 `draft-*` Saying |
| `REJECT_SUPERSEDED_RUNTIME` | 24 | 当前有明确替代实现；除非发现行为回归，不恢复旧文件 | 20 个旧组件、4 个旧页面 |
| `REJECT_UNUSED_ASSET` / `REJECT_SIDE_EFFECT_WORKFLOW` / `REJECT_GENERATED_STATE` | 34 | 无当前引用、旧媒体或有副作用的自动写回；外部保留 | 21 个旧工具 SVG、4 个旧项目 JPG、7 个旧 public/media 资源、1 个 link workflow、1 个 `scripts/link-health.json`（合计按文件归并为 34） |

上表合计 615。审计工具已输出 `path-decisions.csv`，把每个独立路径映射到上述类别；最终 HEAD 校验的 `UNCLASSIFIED=0`。由于最终审计文档本身也属于当前树，路径决定数会随提交树变化；交付时以本文指定的最终输出目录中的 `run.json`、CSV 和哈希为唯一权威。若后续出现无法归类的路径，发布门禁应停止，而不是把它默认为删除。

### 5.3 当前独有和同路径变化

- 272 个 `CURRENT_MISSING` 主要是当前的新布局、动态路由、数据模型、测试、文档和生产资源；它们按当前 import/测试引用确认后保留。
- 173 个 `CHANGED` 主要是同一路径在重构中的内容或配置变化；应以当前实现为候选，并对个人事实、外部链接和授权单独审阅。
- 当前代码没有引用被列为旧 runtime 的路径；运行 `rg`/构建检查应继续作为门槛，防止误删后出现隐式 glob 或动态 import 依赖。

## 6. 旧运行时与资源的逐项替代关系

以下映射是“当前实现已替代历史实现”的技术证据，不是对历史内容的价值判断。

### 6.1 组件

| 历史路径 | 当前替代/处理 | 决定 |
| --- | --- | --- |
| `src/components/arthals/ArticleImageZoom.astro` | `src/components/reading/ArticleImageZoom.astro` | 当前实现保留 |
| `src/components/arthals/Copyright.astro` | `src/components/reading/ContentCopyright.astro` | 当前实现保留 |
| `src/components/arthals/Footer.astro` | `src/components/layout/SiteFooter.astro` | 当前实现保留 |
| `src/components/arthals/ReadingNavigation.astro` | `src/components/reading/ReadingNavigation.astro` | 当前实现保留 |
| `src/components/arthals/Signature.astro` | `src/components/shared/Signature.astro` | 当前实现保留 |
| `src/components/arthals/StaticGithubCard.astro` | `src/components/shared/StaticGitHubCard.astro` | 当前实现保留 |
| `src/components/cards/ArthalsBlogCard.astro` | `ContentCard`、`TextCard`、`MediaCard` 及 adapter | 当前卡片体系保留 |
| `src/components/cards/ArthalsTextCard.astro` | `TextCard`/compat adapter | 当前卡片体系保留 |
| `src/components/cards/LargeSkullCard.astro` | `MediaCard`/当前 Hero 卡片 | 当前卡片体系保留 |
| `src/components/content/ContentTypeTagLinks.astro` | `ContentArchiveTaxonomy` 与作用域标签页 | 当前 taxonomy 保留 |
| `src/components/home/LargeSkullHero.astro` | `HeroGallery.astro` | 当前首页 Hero 保留 |
| `src/components/home/LegacyHome.astro` | `HeroGallery`、`BlogTimeline`、`ProjectSection` | 旧组合不恢复 |
| `src/components/home/ProjectCard.astro` | 当前 `ProjectSection`/卡片适配层 | 旧组件不恢复 |
| `src/components/home/Section.astro` | 当前共享 section/layout | 旧组件不恢复 |
| `src/components/home/SkillLayout.astro` | 当前共享 layout | 旧组件不恢复 |
| `src/components/reading/ArticleReadingHeader.astro` | 通用 `ReadingHeader` | 当前通用头部保留 |
| `src/components/reading/BlogReadingHeader.astro` | 通用 `BlogHeader`/capability 组件 | 当前通用头部保留 |
| `src/components/reading/SayingReadingHeader.astro` | 通用阅读头部 | 当前通用头部保留 |
| `src/components/reading/TraceReadingHeader.astro` | 通用阅读头部 | 当前通用头部保留 |

### 6.2 页面、路由、媒体和运维文件

| 历史路径 | 当前处理 | 原因 |
| --- | --- | --- |
| `src/pages/sayings/index.astro` | 动态 Saying collection/index | 作用域分页和空状态已覆盖 |
| `src/pages/traces/index.astro` | 动态 Trace collection/index | 作用域分页和空状态已覆盖 |
| `src/pages/tags/index.astro`、`src/pages/tags/[tag]/[...page].astro` | 当前 collection-scoped tag routes | 避免旧聚合路由和标签串域 |
| `public/media/entrance-loop*.mp4/.webm`、`entrance-poster.webp` | 当前 waterfall 入口媒体变体 | 旧文件无活动引用 |
| `public/images/social-card.png` | 当前 `social-card.webp` | 格式和引用已迁移 |
| `public/images/RDFZ.svg` | 无活动 import；外部保留 | 旧教育/首页组件遗留 |
| `src/assets/projects/*.jpg`（4 个旧项目图） | 当前项目资源体系 | 旧 `ProjectCard` 不再引用 |
| 21 个旧工具 SVG（如 `arc.svg`、`warp.svg`、`figma.svg` 等） | 当前工具清单实际引用的资源 | 未引用的旧图不恢复 |
| `.github/workflows/check-links.yml` | 不纳入候选 | 含 schedule、`contents: write` 和自动 commit/push 副作用 |
| `scripts/link-health.json` | 不纳入候选 | 运行生成状态，不是源代码；人工检查使用 dry-run |

若后续发现某个当前页面通过动态 glob 依赖旧资产，应先补充 import/测试并重新跑矩阵；不能只凭文件名推断。

## 7. About、个人简介和其他个人事实证据

### 7.1 当前 About 的技术状态

当前 `src/data/profile.ts` 的 blob 为 `100a5a9a431cc2c6113fba4100c22b6a05ac12e2`（494 bytes），内容为：

```text
role: Developer / Designer / Blogger
你好，我是 Susurrium，目前在北京大学医学部学习。
我平时喜欢写代码、做设计，也常常因为好奇去折腾一些新工具和新想法。
```

`src/pages/about/index.astro` 和 `src/components/home/ProfileIntro.astro` 都从该数据导入；因此当前不会出现 Home/About 两份简介漂移。`scripts/verify-phase2.mjs` 对当前文案和旧身份残留有断言，构建与测试可验证技术一致性。

### 7.2 历史长版候选

blob `c608280867e605c138b3370cf1bf882f526d254e`（SHA-256：`18acdde27e25b4b47b3ab3337c933094ce78b07dc2b55163a748f47ee31f4875`，695 bytes）在以下连续检查点存在：

- `54ebb1f69515a793f21530dcc0c53bdff9037f30`
- `46b579b64f2374886012f1998afbb3888c3ef35b`
- `76300e78e6245b10b8de372e04cd3a5fa819c30d`

它保留当前两句，并在第二句后追加“做过的项目、遇到的问题，以及一些零散的思考……如果刚好能对别人有用，那就更好了”的长版说明。连续三个检查点说明这不是一次随机编辑，但仍然只是工作流候选：没有独立 commit、没有 merge 记录，也没有站长确认其公开意图。该 blob 的来源还可由 Codex session JSONL 复核；session provenance 不是授权。

较早的 blob `ae1393114d9569d8eb0e2959bf1a66dccb102f22`（425 bytes）是“你好，我叫 Susurrium……记录正在学习、思考和制作的东西”的旧短版，视为被当前文案 supersede，不自动恢复。更早的 inline About 版本（例如 `c7a391c91f2c05107234a98f5ce2d74e6491e391`）包含 Arthals、旧学校阶段、博士计划、LLM/Embodied AI、Minecraft 及旧社交账号等事实；这些必须视为过期/高风险身份资料，除非站长逐项重新确认，不能复制到新页面。

### 7.3 Education / Experience

| 项目 | 当前 blob/状态 | 历史候选 | 决定 |
| --- | --- | --- | --- |
| Education | `src/data/education.ts` = `c59244fb2da8779c85a599bfb7d2fc9c991ec99c`；北京大学、医学部、`2025-09`、current | blob `1199f10fcc3c4d5d00ebdbf0419a9f9c18610e25` 写有“医学部 · 计算机科学技术双学位” | 架构保留；双学位、日期和公开链接须 `USER_CONFIRM` |
| Experience | `src/data/experience.ts` = `90a54e790f6c2f2c0908ff5c632d03a158334b7b`；当前为空并注明“无确认条目” | 旧 About inline 有 2024-09-11 北京大学《计算机系统导论》课程助教及 `https://slide.huh.moe/` | 不自动恢复；日期、身份、链接和公开许可须确认 |

### 7.4 发布前必须由站长回答的清单

以下不是让 Git 或模型代答的事实问题；在收到明确答复前保持 `USER_CONFIRM`：

1. About 使用当前短版，还是恢复长版？是否需要改写措辞、语气或“对别人有用”的表述？
2. 是否公开“北京大学医学部”以及“目前在读/current”状态？公开到学校、院系还是更粗粒度？
3. 是否公开“计算机科学技术双学位”？起始月份 `2025-09` 是否准确？
4. 是否恢复旧的北京大学 2021、人大附中 2014 教育记录？这些日期是否应公开？
5. 是否公开课程助教经历、`2024-09-11` 日期及 `slide.huh.moe` 链接？
6. 所有社交链接、项目链接、头像、二维码、视频和文字是否有权公开再分发？Paralines 字体是否有可留档授权？

确认方式建议采用一条可追溯的 commit message、签字文档或 issue，逐项标记 `KEEP` / `EDIT` / `REJECT`；只说“看起来可以”不足以覆盖个人事实和第三方权利。

## 8. 内容、隐私、授权和临时物的处理

### 8.1 真实内容不能统称为“已确认删除”

历史中 86 篇 Blog、4 篇非预览 Trace、3 篇非预览 Saying 是真实内容候选，不是临时卡片。旧发布文档把“Blog 85、Trace 5、Saying 3”统称为已确认删除是不准确的：它们可以暂不进入当前候选，但应记录为 `USER_CONFIRM` 或 `ARCHIVE_PENDING_OWNER`，并在隔离区/bundle 中保留。逐篇审阅至少检查：个人邮箱、本地路径、基础设施信息、外部链接、版权和是否仍符合当前站点定位。

### 8.2 可以确定排除的内容

- `card-preview-*` 是裁剪工作台生成的预览，不是正式内容；排除不会等同于删除真实文章。
- `draft-*` 是草稿，除非站长明确发布，不进入发布树。
- 截图、浏览器 profile、临时 HTML/日志、头像缓存、`dist-*`、`dist/`、`.astro/` 和浏览器 CDP profile 只移出仓库或用根限定规则忽略。profile 可能包含 cookies/localStorage，不能当普通图片直接公开。
- `.github/assets/*` 的 README 历史截图不属于生产资源；外部保留来源即可。

初始 untracked 清单 2,959 项中，2,786 项为临时、浏览器 profile 或生成物，约 175 项是 source-like 路径。与当前 tracked tree 交叉检查后，未发现漏掉的当前源代码/内容/测试/文档/生产 public 资源；当前树之外仍需特别复核的 source-like 项主要是 `.github/workflows/check-links.yml` 与 `scripts/link-health.json`。这不是删除许可，而是说明快照中的未跟踪源文件已进入当前树或被明确隔离。

`.gitignore` 只能防止再次误加入，不能替代移出和审阅。规则必须窄化到 `/\.chrome-profile-temp/`、`/\.edge-profile-temp/`、`/\.tmp-*/`、`/shot*.png` 等，不得使用全局 `*.png`/`*.jpg`/`*.webp`，因为这些扩展名也包含真实生产资源。每一条规则用 `git check-ignore -v` 验证。

## 9. 恢复、复核和后续提交方案

### 9.1 不要整树合并

检查点没有语义 commit，整树 cherry-pick 也无法表达“哪些是代码、哪些是个人内容、哪些是生成物”。正确流程是：

1. 在 `codex/release-prep` 上建立一个临时审计分支或从其工作树复制，不改变 `main`/远端。
2. 先在 `path-decisions.csv` 或等价 decision ledger 中为目标路径写明来源 tree、blob、理由和决定。
3. 对已确认恢复的单个文本路径，从 tree 读取后人工 review；二进制用 `git cat-file`/`git archive` 校验哈希和授权。不要直接覆盖当前目录。
4. 将恢复内容与当前 schema、路由、RSS、Pagefind 和浏览器测试接通，再单独提交；About 文案应只改 `src/data/profile.ts`，不要复制旧 `about/index.astro`。
5. 每批内容恢复后重新运行全矩阵和完整验证，确保没有新的 `UNCLASSIFIED`、临时物或旧身份残留。

示例（仅说明恢复边界，执行前先确认路径和工作树）：

```text
git cat-file -p c608280867e605c138b3370cf1bf882f526d254e > <review-copy>/profile.ts
git ls-tree -r 76300e78e6245b10b8de372e04cd3a5fa819c30d -- src/content/blog
git show 76300e78e6245b10b8de372e04cd3a5fa819c30d:src/content/blog/<slug>.md
```

恢复操作必须在审计分支/副本进行，先比较、再 `git add -- <明确路径>`；不使用 `git add .`、`git clean -fdx`、`git reset --hard` 或 `git branch -D`。

### 9.2 最终发布提交门槛

发布准备提交可以是一个整合提交，也可以按代码、内容/媒体、测试/文档拆分；关键是最终 tree 唯一且可复现。提交正文应包含：基线 SHA、纳入范围、明确移除项、隔离项、验证命令、无 push/deploy 声明，以及本报告和机器矩阵的路径。

在提交前必须同时满足：

- `path-decisions.csv` 覆盖最终审计发现的 935 个独立变化路径决定；`UNCLASSIFIED=0`。
- 真实内容、个人事实、外部资源和字体授权均有 owner 决定；未确认项不进入 index。
- `git diff --check`、`git diff --cached --check`、`git show --check HEAD` 全部无输出。
- 干净临时 worktree 重新安装依赖并运行 build、Astro check、全部测试、dry-run link check、严格发布门禁和浏览器生命周期脚本。
- `git status --porcelain=v2` 只显示允许的 ignored 构建缓存；没有截图、profile、preview、日志、bundle 或外部快照误入仓库。
- 最终 commit/tree SHA 和新的最终 bundle hash 已记录，且 `git bundle verify` 通过；不 push、不部署，除非另行授权。

## 10. 可恢复物和机器产物索引

### 10.1 Bundles

| 文件 | 大小（bytes） | SHA-256 | 作用 |
| --- | ---: | --- | --- |
| `E:\code\blog-susurrium-before-release-20260902-021211.bundle` | 149,138,991 | `37B45488B9B36B5F1AB4961C01CB6577A138D070D344CEEA35AF34DD58F1BEA6` | 发布整理前完整 refs（77 advertised heads） |
| `E:\code\blog-susurrium-before-develop-sync-20260902-083331.bundle` | 147,590,541 | `3A475F3416A88D3ED977A288A45D2991936E1581109FC72532F3F4061CE84359` | develop 同步前，保留旧 develop |
| `E:\code\blog-susurrium-history-audit-20260902-092106.bundle` | 147,590,797 | `06A0B0B3E3AF4B5AD9041D8B6BF60B41F5A10861B092454E62115F0F488D5BEA` | 历史审计期间 refs |
| `E:\code\blog-susurrium-release-final-20260902-043328.bundle` | 147,590,311 | `36A7C0C6CD695826C1AE6184175225813C315CBE30E7F38ABCA1416C82E599D4` | 当前整合基线的既有封存；最终文档/工具提交后需重新生成新的 final bundle |
| `E:\code\blog-susurrium-final-audit-20260902-1115.bundle` | 以外部交付记录为准 | 以外部交付记录为准 | 包含最终交付 commit/tree 的新增封存 |

旧 bundle 不会因新提交失效；它们保存的是对应时刻的对象和 refs。本次交付追加带最终 commit/tree 的 final bundle，而不是覆盖旧文件；其字节数、SHA-256 和 `git bundle verify` 输出见外部交付记录。

### 10.2 审计矩阵文件

最终 HEAD（含本报告最后一次修订）的机器矩阵输出目录固定为 `E:\code\branch-state-audit-final-20260902-1115`；运行命令、版本、计数、分类和警告写入其中的 `run.json`。文件职责如下：

| 文件 | 内容 |
| --- | --- |
| `report.md` | 人类可读 state/source/分类摘要 |
| `run.json` | 命令、版本、计数、分类、警告 |
| `refs.csv` | 每个 ref/source alias 的 commit/tree 解析 |
| `states.csv` | 去重后的 commit/tree state |
| `path-diffs.csv` | 每个变化路径的 blob/mode/status |
| `unreachable.csv` | fsck 对象清单 |
| `sources.csv` | bundle/快照来源和哈希 |
| `path-decisions.csv` | 每个独立变化路径的分类/决策/理由 |
| `snapshot-evidence.csv` | 快照中的 status/untracked/patch 路径记录 |

最终输出文件的 SHA-256 以交付记录中对该目录的逐项计算为准；此前 `branch-state-audit-20260902-100215-classified-v2` 等目录只作为过程证据保留，不得拿其旧计数代替最终 HEAD 结果。

## 11. 验证状态和当前阻塞

### 11.1 已有技术验证证据

`develop-sync-snapshot-20260902-083331/RESULT.md` 记录了整合树上的早期通过证据；随后在最终提交候选的干净 detached worktree 中又实际复核了完整链路：`bun install --frozen-lockfile` 成功；`bun run check` 为 0 diagnostics（182 files）；`bun run test:all` 为 75 tests / 317 expects / 0 failures；`bun run build` 通过（21 pages，Pagefind 5 pages / 126 words）；`bun run links:check:dry` 为 9 个 HTTP 200，`www.george-blog.top` 的 TLS 错误按既有规则登记为例外；`bun run release:gate --strict`、`bun run check:assets`（248 dist files、31.25 MiB、0 failures）和 `bun run ci` 均以退出码 0 完成。asset budget 的 12 条大图提示是 advisory，不是失败。

生产 preview 上的浏览器复核也已完成：`bun run verify:phase6:browser` 与 `bun run verify:browser:lifecycle` 均为 0 failures、0 runtime exceptions/console errors，覆盖空 Blog、Trace/Saying taxonomy、搜索过滤、暗色 Home、入口动画、音乐状态持久化、About/Links、Saying detail、search 和 reduced-motion。仓库没有 `agent-browser` 可执行文件，因此按浏览器验证 skill 的目标使用本机 Chrome DevTools Protocol 脚本完成；Chrome 152 不发出旧的 `Page.loadEventFired`，脚本已改为等待启用后的 lifecycle `load` 事件，这一兼容性修复已纳入审计提交。

### 11.2 尚未解除的阻塞

当前阻塞不是“找不到历史”，而是：

- About 长版或短版的公开选择未确认；
- Education 双学位/日期、旧教育经历和 TA 经历未确认；
- 93 个真实历史内容尚未逐篇确认是否恢复、脱敏或永久不公开；
- 图片、视频、二维码、外部链接和 Paralines 字体授权仍需证据；
- 若恢复任何候选内容，还必须重新执行相同的内容、隐私、授权和运行时门禁。

在这些问题解决前，状态应写成“技术候选可复核，公开发布待站长确认”，不能标记为最终发布完成。

## 12. 后续执行顺序

1. 保持 `develop` 与 `codex/release-prep` 同步，不在 `main` 或远端上操作。
2. （本次交付执行）在最终 HEAD、两快照和四个旧 bundle 上，按第 10.2 节路径生成最终审计目录；实际 commit/tree、计数、分类、警告和 SHA-256 以 `run.json`、CSV 与外部交付记录为准。
3. （已完成）文档已修正把旧 Blog/Trace/Saying 写成“已确认删除”的表述，并链接本报告。
4. 请站长按第 7.4 节逐项给出 `KEEP` / `EDIT` / `REJECT`，优先处理 About、Education、Experience，再处理 93 篇历史内容。
5. 仅恢复得到明确 `KEEP` 的路径，采用小批次提交和测试；不要整树 cherry-pick。
6. （技术验证已完成）干净验证 worktree 已通过完整构建、测试、严格门禁和浏览器检查；交付前执行 `git diff --check`、`git diff --cached --check`、`git show --check HEAD`、状态和 bundle 校验，并把结果留在外部交付记录。
7. 生成带最终 commit/tree 的新 bundle，记录最终 commit/tree、审计输出文件 SHA-256 与 `git bundle verify` 结果；保留旧 bundle，最后才考虑删除已核对且无独有内容的旧分支。

本报告的核心判定是：**历史完整性问题已经被证据化，About 的落后候选已经定位；剩下的是明确的内容所有者决策和最终可复现验证，而不是继续盲目寻找一个“神秘分支”。**
