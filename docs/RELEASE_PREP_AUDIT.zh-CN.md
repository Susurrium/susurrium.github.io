# Release-prep 候选树审计记录

> 本文件记录 `codex/release-prep` 的本地发布准备候选，不代表已经获得线上发布授权。候选树可以构建、测试和复核，但在个人资料、素材权利、公开位置粒度和内容取舍完成最终确认前，不得推送或部署。历史分支、checkpoint 与工作树的完整对账以 [BRANCH_STATE_RECONCILIATION.zh-CN.md](./BRANCH_STATE_RECONCILIATION.zh-CN.md) 为准；本文件中的旧数量或早期措辞不得解释为站长已确认删除内容。

## 1. 范围与不可变边界

| 项目 | 决定 |
| --- | --- |
| 项目目录 | `E:\\code\\blog_susurrium` |
| 候选分支 | `codex/release-prep` |
| 当前比较基线 | `5fabdb5fd5fbdddc97f2b631ee68f5432bde5791` (`chore: consolidate local project into release baseline`) |
| 历史整理起点 | `8b05952ca54ca32843cdbbcc2f815b6d61a5a9be` (`fix: load MapLibre public bundle as a script`) |
| 远端操作 | 本轮不 push、不 merge、不部署、不修改 Pages 设置 |
| 历史操作 | 未对 `main`、`develop` 或工作树基线做 reset/clean/历史改写；候选分支整理期间曾多次 amend，最终 SHA 以交付时记录为准；原始分支先核对再决定是否删除 |
| 可恢复快照 | `E:\\code\\release-prep-snapshot-20260902-021211` 与 `E:\\code\\blog-susurrium-before-release-20260902-021211.bundle` |
| 临时隔离区 | `E:\\code\\release-prep-quarantine-20260902-021422` |
| 既有候选封存 | `E:\\code\\blog-susurrium-release-final-20260902-043328.bundle`（历史候选证据；本次对账完成后须重新生成最终 bundle） |

快照包含工作树二进制补丁、索引补丁、未跟踪路径清单、分支/工作树记录和完整 bundle。隔离区中的文件没有被删除；需要复核时按快照中的相对路径恢复即可。历史快照中出现的 85 篇 Blog、5 篇 Trace、3 篇旧 Saying 以及后续 checkpoint 中出现的更多内容，均只表示“曾存在于候选状态”，不表示已经获得永久删除或不公开的确认；它们仍由外部快照/bundle 保留。

候选分支在整理过程中为修正文档与门禁实现曾多次 amend；早期候选提交仍可通过该分支 reflog 恢复；表中初始快照/bundle 用于恢复候选前的基线与原始工作树，最终候选由表中单独列出的最终 bundle 封存。本记录不把“候选分支提交对象未保持不变”表述为受保护历史未被改写；最终可审计对象以本次交付时的 commit/tree SHA 为准。未执行 `git gc` 或 Git 对象 prune；验证 worktree 移除后仅执行了 `git worktree prune` 清理失效登记信息。

## 2. 文件分类决定

### 纳入候选

- 当前页面实际 import 的 Astro 组件、布局、路由、数据、样式和运行时脚本。
- `src/content/blog/.gitkeep` 与 `src/content/traces/.gitkeep`：空集合是受测试覆盖的正式状态；Blog/Trace 页面保留空状态、导航和 RSS 边界。
- 5 篇当前 Saying 候选内容。出处不确定的短句在正文中保留明确说明，不把说明伪装成确定的作者事实；上线前仍需站长确认公开范围。
- 生产引用的入口视频/海报、54 张 Home WebP、`tracer-companion.webp`、`social-card.webp`、实际使用的工具 SVG 和当前 favicon/头像/二维码。它们的来源与公开再分发权仍由站长在发布前逐项确认。
- `AbrilFatface-Regular.ttf` 及随附的 SIL OFL 文本；`Paralines-Regular.otf` 也暂纳入以保持当前视觉可重建，但在 `THIRD_PARTY_NOTICES.md` 标为发布阻断的权利复核项。
- 全部 11 个 `test/*.test.ts`；`test:all` 已成为 `bun run ci` 的统一测试门槛。
- 卡片/ Hero 裁剪工作台源代码作为受支持的内部开发工具纳入（路由不在导航和 sitemap 中）。它不是安全边界；若不希望公开访问，部署前应从发布产物中移除或增加访问控制。生成的截图、预览和浏览器草稿不纳入。
- 工作台生成的 `src/content/sayings/card-preview-saying-*.md` 与 `src/content/traces/card-preview-trace-*.md` 仅用于临时填充真实卡片；已加入根限定 `.gitignore`，但忽略规则不是清理措施，审阅完成后仍须移出。它们与 `draft-*` 属于可明确拒绝进入发布树的生成/草稿文件；其余历史内容必须走下方的站长确认流程。

