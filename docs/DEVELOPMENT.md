# 开发与维护指南

适用于运行、配置、维护、验证和发布网站。正文编辑见 [内容指南](./CONTENT.md)，实现契约见 [架构说明](./ARCHITECTURE.md)，裁剪应用见 [工作台](./MEDIA_WORKBENCH.md)。本文件集中维护操作要求；历史证据见 [归档索引](./archive/README.md)。

## 环境与本地运行

准备 Git、[`.node-version`](../.node-version) 指定的 Node 和 [`package.json`](../package.json) 的 `packageManager` 指定的 Bun。Node 最低要求见 `engines`；本地验证与 CI 应使用固定版本。

```powershell
bun install --frozen-lockfile
bun run dev
```

访问终端输出的地址。生产预览需要新构建：

```powershell
node scripts/run-sequential.mjs build
bun run preview -- --host 127.0.0.1 --port 4321
```

Windows 推荐直接 Node 入口；其他环境可运行等价的 `bun run build`。顺序脚本先校验响应式媒体清单，再以 Node 执行 Astro CLI 的 `build` 和 `check --noSync`，避免重复内容同步。Pagefind 在构建时生成；修改内容后重新构建才能更新生产预览。

后台预览可用 `bun run preview -- --background --host 127.0.0.1 --port 4321`，停止使用 `bun run preview -- stop`。启动命令退出不代表后台服务已停止，重新构建前停止占用本项目 `dist/` 的预览。

依赖精确版本、完整性和兼容补丁分别由 `package.json`、`bun.lock`、`patches/` 维护。升级需审阅补丁并完成相关检查；不使用 `latest`，不保留仅写入 `node_modules` 的修复。新增依赖说明用途、浏览器开销和外部请求。

## 配置导航

| 对象                 | 修改位置                                                                                            | 核对范围                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 网站身份、导航、集成 | [site.config.ts](../src/site.config.ts)                                                             | 标题、作者、简介、语言、Logo、页脚、友链申请资料及集成配置 |
| 简介、履历、联系方式 | [src/data/](../src/data/) 的 profile、education、experience、connect                                | Home 与 About 共用简介；公开事实保持用户明确范围           |
| 入口媒体与文字       | [entrance.ts](../src/data/entrance.ts)、[public/media/](../public/media/)                           | 桌面/手机、WebM/MP4 与 poster 成套更新                     |
| 音乐                 | [music.ts](../src/data/music.ts)                                                                    | 歌单 ID、链接和 API 模板一起核对                           |
| 居住地               | [residence.ts](../src/data/residence.ts)、[residence 素材](../public/media/residence/)              | 地点文案、坐标、头像、回退图与 CARTO 明暗样式              |
| 友链                 | [links.json](../public/links.json)                                                                  | 主链接、头像、分组；Friend Circle 保持关闭                 |
| 内容策略和分页       | [policy.ts](../src/lib/content-layer/policy.ts)、[site.config.ts](../src/site.config.ts)            | 入口、内容类型及独立分页配置                               |
| 页面、布局、组件     | [src/pages/](../src/pages/)、[src/layouts/](../src/layouts/)、[src/components/](../src/components/) | 按架构约定修改并执行相应回归                               |

居住地公开精度保持已确认的城市级；新增个人事实、项目链接、二维码或扩大公开范围时记录用户明确决定。已有授权在适用范围内继续有效，原始决定见 [站长确认记录](./archive/OWNER_CONFIRMATION_RECORD.zh-CN.md)。93 个历史内容的取舍按该记录保留，恢复具体条目时记录新的决定并验证。

## 公共素材维护

