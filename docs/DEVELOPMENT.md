# 开发与 Git 流程

## 1. 首次准备

要求：

- Node.js 22.12 或更高；项目和 CI 固定使用 `.node-version` 的 24.18.0。
- Bun 1.4.0。
- Git。

安装依赖：

```powershell
bun install --frozen-lockfile
```

运行开发服务器：

```powershell
bun run dev
```

## 2. 验证

快速环境检查：

```powershell
bun run preflight
```

类型和 Astro 检查：

```powershell
bun run check
```

只读 ESLint（不会自动改文件）：

```powershell
bun run lint:check
```

完整静态构建：

```powershell
bun run build
```

Windows 本地建议直接运行 `node scripts/run-sequential.mjs build`，完整 CI 对应 `node scripts/run-sequential.mjs ci`，检查内容与 Bun 命令完全相同。2026-09-12 的本机验证中，Bun 启动链曾在 `Building static entrypoints` 停滞；检查发现 esbuild 子进程输入管道存在未完成写入，换直接 Node 入口后完整流程通过。该现象尚未定位到上游根因，不依赖自动重试掩盖失败。重新构建前先用 `bun run preview -- stop` 停止本项目的后台预览。

如果开发覆盖层提示 `Failed to load url /vendor/maplibre...`，先停止并重新启动开发服务器，再硬刷新浏览器。MapLibre 6.4.1 的发行模块、shared、worker 和 CSS 都固定在 `public/vendor`；地图接近视口时通过本地 `<script type="module">` 桥接加载，不交给 Vite 重打包。替换版本必须同步全部依赖模块、来源台账和 `verify:phase5` 哈希。

已完成阶段的静态契约回归：

```powershell
bun run verify:phase1
bun run test:phase2
bun run verify:phase2
bun run verify:phase3
bun run test:phase4
bun run verify:phase4
bun run test:phase5
bun run verify:phase5
bun run verify:phase6
```

`verify:phase3` 覆盖根路径可重复入口、本地入口媒体哈希、Typed.js 固定版本、全局音乐单例/详情紧凑模式、已登记音乐运行时/图片缩放/二维码运行时、原生 View Transition rejection guard，以及 ClientRouter 生命周期清理。音乐播放器继续使用当前公共网易云 Meting 配置；这不是文章媒体的通用远程白名单。

`test:phase4` 覆盖页面 profile 的纯策略边界；`verify:phase4` 复核 PKU/George 原始 vendor 文件和构建产物的 SHA-256、原始 PKU 参数、宿主的销毁钩子、路由映射，以及生产产物中不存在效果脚本热链。

`test:phase5` 覆盖 HanLife 公开贡献 HTML 的解析、53 周中性骨架，以及 SkyWT 复用的地理计算；`verify:phase5` 复核 SkyWT/TNXG/MapLibre 的本地资源哈希、MapLibre 惰性加载与 ClientRouter 清理契约、热力图的无 Token 回退、About-only 小人和生产产物中无 TNXG 热链。

`verify:phase6` 是开发期的发布就绪审计：它验证 noindex、canonical、RSS、sitemap、静态资源、语言声明、图片替代文本决策、已登记的外部资源边界、公共网易云音乐配置和手动部署保护。占位扫描和外部资源扫描针对的是最终生成 HTML 中用户实际能看到或加载的 DOM/属性，不把源码注释、CSS 类名或只存在于脚本字符串中的测试字样误判为页面内容。为了允许当前测试内容继续用于开发，测试文章、上游身份和未替换的文章媒体会显示为警告，而不会让普通 CI 失败；未知远程资源的警告同时给出有限数量的精确 URL 和页面，便于逐项决定。

`bun run ci` 还会运行 `bun run test:all`，覆盖 `test/` 下的全部测试文件，而不只运行按阶段命名的测试。

2026-09-08 工具链已升级为 Astro 7.3.1 / Pure 1.4.7 / MDX 8.0.0 / sharp 0.35.4。构建通过 Node 运行，Pure 兼容补丁保存在 `patches/`，安装时由 Bun 自动重放。Markdown 明确使用 unified，保留原有插件。ESLint 同时检查 `src/`、`scripts/` 和根配置，完整 CI 的各测试只执行一次。