### 候选树中明确排除但保留在隔离区

- `.github/workflows/check-links.yml`：原文件包含每日 schedule、`contents: write`、自动 commit/push，与本轮“手动、可审计、无自动写回”边界冲突。
- `scripts/link-health.json`：运行生成的状态快照；保留 `scripts/check-links.mjs` 作为人工工具，验证时只用 `links:check:dry`。
- `public/images/social-card.png`、旧 `entrance-loop*`/`entrance-poster.webp` 和未被 About 引用的旧工具图标：当前代码没有引用；本候选暂不纳入，原文件按相对路径保存在隔离区 `unused-assets-before-remove/`，可从 bundle/快照恢复。是否重新使用仍需素材来源/权利复核。
- 上游遗留的 4 张项目测试图与 `public/images/RDFZ.svg`：只服务于已停用的旧首页组件/宽 glob，不属于当前 Projects/Education 页面；本候选暂不纳入，`scripts/asset-budget-legacy.json` 已清空旧的临时豁免条目。已被新首页替换且无活动引用的 `LegacyHome.astro` 及其 `ProjectCard`、`Section`、`SkillLayout` 配套死组件也从候选移除；原件已在隔离区留存并可由快照/bundle 恢复。
- `.github/assets/body.webp`、`header.webp`、`lighthouse-score.png`：来自上游 README 的历史截图（原始来源 commit `fd5a9cd`），当前 README 已不再引用，也不是站点构建资源；候选已移出并保存在隔离区 `historical-readme-assets-before-remove/`，可由快照/bundle 恢复。
- 根目录截图、浏览器 profile、临时 HTML/日志、`.tmp-*`、卡片/ Hero 预览、头像缓存和所有构建/视觉产物。已有 `artifacts/`、`dist-*`、`dist/` 与 `.astro/` 输出已整体移至隔离区的 `artifacts-before-remove/`、`dist-outputs-before-remove/` 和 `astro-cache-final-before-remove/`；构建输出仍可在本机生成，但不进入 Git。仅为依赖安装保留的 `node_modules/` 仍是根目录忽略缓存。

### 暂不纳入候选、等待逐项确认


- 历史状态中的 86 篇 Blog、25 篇 Trace、39 篇 Saying（其中一部分是 `card-preview-*` 或 `draft-*`）是内容候选，不是临时文件的同义词。当前工作树保留 5 篇当前 Saying 候选；其余真实正文标记为 `USER_CONFIRM_CONTENT`，在站长逐篇确认公开范围、隐私、许可和元数据前，不恢复到发布树。删除当前候选中的文件不等于从 Git 历史脱敏或永久删除。
- `card-preview-*` 与 `draft-*` 生成/草稿文件可直接拒绝进入发布树，但仍以外部快照/bundle 作为可追溯证据。
- 旧 `/tags` 聚合路由、旧 Saying/Trace index 路由：已由按 collection 作用域的分页和标签路由替代；这是运行时架构替代，不代表相关历史内容被判定为不公开。本候选不提供旧 URL redirect，除非另行批准兼容策略。
- 已被新首页完全替换、无活动 import 的旧首页组件：`src/components/home/LegacyHome.astro`、`ProjectCard.astro`、`Section.astro`、`SkillLayout.astro`。这是当前架构的 superseded runtime 决定；删除前的校验副本位于隔离区 `legacy-components-before-remove/`。
## 3. 安全、隐私与权利边界

- Residence 候选仅公开北京城市级坐标（39.9, 116.4），并在数据与测试中锁定 `publicPrecision: 'city'`；不会把约 10 米级坐标写入新的候选提交。更细粒度坐标、文案和头像必须由站长明确批准。
- 站点身份、学校、公开邮箱、社交链接、Waline、友链和收款二维码均属于站长资料；本提交不代表这些资料已获最终上线确认。
- Home 图库、favicon、头像、二维码、`tracer-companion.webp` 和 Paralines 的权利证据不由 Apache-2.0 项目许可证自动覆盖。见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)；部署前必须补齐许可/授权或替换素材。
- `scripts/check-links.mjs` 默认模式会写两个文件；候选流程只运行 `--dry-run`，部署 workflow 不再执行有副作用的检查。`public/links.json` 是人工快照，不由 CI 自动提交。

## 4. 验证记录