文章封面和正文图片由 [内容指南](./CONTENT.md#封面与正文图片) 维护。公共头像、签名和二维码位于 `src/assets/`，正式图标位于 `public/favicon/`；构建需使用的文件纳入 Git，原始下载素材备份可另存仓库外。

### 公共图库与 Hero

1. 将准备好的 WebP 放入 `public/images/home-media/`。建议宽度不超过 1920px，小图保持实际尺寸；`public/` 文件不会被 Astro 自动优化。
2. 更新 `src/data/home-media.ts` 中的资源池、用途和描述。Hero、Saying 装饰图、Trace 备用图各自维护。
3. 更新公共图片后运行 `bun run generate:media-images`，生成 Hero、卡片与 About 装饰人物的派生图和清单。只更新 Hero 可运行 `bun run generate:hero-images`。用 `bun run verify:media-images` 核验源哈希、尺寸、比例、候选字节和引用；具体参数以 [生成脚本](../scripts/generate-hero-images.ts) 为准。
4. 核对已有裁剪记录。同名图片替换会继续读取原配置，应在 [工作台](./MEDIA_WORKBENCH.md) 重新确认；旧候选只有在核对清单与引用后才能移除。
5. 新构建后检查相关页面和资源预算，素材、图库清单、候选与裁剪配置一起审阅。

公共素材来源登记在 [来源台账](./SOURCE_LEDGER.md)，使用条件见 [第三方说明](./THIRD_PARTY_NOTICES.md)。正式页面默认使用同源素材；新增外部正文媒体按精确 URL 审阅，现有服务例外不扩大到同域其他资源。

| 派生素材 | 候选宽度 | 目录与清单 |
| --- | --- | --- |
| Hero | 768、1280、1920px | `public/images/home-hero/`、`src/data/hero-images.json` |
| 卡片 | 480、960、1920px | `public/images/card-media/`、`src/data/card-images.json` |
| About 装饰人物 | 240、480、960px | `public/media/effects/responsive/`、`src/data/companion-images.json` |

小图保持实际宽度，派生 WebP 质量为 86，源文件保留原始字节。替换 `public/media/effects/tracer-companion.webp` 后同样执行生成与核验命令。历史 LargeSkull 参考图位于 `test/fixtures/reference-images/largeskull/`，Phase 2 核验原始哈希并确认它们不进入发布目录。

### 图片预算与回归

`bun run check:assets` 按用途区分可发布资源（`delivery`）、内容源文件（`source`）、图标母版（`master`）和历史参考图（`reference`）。相同字节、相同阈值的告警归并展示，明细保留全部路径和用途。建议值与硬限制见 [图片预算](./CONTENT.md#图片预算)；单文件还必须小于 50 MiB。告警数量不等于独立图片数量，源图存储与浏览器下载量需要分别核对。

媒体测试覆盖真实生成文件、透明度、比例、小图不放大、源文件保留、清单失效、预算边界和历史例外；隔离构建使用真实 JPEG、透明 PNG 验证 Blog／Trace 封面、正文和分享元数据。浏览器回归核对实际 `currentSrc`、阅读前景与背投图复用、裁剪工作台切换素材，以及 About 装饰人物按需加载。

### 图标

正式图标位于 `public/favicon/`，包括 16、32、180、192、512 像素 PNG，以及包含 16/32/48 像素帧的 ICO。替换时核对各尺寸、透明背景、页面引用和 `site.webmanifest`，保留制作源文件与来源证据。历史制作素材的标识及核验结果见 [图标来源](./SOURCE_LEDGER.md#图标制作源文件)。

### 分享图、字体与友链

- `bun run generate:social-card` 从已确认 Home 素材生成 `public/images/social-card.webp`，输出 1200×630 分享图。
- `python scripts/generate-fonts.py` 重建 `public/fonts/` 中的 WOFF2，需安装脚本声明的 `fonttools[woff]==4.64.0`。页面使用 WOFF2，原始字体和许可文本保留。
- `bun run links:check:dry` 只探测友链主链接，不写数据；头像 CDN 不参与失效判定。
- `bun run links:check` 更新 `cf-links`／`inactive-links` 和本地 `scripts/link-health.json`。默认每次请求重试 3 次，临时错误连续 2 次检查失败后移动；证书错误、404/410 和降级至 HTTP 的重定向在本次重试后立即移动。恢复后按稳定顺序移回。参数为 `--retries=N`、`--threshold=N`、`--timeout=N`、`--concurrency=N`，写入结果审阅后单独提交。
- 启用 `cacheAvatar` 后，`bun run cache:avatars` 写入 `public/avatars/`，可能更新 `public/links.json`。缓存目录已忽略，作为正式资源提交前检查来源与清单差异。

部署只使用友链只读检查，不定时写回、不自动 commit/push。健康计数是被忽略的本地状态。

## 验证

| 命令                   | 用途与输入                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `bun run preflight`    | 环境、依赖与工程配置预检                                             |
| `bun run docs:check`   | 文档入口、链接、锚点、归档索引、YAML 示例与命令引用                  |
| `bun run lint:check`   | 只读 ESLint，覆盖源码、脚本及根配置                                  |
| `bun run check`        | Astro 与类型检查                                                     |
| `bun run ci`           | 预检、文档检查、lint、构建、Astro 检查、全部测试、阶段契约与资源预算 |
| `bun run release:gate` | 对最新 `dist/` 执行严格发布检查，命令已包含 `--strict`               |
| `bun run check:assets` | 源文件、产物和初始 HTML/JS/CSS 预算检查                              |

Windows 完整检查使用 `node scripts/run-sequential.mjs ci`。CI 内联构建序列，全部 `test/` 只执行一次。代码改动运行对应行为测试与必要集成验证；文档改动核对内容、引用和检查脚本。发布候选必须通过完整 CI、严格检查及下述浏览器回归。

`verify:phase6` 的开发模式将测试内容、旧身份和未登记外部资源报告为警告；`release:gate` 将这些警告升级为失败。扫描依据最终 HTML/CSS 的资源与 DOM，完整未知外部资源清单可用 `node scripts/verify-phase6.mjs --external-details` 查看。不要将扫描到的整域名直接加入允许列表。

资源预算覆盖 `public/`、`src/assets/`、`src/content/` 和 `dist/`。旧资源例外由 `scripts/asset-budget-legacy.json` 精确锁定路径、字节和 SHA-256；替换后同步移除旧条目，不为新资源扩大例外。初始 gzip 预算不代表按需加载地图、音乐的完整成本。

### 专项检查入口

| 范围             | 命令                                                                  | 重点                                                              |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 内容与卡片       | `verify:phase1`、`verify:phase2`、`test:phase2`、`test:content-layer` | 三类内容、路由、卡片与策略；补充 `test/content-hardening.test.ts` |
| 入口与客户端资源 | `verify:phase3`                                                       | 入口资源、音乐、缩放、二维码、View Transition 和路由清理          |
| 背景效果         | `verify:phase4`、`test:phase4`                                        | 原始 vendor 哈希、参数、页面 profile 与销毁                       |
| 地图与贡献记录   | `verify:phase5`、`test:phase5`                                        | SkyWT/TNXG/MapLibre 哈希、懒加载、无 Token 数据与失败状态         |
| 产物与发布       | `verify:phase6`                                                       | SEO、RSS、sitemap、语言、替代文本、资源和部署保护                 |

上表脚本名通过 `bun run` 执行。阶段编号沿用脚本名，修改时按实际功能选择检查，不依赖历史实施顺序。

### 浏览器回归

生产预览默认 `http://127.0.0.1:4321`，Chrome DevTools 默认 `http://127.0.0.1:9224`。可用 `CHROME_CDP_URL`、`PHASE6_SITE_URL` 覆盖；Hero 另支持 `HOME_HERO_SITE_URL`。

```powershell
bun run verify:phase6:browser
bun run verify:home-hero
bun run verify:browser:lifecycle
```

- Phase 6 browser 检查移动目录、焦点与键盘、空归档、减少动画，以及 Home 与归档的 Saying 图片身份。
- Home Hero 检查桌面、移动、短视口下的越界与反向滚动裁剪。
- Lifecycle 检查入口、地图 ESM 加载、空白点击、含引号文字复制、多次路由切换、音乐持久性、效果启停、阅读首图、直接暗色 Home 与减少动画清理。

脚本从真实构建发现详情、搜索词和目录分支，缺失分支明确记录。CI 与 Pages 复用同一份待发布产物，不注入测试文章。专项行为要求见 [架构说明](./ARCHITECTURE.md)。

### 视觉复核

在已获得截图与视觉检查授权的范围内执行。冻结上游 `Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f` 的对照产物使用隔离 worktree；历史验证需 Node 22，上游含本地 Pure 定制时按原脚本设置 `BUN_LINK_PKG=true`。

1. 上游服务在 4322，当前生产预览在 4321，隔离 Chrome 开启远程调试端口 9224。
2. 运行 `bun run capture:visual-baseline`，默认输出 `artifacts/visual-baseline/`；自定义 `VISUAL_OUTPUT_DIR` 选择已忽略的本地目录。
3. 核对 manifest：默认 7 页、4 个视口/主题、2 个站点、顶部/底部，共 112 张截图。指定 `VISUAL_CURRENT_BLOG_DETAIL_PATH` 及可选上游/GitHub 详情变量时按实际数量核对，最多 9 页、144 张。
4. 上游 `/` 对应当前 `/home`；其余 Blog、标签（上游 `/tags` 对本站 `/blog/tags`）、归档、搜索、About、Links 分别比较。采用无尾斜杠 URL。
5. 按 [视觉与交互约定](./ARCHITECTURE.md#视觉与交互约定) 检查字号、间距、颜色、圆角、布局、Header/Footer 和交互，记录提交、工作树状态、视口、主题、异常与未覆盖范围。

Opening Media 临时样本采用 `qa-local-*`、`zz-qa-visual-*`，专用资源位于 `src/assets/qa-local-media/`；卡片样本采用 `card-preview-*`。审阅完成后移出这些样本与专用素材，再构建正式产物。`.gitignore` 不阻止内容加载器读取本地文件。历史采集结果见 [参考记录](./archive/REFERENCE_HISTORY_20261008.md)。

## 分支与发布

Fork 的 GitHub CLI 操作显式指定 `--repo Susurrium/susurrium.github.io`，首次可用 `gh repo set-default Susurrium/susurrium.github.io` 配置。`main` 为生产分支，`develop` 为网站集成分支，`codex/*` 为短期分支。开始前检查工作区，妥善隔离其他未提交修改。

### 独立内容发布

只修改兼容当前 `main` 的正文、元数据和随文媒体时：

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/content-<topic>
```

按 [内容指南](./CONTENT.md) 完成编辑与预览。运行完整 CI（包含新构建），成功后执行 `bun run release:gate` 和 `bun run links:check:dry`。审阅内容、素材及公开范围后，只暂存相关文件，提交、推送，创建工作分支到 `main` 的 PR。等待 `validate`、`browser-regression` 成功后合并。

按下面的 Pages 流程部署，之后通过 `main → develop` PR 同步生产基线。需要未发布 schema、模板、组件、站点配置或样式的内容，先按网站功能流程发布依赖代码。

### 网站功能发布

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c codex/<topic>
```

先确认 develop 包含生产基线，再实施和验证。运行完整 CI、新产物的严格检查和友链只读检查；涉及展示时完成相应人工与浏览器复核。检查差异后提交、推送并创建 `codex/* → develop` PR；CI 和审阅通过后合并，再创建 `develop → main` 发布 PR。

框架/依赖、内容模型、卡片、单个效果、媒体与测试按职责分开提交。工作分支单独推送不会触发针对 main/develop 的 PR 检查，应创建对应 PR。

### GitHub Pages 发布

当前 [部署工作流](../.github/workflows/deploy.yml) 仅手动触发，并限制 `main`；合并不会自动上线。上线操作须在用户授权范围内进行。

1. 确认目标 PR 和 `main` 的 CI 成功，候选内容与素材已经审阅。
2. Pages 发布源使用 GitHub Actions；运行 `Deploy to GitHub Pages`，选择 `main`。
3. 工作流对同一产物执行完整 CI、严格发布检查和三项浏览器回归，再上传部署；失败时修正候选并重新验证。
4. 检查线上 `/`、`/home`、详情、标签、归档、搜索、404、RSS、sitemap、canonical、移动端、暗色与关键第三方交互。

保持手动发布和无 schedule。未来只有用户明确要求自动发布时，才在保留手动入口的同时增加 main push 触发，并先启用相应分支保护；不增加 PR 或定时部署触发。

### 同步与分支清理

`develop` 落后时先通过 `main → develop` PR 同步。双方已有独立提交时正常合并并处理冲突，不对共享分支 rebase、force-push 或 reset。可快进时也可从 `origin/develop` 创建同步分支，以 `git merge --ff-only origin/main` 合并后 PR 回 develop。

更新远端引用后检查 `git rev-list --left-right --count origin/develop...origin/main`：第二个数字为 0 表示已包含生产提交，`0 0` 表示双方无独有提交。删除旧分支前确认 `git log origin/main..origin/<topic>` 为空，并核对本地分支；确认可删除后使用 `git branch -d` 和对应远端删除操作。

## 故障处理与来源维护

- Windows 构建停在 `Building static entrypoints`：停止本项目占用预览，使用本页直接 Node 入口。历史 esbuild 管道停滞的上游根因未确认，不通过无限重试放行。
- 地图出现 `/vendor/maplibre...` 加载覆盖层：重启开发服务器并硬刷新。地图使用本地 ESM 主模块、shared、worker 和 CSS；升级时同步整套文件、来源台账和 `verify:phase5` 哈希。
- 音乐加载失败：先检查配置的 API 模板与歌单，页面提供重试及歌单链接；公共服务状态需按当次响应核实。
- 搜索内容未更新：重新构建并重启预览，核对 Pagefind 索引生成结果。
- 裁剪导入或恢复问题：按 [工作台异常处理](./MEDIA_WORKBENCH.md#异常与恢复) 检查输入与状态。

`upstream` 为只读参考源，push URL 为 `DISABLED`。通过 `git fetch upstream`、`git log develop..upstream/main` 审阅差异后选择所需变更，不直接合并未经审阅的上游。

历史项目 `E:\code\homepage` 是只读素材源。默认读取 [台账](./SOURCE_LEDGER.md) 指定的固定快照，提取前核对 HEAD、tracked diff 和 untracked 清单指纹；变化时先建立新快照和来源记录。只提取需要的文件，不在历史仓库安装、格式化或修复。代码中的来源注释保留 URL、版本/提交、台账 ID、复用方式和必要差异。

提取前核对来源身份，提取后记录本地路径与 SHA-256，来源变化同步更新台账。完成模块测试、生命周期、外部资源和授权范围内的视觉复核。不复制来源页面中与目标功能无关的广告、统计、配置、凭据或用户数据。

## 低频工具与本地材料

| 操作                 | 命令或入口                            | 写入范围                                                                |
| -------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| 新建和日期维护       | [内容指南](./CONTENT.md)              | 正文与日期校验记录                                                      |
| 裁剪应用             | [工作台](./MEDIA_WORKBENCH.md)        | 两份裁剪 generated 配置                                                 |
| 卡片完整队列审阅     | `bun run card-preview:generate`       | Saying/Trace 的 `card-preview-*` 正文，不覆盖已有文章；发布前移出       |
| 只读 lint / 自动修复 | `bun run lint:check` / `bun run lint` | 后者改写被检查代码                                                      |
| 格式化               | `bun run format`                      | 批量改写匹配文件；任务中应显式限定文件范围后运行 Prettier               |
| 清理构建             | `bun run clean`                       | 删除本仓库 `.astro/`、`.vercel/`、`dist/`，先核对目标                   |
| 历史状态审计         | `bun run branch:audit`                | 新建 `artifacts/branch-state-audit-<timestamp>/` 或明确指定的不存在目录 |

审计器读取 refs、checkpoint/capture refs、reflog，按 commit/tree 去重比较；支持多次 `--snapshot-dir`、`--bundle`，`--out` 指定输出，`--include-unreachable-trees` 扩展候选。不切换分支或修改 Git 对象，目标目录已存在时拒绝执行。

输出含 `refs.csv`、`states.csv`、`path-diffs.csv`、`path-decisions.csv`、`snapshot-evidence.csv`、`unreachable.csv`、`sources.csv`、`report.md` 和 `run.json`。其中 path 决策聚合唯一文件路径，快照证据包含 patch 无法覆盖的未跟踪路径；补丁大小和 SHA-256 保存在 sources 中。

分类器版本 1 包括 `CURRENT_ONLY`、`EXPECTED_EVOLUTION`、`QUARANTINE_TEMP`、`REJECT_ORPHAN_DOC_ASSET`、`USER_CONFIRM_CONTENT`、`REJECT_GENERATED_CONTENT`、`REJECT_DRAFT_CONTENT`、`REJECT_SUPERSEDED_RUNTIME`、`REJECT_UNUSED_ASSET`、`REJECT_SIDE_EFFECT_WORKFLOW`、`REJECT_GENERATED_STATE`、`UNCLASSIFIED`。未分类路径和运行时候选数必须核实，不能据未分类结果自动恢复或删除。恢复候选逐项核对来源、隐私、许可、产品意图和行为；真实内容需明确决定。历史调用及校验示例见 [参考记录](./archive/REFERENCE_HISTORY_20261008.md)。

`artifacts/` 已被忽略，保存日志、失败诊断、状态、补丁、草稿和预览。清理前核对引用、独立备份、可再生成性，并停止占用文件的进程。裁剪导出可能含唯一确认历史；PR 描述草稿应确认正式记录已完整保存后再清理。原始授权证据、未另存补丁及有用失败记录按其用途保留。

## 文档维护

README 提供入口；作者操作归 CONTENT，网站操作归本页，实现语义归 ARCHITECTURE，裁剪操作归 MEDIA_WORKBENCH，来源与许可分别归台账和第三方说明。其他位置只保留必要摘要和章节链接。历史记录标注原始日期，当前代码行为与设计要求不一致时先核实具体差异。

修改后运行 `bun run docs:check` 并审阅语义；它不会证明外部服务可用或历史证据仍存于原机器。归档索引必须链接全部历史文档，迁移前后核对原始决定、哈希和验证结果。