需要逐条审阅全部未知远程资源时，可在构建后运行 `node scripts/verify-phase6.mjs --external-details`；它只读取 `dist`，在不改变门禁结论的前提下输出完整 URL/页面清单。不要把该清单中的整域名直接加入白名单。

候选或最终资料替换完成后，必须在新构建之后额外执行严格门禁：

```powershell
bun run release:gate --strict
```

严格门禁会将上述开发期警告升级为失败；它通过才表示产物可进入人工上线检查。当前生产基线支持 Blog/Trace 空集合和现有 Saying 内容，但真实内容、素材权利、个人资料和公开位置仍需人工确认；历史路径的完整对账见 [归档审计报告](./archive/BRANCH_STATE_RECONCILIATION.zh-CN.md)。最终内容替换的精确路径、媒体约束和上线顺序见 [最终内容替换与 GitHub Pages 发布交接](./FINAL_RELEASE_HANDOFF.zh-CN.md)。

已确认的运行时例外只包括当前保留的功能：CARTO 地图样式、公共网易云 Meting 播放器脚本/API、生产 Umami 脚本、CodeTime 徽章 endpoint、启用的 Waline 服务、构建期 GitHub 贡献数据，以及 `public/links.json` 中现有友链头像。它们按精确服务/路径登记；文章正文中的其他远程图片、音频、视频、iframe、脚本或样式不会因为“同一域名”而自动放行。

浏览器回归分成三项：`verify:phase6:browser` 验证移动端目录的打开、焦点、Tab 循环、Escape、空 Blog 归档和减少动画，并确认 Home 随机 Saying 与归档保持同一图片/裁剪身份；`verify:home-hero` 验证固定 Hero 在越界、边界反向滚动和不同视口下的连续裁剪；`verify:browser:lifecycle` 验证入口、Home 固定结构、本地 MapLibre ESM 运行时加载不会触发 Vite 覆盖层、空白点击过滤、Links 中含引号文本的复制、十次以上真实 ClientRouter 路由切换、音乐持久化、各效果 profile、About-only 小人、Blog/Trace/Saying 公共 Opening Media 是否复用同源图片并满足参考站的右对齐/向下偏移、`blur(24px)` 与 `.6/.45/.3/.15` 四档透明度、直接暗色 Home 中透明效果 iframe 不会遮盖内容，以及 reduced-motion 下的销毁。脚本会从当前构建动态发现详情路由，因此不会把某一篇测试文章写死。GitHub Linux CI 会在生产预览上自动执行三项；本机也可连接默认的 `http://127.0.0.1:9224` Chrome DevTools 与 `http://127.0.0.1:4321` 预览，或通过 `CHROME_CDP_URL`、`PHASE6_SITE_URL` 覆盖：

```powershell
bun run preview -- --host 127.0.0.1 --port 4321
bun run verify:phase6:browser
# Home Hero 固定媒体在边界和反向滚动时的连续裁剪
bun run verify:home-hero
bun run verify:browser:lifecycle
```

`verify:home-hero` 会在桌面、标准移动和短移动视口分别采样 Hero 顶部、完全越界、边界反向返回等状态，确认固定媒体的裁剪高度与 Hero 剩余可见高度一致；如使用其他端口，设置 `HOME_HERO_SITE_URL`。

视觉基线取证使用另一个、不会把截图提交到 Git 的命令。它需要将冻结的 Arthals 产物服务在 `4322`、当前 `dist`/预览服务在 `4321`，并启动带 `--remote-debugging-port=9224` 的 Chrome：

```powershell
bun run capture:visual-baseline
```

该命令会采集 `/`（上游）对 `/home`（当前）以及 Blog、标签、归档、搜索、About、Links 的桌面/移动、明/暗主题顶部和底部截图，并写入 `artifacts/visual-baseline/`。详情页不再写死测试 slug；如需详情证据，设置 `VISUAL_CURRENT_BLOG_DETAIL_PATH`（及可选的 upstream/GitHub 详情变量）。复核范围和已登记差异见 [VISUAL_BASELINE.md](./VISUAL_BASELINE.md)。

Opening Media 的本地视觉样本使用 `qa-local-*` 与 `zz-qa-visual-*` 前缀，覆盖 Blog、Trace、Saying 的正方形、宽幅、深浅色和 fallback 图片。它们必须在本地构建后重新启动预览服务才能出现；审阅结束后要按前缀连同 `src/assets/qa-local-media/` 一起移出，不能把这些占位内容带入正式发布树。