下表只记录在候选提交后、干净验证 worktree `E:\\code\\blog-susurrium-release-verify` 中重新执行的结果；执行前不要把历史开发期文档中的页面数量或“已通过”描述当成当前证据。验证针对最终候选树执行，提交 SHA 以交付时的 `git rev-parse HEAD` 为准。

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `git diff --check` / staged check | PASS | `git show --check HEAD`、`git diff --cached --check` 均无输出；`.gitattributes`/`.editorconfig` 统一 LF |
| `bun install --frozen-lockfile` | PASS | 干净验证 worktree；692 个包按锁文件安装 |
| `bun run ci` | PASS | 21 个静态页面；Pagefind 索引 5 页/126 words；Astro check 181 files、0 diagnostics；11 个测试文件 75 pass/0 fail；各 phase verifier 0 failure；asset budget 248 dist files、31.25 MiB、12 advisory warnings、0 failure |
| `bun run links:check:dry` | PASS（有已登记外部 TLS 例外） | 10 个监控链接：9 个 HTTP 200，`https://www.george-blog.top/` 为 `tls-error`；dry-run 未改写文件 |
| `bun run release:gate --strict` | PASS | 新构建后执行；0 failure、0 warning |
| `bun run verify:phase6:browser` | PASS | 生产 preview + Chrome CDP；空 Blog/Trace 状态、Saying 搜索过滤、类型作用域和移动端筛选均通过，0 failure；当前发布内容无标签时明确验证空状态，不依赖已移出的 card-preview fixture |
| `bun run verify:browser:lifecycle` | PASS | 生产 preview + Chrome CDP；10-route lifecycle、暗色、reduced-motion、入口重播、ClientRouter、音乐/地图/效果清理、异常收集均通过，0 failure/0 console.error |
| 人工/视觉页面复核 | 自动化复核 PASS；人工上线签字待站长 | CDP 脚本覆盖 `/`、`/home`、Blog/Trace/Saying 归档与可用详情、`/about`、`/links`、`/search`、移动端、暗色和 reduced-motion；未把自动化结果冒充最终人工视觉授权 |

本机未安装 `agent-browser` CLI；浏览器验收将使用仓库 CI 同等的生产 preview、Chrome CDP 和项目内浏览器脚本。脚本覆盖打开、等待、DOM 快照、交互、网络/生命周期断言和关闭服务，结果已写入本表。

构建日志中关于 `src/content/docs/` 基目录不存在以及 Blog/Trace collection 为空的提示是本候选“正式支持空集合”策略的预期非阻断信息；它们不属于 Astro check 诊断，也不会使 CI 或严格门禁失败。

本轮为适配“空 Blog/Trace 且无标签的正式候选”对两个浏览器验证脚本做了最小契约修正：标签数量断言现在要求声明数、实际控件数和空状态一致；搜索过滤使用已纳入候选的 Saying 文本 `Sisyphus`，Trace 结果允许合法空集合；不恢复、不生成会改变 RSS/Pagefind 的 `card-preview-*` 内容。

## 5. 分支核对与清理

验证通过后再次执行 `git branch --merged codex/release-prep`、`git branch --no-merged codex/release-prep` 和逐分支 `git log codex/release-prep..<branch>`。除受保护的 `main`、`develop`、`codex/release-prep` 外，以下 29 个本地 topic 分支均指向旧基线 `8b05952`，没有独有 commit，且全部出现在 merged 列表中：

`about`、`begin`、`card`、`clear`、`codex/content`、`compare`、`content`、`data`、`debug`、`door`、`feat/phase-1-information-architecture`、`final`、`link`、`music`、`name`、`picture`、`polish`、`project`、`reading`、`region`、`rename`、`saying`、`search`、`servers`、`signature`、`support`、`tag`、`tools`、`year`。

确认后仅使用安全的 `git branch -d` 删除了上述 29 个本地引用；未使用 `-D`，未修改远端分支，也未触碰 `main`/`develop`。独立 detached baseline worktree `C:\\Users\\susurrus\\AppData\\Local\\Temp\\codex-arthals-baseline-15f5ad1`、快照、bundle 和隔离区均保留。

## 6. 交付与后续

候选提交正文必须包含基线 SHA、纳入/排除类别、验证命令和“不 push/不部署”声明。只有在验证 worktree 完全重建成功、严格门禁和浏览器回归均通过后，才核对旧分支的独有提交；只能对确认无独有提交的分支使用安全的 `git branch -d`，保留 `main`、`develop` 和本候选分支。线上发布仍需站长对内容、素材权利、位置精度和部署开关作单独确认。
