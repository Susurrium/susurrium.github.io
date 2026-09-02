# 开发与 Git 流程

## 1. 首次准备

要求：

- Node.js 22.12 或更高。
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

如果开发覆盖层提示 `Failed to load url /vendor/maplibre...`，先停止并重新启动开发服务器，再硬刷新浏览器。MapLibre 的锁定运行时是 `public/vendor` 下的 UMD 文件，`src/scripts/residence-map.ts` 会在地图接近视口时以普通 `<script>` 加载；不要把它改回 `import()`，因为 Vite 不会将 `public/` 文件作为源码模块转换。

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

需要逐条审阅全部未知远程资源时，可在构建后运行 `node scripts/verify-phase6.mjs --external-details`；它只读取 `dist`，在不改变门禁结论的前提下输出完整 URL/页面清单。不要把该清单中的整域名直接加入白名单。

候选或最终资料替换完成后，必须在新构建之后额外执行严格门禁：

```powershell
bun run release:gate --strict
```

严格门禁会将上述开发期警告升级为失败；它通过才表示产物可进入人工上线检查。当前 release-prep 候选暂不纳入历史内容并覆盖空集合路径，但真实内容、素材权利、个人资料和公开位置仍需人工确认；历史路径的完整对账见 [分支/检查点对账报告](./BRANCH_STATE_RECONCILIATION.zh-CN.md)。最终内容替换的精确路径、媒体约束和上线顺序见 [最终内容替换与 GitHub Pages 发布交接](./FINAL_RELEASE_HANDOFF.zh-CN.md)。

已确认的运行时例外只包括当前保留的功能：CARTO 地图样式、公共网易云 Meting 播放器脚本/API、生产 Umami 脚本、CodeTime 徽章 endpoint、启用的 Waline 服务、构建期 GitHub 贡献数据，以及 `public/links.json` 中现有友链头像。它们按精确服务/路径登记；文章正文中的其他远程图片、音频、视频、iframe、脚本或样式不会因为“同一域名”而自动放行。

浏览器回归分成两项：`verify:phase6:browser` 验证移动端目录的打开、焦点、Tab 循环、Escape、空 Blog 归档和减少动画；`verify:browser:lifecycle` 验证入口、Home 固定结构、本地 MapLibre UMD 加载不会触发 Vite 覆盖层、空白点击过滤、Links 中含引号文本的复制、十次以上真实 ClientRouter 路由切换、音乐持久化、各效果 profile、About-only 小人、Blog/Trace 公共 Opening Media 向下淡出并向上恢复、直接暗色 Home 中透明效果 iframe 不会遮盖内容，以及 reduced-motion 下的销毁。脚本会从当前构建动态发现详情路由，因此不会把某一篇测试文章写死。GitHub Linux CI 会在生产预览上自动执行两项；本机也可连接默认的 `http://127.0.0.1:9224` Chrome DevTools 与 `http://127.0.0.1:4321` 预览，或通过 `CHROME_CDP_URL`、`PHASE6_SITE_URL` 覆盖：

```powershell
bun run preview -- --host 127.0.0.1 --port 4321
bun run verify:phase6:browser
bun run verify:browser:lifecycle
```

视觉基线取证使用另一个、不会把截图提交到 Git 的命令。它需要将冻结的 Arthals 产物服务在 `4322`、当前 `dist`/预览服务在 `4321`，并启动带 `--remote-debugging-port=9224` 的 Chrome：

```powershell
bun run capture:visual-baseline
```

该命令会采集 `/`（上游）对 `/home`（当前）以及 Blog、标签、归档、搜索、About、Links 的桌面/移动、明/暗主题顶部和底部截图，并写入 `artifacts/visual-baseline/`。详情页不再写死测试 slug；如需详情证据，设置 `VISUAL_CURRENT_BLOG_DETAIL_PATH`（及可选的 upstream/GitHub 详情变量）。复核范围和已登记差异见 [VISUAL_BASELINE.md](./VISUAL_BASELINE.md)。

资源预算：

```powershell
bun run check:assets
```

上游遗留的大图只可通过 `scripts/asset-budget-legacy.json` 的精确路径、字节数和 SHA-256 临时豁免。不要为新资源增加宽泛例外；替换上游占位图时同时删除对应条目。

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
`bun run astro -- build` 刷新内容/类型，再运行 `bun run astro -- check --noSync`；CI 内联同一组命令而不再嵌套
`bun run build`。这避免 Windows 下直接 Node Astro 入口或嵌套 Bun launcher 偶发停在
`Building static entrypoints`。Linux CI 仍执行同一组构建与诊断门槛。

## 3. 分支

- `main`：生产。
- `develop`：首版集成。
- `feat/<name>`：功能。
- `fix/<name>`：修复。
- `chore/<name>`：工程维护。

功能分支从 `develop` 创建，完成后合并回 `develop`。正式发布时再将 `develop` 合并到 `main`。

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
- Astro 首版固定 6.1.8。
- Pure 首版固定 1.4.6。
- 不直接编辑 `node_modules`。
- 新依赖必须说明用途、是否进入浏览器、是否增加外部请求。
- 若依赖只为一个小函数服务，优先评估本地纯函数。

## 8. 部署

准备阶段的 Pages workflow 只有手动触发。

正式发布前：

1. 替换个人内容和资源。
2. 运行 `bun run ci` 和 `bun run release:gate`，清除所有严格门禁项；Pages workflow 也会在上传产物前再次运行严格门禁，不能依赖人工跳过。
3. 本地验证深层路由、404、RSS、sitemap 和减少动画。
4. 获得上线确认后，保留 `workflow_dispatch` 并将 deploy workflow 增加 `push → branches: [main]`；现有预检与 Phase 6 已只允许这种自动触发形式，仍禁止 PR 与 `schedule`。
5. 将已验证提交合并、推送到 `main`，在仓库 Settings → Pages 选择 **GitHub Actions**，并验证实际部署 URL。

首版不创建 `schedule`。

## 9. 参考实现

复制或改动参考实现时，在代码文件头或邻近注释记录：

- 来源 URL。
- 仓库和 commit（若有）。
- 台账条目 ID。
- 复用方式：直接、略调、混合或自行开发。
- 与原实现的必要差异。

来源变化必须同步更新 `docs/SOURCE_LEDGER.md`。