资源预算：

```powershell
bun run check:assets
```

上游遗留的大图只可通过 `scripts/asset-budget-legacy.json` 的精确路径、字节数和 SHA-256 临时豁免。不要为新资源增加宽泛例外；替换上游占位图时同时删除对应条目。

预算同时扫描 `public/`、`src/assets/`、`src/content/` 与生成的 `dist/`。另统计单页 HTML 和初始 JS/CSS 的 gzip 大小；它不代表懒加载地图/音乐等完整交互成本。Hero 原图或图库列表变更后执行 `bun run generate:hero-images`，将候选图和 `src/data/hero-images.json` 一起审阅。字体页面使用 WOFF2，原始字体和可选重建脚本 `scripts/generate-fonts.py` 保留。

## 内容创建与维护

```powershell
bun run new --type blog --folder --language zh-CN "新的文章"
bun run new --type trace "一段记录"
bun run new --type saying --author "作者" --source "出处" "一句话"
bun run new --type blog --mdx --dry-run "先预览创建结果"
bun run date --dry-run
```

创建命令默认 `draft: true`；显式 `--publish` 才创建公开条目，也可以审阅正文后手动更改 frontmatter。支持 `--slug`、`--folder`、`--mdx`；`--language` 使用现行字段，旧 `--lang` / `-l` 保留兼容。标题、引号和多行描述由 YAML 序列化，不要手工拼接脚本输入。

日期脚本递归处理 Blog 的 Markdown/MDX，使用相对路径维护校验记录；不带 `--dry-run` 才应用。解析任何文章失败都会终止写入。展示时区统一为 Asia/Shanghai。

## 当前浏览器与发布行为

音乐控件首次点击才请求 APlayer 和 Meting 歌单；站点不再加载 Meting2 runtime。失败时显示重试和歌单链接，路由切换保留播放实例。浏览器回归先激活播放，再验证事件订阅数量和持久化。

Astro 7 支持后台预览：`bun run preview -- --background --host 127.0.0.1 --port 4321`；停止使用 `bun run preview -- stop`。代理环境可能自动使用后台模式，不应假定启动命令退出就意味着服务已停止。

CI 的浏览器任务下载静态验证生成的 dist，不再次构建。手动 Pages 工作流仅允许 main；上传前对这份产物执行严格门禁和同一套浏览器检查。所有详情、搜索词和目录分支从真实内容发现，缺失分支明确报告；测试内容不会注入待部署产物。

友链健康检查：

```powershell
# dry-run：只检查，不改动友链文件
bun run links:check:dry

# 检查并按状态更新 cf-links / inactive-links
bun run links:check
```

检查器只探测博客主链接，不探测头像 CDN。临时故障连续失败达到默认阈值（2 次）才会移动；
证书错误、HTTP 404/410 和降级到 HTTP 的重定向会立即移动。恢复后会按稳定顺序移回；
状态计数保存在 `scripts/link-health.json`。发布候选只运行 dry-run；不会启用定时
workflow，也不会让 Pages 部署在工作树中写回链接状态。若要使用写模式，必须人工审阅
diff 后单独提交。

CI 等价命令：

```powershell
bun run ci
```

构建、preflight 与 CI 通过 `scripts/run-sequential.mjs` 逐项启动子命令，不依赖 shell 的 `&&`。构建先以
`node node_modules/astro/bin/astro.mjs build` 刷新内容/类型，再用同一个 Node 入口运行 `check --noSync`；CI 内联同一组命令而不再嵌套
`bun run build`。Windows 本机推荐 `node scripts/run-sequential.mjs ci`，减少嵌套 Bun launcher 导致子进程管道停滞的风险。Linux CI 仍执行同一组构建与诊断门槛。

## 3. 分支

这是 Fork 仓库。GitHub CLI 可能默认选择上游仓库；首次使用先执行
`gh repo set-default Susurrium/susurrium.github.io`。创建 PR、查询 CI、合并和触发部署时仍建议显式传入
`--repo Susurrium/susurrium.github.io`，避免把发布操作发给上游。

- `main`：生产分支，只接收经过验证的发布合并。
- `develop`：网站集成分支，必须包含当前生产基线；网站功能和需要新代码支持的内容从这里开发。
- `codex/*`：短生命周期工作分支。网站功能从 `develop` 创建并 PR 到 `develop`；独立内容从 `main` 创建并 PR 到 `main`。
- `upstream`：Arthals-Ink 的只读参考源，不直接合并未经审阅的代码。

网站功能与独立内容使用不同的发布路线：

```text
网站功能：
develop → codex/<feature>（从 develop 创建）
        → PR 合并到 develop
        → develop → main 发布 PR
        → 手动部署 Pages

独立内容：
main → codex/content-<topic>（从 main 创建，只含内容与随文媒体）
     → PR 合并到 main
     → 手动部署 Pages
     → main → develop 同步 PR
```

独立内容发布用于在网站开发尚未完成时发布兼容当前线上版本的 Blog、Trace 或 Saying。它只能修改内容文件及该内容专属的本地媒体，不得依赖 `develop` 中尚未进入 `main` 的 schema、模板、组件、站点配置或样式。若必须修改这些代码，应先走网站功能路线发布代码，再发布内容。内容 PR 合并并部署后，要通过 `main → develop` PR 同步生产基线，保证 `develop` 始终包含线上版本。

### 3.1 基线收敛

如果 `develop` 曾落后于已发布的 `main`，先将生产基线同步回 `develop`，再开始新的功能开发。共享分支不要 rebase、force-push 或 reset：

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/sync-production-baseline origin/develop
git merge --ff-only origin/main
git push -u origin codex/sync-production-baseline
```

创建 `codex/sync-production-baseline → develop` 的 PR，等待 CI 通过后合并。若仓库明确允许直接快进更新，也可以在确认工作树干净后将同一快进提交推送到 `develop`。完成后确认：

```powershell
git fetch origin
git rev-list --left-right --count origin/develop...origin/main
```

结果应为 `0 0`，表示开发和生产没有基线差异。已合并且没有独有提交的旧分支可以先保留归档，确认无误后再使用安全删除：

```powershell
git branch -d codex/<merged-topic>
git push origin --delete codex/<merged-topic>
```

删除前必须先检查 `git log origin/main..origin/<merged-topic>` 为空；任何仍有独有提交的分支都不得删除。

### 3.2 日常开发

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c codex/<topic>

# 开发和本地预览
bun run dev

# 提交前验证
bun run ci
bun run release:gate --strict
bun run links:check:dry

git status
git add <明确需要提交的文件>
git commit -m "feat: describe change"
git push -u origin codex/<topic>
```

网站功能分支通过 PR 合并到 `develop`。独立内容分支的流程见第 8.1 节。当前 CI 对 `develop`/`main` 的 push 和针对这两个分支的 PR 执行；分支单独 push 不等于已经完成 CI，因此应始终创建 PR。

## 4. 提交边界

以下内容应分开提交：

1. 框架/依赖迁移。
2. 内容 schema 和路由。
3. 卡片视觉。
4. 单个外部效果。
5. 媒体资源。
6. 测试和基线更新。

不要在一个提交中同时升级框架、重构路由和接入多个视觉效果。

## 5. Upstream

查看上游：

```powershell
git fetch upstream
git log --oneline --decorate develop..upstream/main
```

`upstream` 仅供读取，push URL 已禁用。不得直接 merge 未审阅的 upstream/main。

## 6. 历史项目

`E:\code\homepage` 是只读素材源。

提取前：

- 对照 `docs/SOURCE_LEDGER.md` 确认来源。
- 校验历史仓库的 HEAD、tracked diff 指纹和 untracked 路径清单指纹与台账一致。
- 默认从 `E:\code\homepage-snapshots\2026-08-27-pre-blog-migration` 的固定快照读取；只有台账明确标记时才读取当前工作树。
- 如果任一指纹发生变化，先建立新的只读快照并更新台账，不能把两个时间点的文件记作同一来源。
- 只复制明确需要的组件、样式、脚本、数据和测试。
- 不在历史仓库运行格式化、安装或修复命令。

## 7. 依赖规则

- 不使用 `latest`。
- 当前 Astro 固定 7.3.1，Pure 固定 1.4.7；历史首版来源见 SOURCE_LEDGER。
- 依赖兼容修复使用 `bun patch`，将补丁及锁文件一并审阅，不保留只存在于 `node_modules` 的临时修改。
- 新依赖必须说明用途、是否进入浏览器、是否增加外部请求。
- 若依赖只为一个小函数服务，优先评估本地纯函数。

## 8. 部署

当前生产地址是 `https://susurrium.github.io/`，部署平台是 GitHub Pages，不是 Vercel。生产发布链路为：

```text
codex/<topic>
  → PR 合并到 develop
  → PR 合并到 main
  → main push 触发 CI
  → Actions 手动运行 Deploy to GitHub Pages
  → 验证线上页面
```

### 8.1 发布文章或功能

先判断内容是否完全兼容当前 `main`：

- 若只新增或修改正文、frontmatter 和该内容专属媒体，且使用的 schema、模板和组件都已存在于 `main`，可走“独立内容发布”。
- 若需要新增或修改 schema、路由、组件、样式、站点配置或构建脚本，必须先走“网站功能发布”。不能让文章分支依赖 `develop` 中尚未发布的代码。

#### 独立内容发布

先确认工作区干净，或将其他未提交改动妥善隔离；不要把开发分支上的工作带入内容发布分支。然后从最新 `main` 创建分支：

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/content-<topic>
```

1. Blog 文件放在 `src/content/blog/`；Trace 放在 `src/content/traces/`；Saying 放在 `src/content/sayings/`。字段约束以 `src/content.config.ts` 在当前 `main` 中的版本为准。
2. 正式内容使用 `draft: false`；Blog 必须有 `title`、`description`、`publishDate`；Trace 设置 `cover` 时必须同时设置 `coverAlt`。
3. 图片、音频、视频优先使用仓库内、仅供该内容使用的资源；检查来源权利和未登记的远程媒体。PR 不得夹带网站代码或配置改动。
4. 运行 `bun run dev` 预览；在新构建后运行 `bun run ci`、`bun run release:gate --strict` 和 `bun run links:check:dry`。严格门禁失败时不得合并或部署。
5. 检查暂存范围后提交、推送，创建 `codex/content-<topic> → main` PR。等待 `CI` 的 `validate` 和 `browser-regression` 成功，并人工审阅预览、内容、媒体权利和公开信息后合并。
6. 按第 8.2 节手动部署并检查线上文章。
7. 创建 `main → develop` 同步 PR；CI 通过后合并。若在此期间 `develop` 已有自己的提交，应通过 PR 完成合并，不得对共享分支 rebase、force-push 或 reset。

#### 网站功能发布

网站功能仍从最新 `develop` 创建工作分支：

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c codex/<topic>
```

完成后运行 `bun run ci`、`bun run release:gate --strict` 和 `bun run links:check:dry`，创建 `codex/<topic> → develop` PR。经过 CI 和人工预览后合并；确认准备上线后，再创建 `develop → main` 发布 PR。

### 8.2 GitHub Pages 发布

当前 `.github/workflows/deploy.yml` 保留 `workflow_dispatch`，所以 `main` push 不会自动部署。合并到 `main` 后：

1. 确认 `CI` 的 `validate` 和 `browser-regression` 成功。
2. 在 GitHub Actions 选择 `Deploy to GitHub Pages`，点击 **Run workflow**，选择 `main`。
3. 等待 workflow 内的 `bun run ci` 和严格 `bun run release:gate` 通过；严格门禁失败时不得绕过。
4. 验证 `/`、`/home`、文章详情、标签、归档、`/404`、`/rss.xml`、sitemap、移动端、暗色主题和关键第三方运行时。

如以后需要合并即自动上线，才在保留 `workflow_dispatch` 的同时增加 `push → branches: [main]`；不得添加 PR 或 `schedule` 部署触发。自动发布前应先启用 `main` 分支保护，要求 PR、CI 状态检查和禁止 force-push。

首版不创建 `schedule`。

## 9. 参考实现

复制或改动参考实现时，在代码文件头或邻近注释记录：

- 来源 URL。
- 仓库和 commit（若有）。
- 台账条目 ID。
- 复用方式：直接、略调、混合或自行开发。
- 与原实现的必要差异。

来源变化必须同步更新 `docs/SOURCE_LEDGER.md`。
