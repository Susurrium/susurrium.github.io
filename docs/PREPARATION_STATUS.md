# 开发前准备状态

> 记录范围：Phase 0 准备阶段（历史快照，截至 2026-08-27）｜当前 release-prep 候选以本文件 §10 和 [RELEASE_PREP_AUDIT.zh-CN.md](./RELEASE_PREP_AUDIT.zh-CN.md) 为准。

## 当前 release-prep 候选（2026-09-02）

- 分支：`codex/release-prep`（当前与 `develop` 同一提交）；当前基线：`5fabdb5fd5fbdddc97f2b631ee68f5432bde5791`；历史整理起点为 `8b05952ca54ca32843cdbbcc2f815b6d61a5a9be`。
- 本轮只在本地整理，不 push、不 merge、不部署、不修改 Pages 设置。
- 历史 Blog/Trace/Saying 内容和旧聚合路由暂不纳入当前候选；原始文件保存在仓库外快照和 bundle 中。真实内容是否恢复须以[分支/检查点对账报告](./BRANCH_STATE_RECONCILIATION.zh-CN.md)的逐篇确认结果为准，暂不纳入不等于历史脱敏或永久删除。
- Blog、Trace 目录以 `.gitkeep` 保留，空集合行为已纳入 phase 1/2、RSS、分页和浏览器验证；当前 Saying 候选为 5 篇。
- 当前静态构建约生成 21 个页面；数量以提交后干净 worktree 的最新日志为准，不沿用下方历史 164 页数字。
- 当前候选的自动链接写回 workflow 被排除；部署仅手动触发，链接检查使用 `links:check:dry`。
- Residence 只公开城市级坐标；素材权利、个人资料和最终内容仍需站长在上线前逐项确认。

## 1. 仓库

| 检查项             |     状态 | 结果                                                       |
| ------------------ | -------: | ---------------------------------------------------------- |
| GitHub Fork        |     完成 | `Susurrium/susurrium.github.io` 保留 Arthals-Ink Fork 关系 |
| 本地 clone         |     完成 | `E:\code\blog_susurrium`                                   |
| `origin`           |     完成 | `https://github.com/Susurrium/susurrium.github.io.git`     |
| `upstream`         |     完成 | `https://github.com/zhuozhiyongde/Arthals-Ink.git`         |
| 禁止 upstream push |     完成 | push URL 为 `DISABLED`                                     |
| 上游基线标签       |     完成 | `arthals-upstream-2026-03-22`                              |
| 集成分支           |     完成 | `develop`                                                  |
| 自动部署           | 保持关闭 | 仅准备本地手动 workflow；真实 Pages 设置留待最终上线确认   |

上游基线：

`15f5ad110af8ed8f38a1e506dd890d2d921f118f`

## 2. 工具链

| 工具       | 要求             | 已验证           |
| ---------- | ---------------- | ---------------- |
| Git        | 现代版本         | 2.54.0.windows.1 |
| GitHub CLI | 已登录 Susurrium | 2.96.0           |
| Node.js    | ≥22.12.0         | 24.18.0          |
| Bun        | 1.4.0            | 1.4.0            |
| ripgrep    | 推荐             | 15.2.0           |

Bun 和 ripgrep 已通过 WinGet 安装。安装后新终端会自动获得 PATH；本次任务中使用了 Bun 的绝对安装路径完成验证。

## 3. 目标依赖

| 包           | 上游原值  | 当前锁定       |
| ------------ | --------- | -------------- |
| Astro        | `^5.12.0` | `6.1.8`        |
| astro-pure   | `1.3.4`   | `1.4.6`        |
| @astrojs/rss | `^4.0.12` | `4.0.19`       |
| @types/node  | `^22.9.0` | `24.13.3`      |
| Bun lock     | 上游 lock | 已按目标栈重建 |

同时完成：

- 移除未启用但会引入第二套 Astro 5 的 `@playform/compress`。
- 移除未使用的 Vercel adapter 依赖。
- 固定 `@types/hast=3.0.5`，消除 Shiki 4 的重复 HAST 类型。
- 从 `astro:content` 的旧 `z` 导入迁移到 `astro/zod`。
- 将 Pure 1.4.6 的 social/config 类型变化适配到现有配置。
- 排除不参与运行的旧 `packages/pure` 类型检查。
- 将 npm Pure 未发布的参考项目 `Signature` 组件登记并移到本地共享组件目录。
- 升级 RSS 到支持 Zod 4 的版本。
- 将 lockfile 的 tarball 地址统一到 npm 官方 registry，并用 frozen install 复核。
- 移除应用项目不需要的 TypeScript `declaration` 输出，并将 Node 类型对齐到 24。

## 4. 构建证据

### 4.1 原始上游状态

在未迁移的 Arthals 基线上，依赖安装成功，但静态构建失败：

- 上游代码从 `astro-pure/user` 导入 `Signature`。
- npm `astro-pure@1.3.4` 并未导出该组件。
- 原仓库依赖本地 Pure 副本，但普通安装没有自动链接它。

因此不能把“上游仓库可 clone”误记为“上游仓库开箱可构建”。

### 4.2 目标栈状态（历史快照）

以下是 Phase 0 记录时（2026-08-27）的验证，不是当前 release-prep 候选的页面数量证据：

- `astro check`：0 errors。
- ESLint：0 errors。
- `astro build`：成功。
- 输出模式：static。
- 生成页面：164。
- RSS：成功。
- Sitemap：成功。
- Pagefind：成功索引 164 页。
- `bun run ci`：当时完整通过，包括真实 Node 版本、Bun、远端、工作流触发器、frozen lock、lint、构建和资源门禁。
- GitHub Linux CI：提交 `dc8e6d80c079545a41f9812ea5e5bcc8687d04e2` 已通过，[运行记录](https://github.com/Susurrium/susurrium.github.io/actions/runs/33050923402)。

以上是 Phase 0 记录时的 Arthals 测试站点快照（465 个文件、约 42 MiB）；当时本地视频和音乐尚未加入。当前候选已接入本地入口视频与公共网易云音乐，页面数量和内容状态请以 §10 及 release-prep 审计文件为准。

Phase 0 快照曾保留 4 张上游测试图片，并在 `scripts/asset-budget-legacy.json` 中用精确路径、字节数和 SHA-256 临时锁定；这不是放宽全局限制。`codex/release-prep` 已删除这些占位资源及对应豁免，历史说明仅用于解释快照差异。

## 5. 外部服务状态

以下服务按当前需求保留并已登记：

- 生产 Umami（`cloud.umami.is/script.js`）。
- Waline（`https://waline-susurrium.vercel.app`）。
- 公共网易云 Meting 播放器及当前歌单。
- CodeTime 徽章 endpoint。
- CARTO 地图样式；浏览器 Geolocation 仅在用户授权后使用。

以下服务仍明确不接入：Google Analytics、在线 hitokoto、Substats、Friend Circle 远程接口。

Pure 1.4.6 要求 quote 配置存在，因此开发期继续指向本地 `/data/development-quote.json`；Home 的可见 Saying 使用本地 Sayings collection。Friend Circle 的历史代码可以保留，但页面不输出标题、占位区或请求。

## 6. 历史项目保护

历史项目：

- 路径：`E:\code\homepage`
- 分支：`codex/pure-migration`
- HEAD：`1e968f3b076ffb02dad45a6a5f2db216a5d9d700`
- 提交说明：`feat: commit PKU canvas backdrop effects`
- 审计时状态：92 条 porcelain 状态，包含 49 个未跟踪路径
- tracked diff 指纹：`4a00654f8d7e40f7fc295016743297fb16672613`
- untracked 路径清单指纹：`0faee75a235128878fc1c19e18f9bb1e53d3a4cc`

未对历史仓库执行 stash、reset、checkout、pull、rebase 或 clean。

已建立本地可恢复快照：

`E:\code\homepage-snapshots\2026-08-27-pre-blog-migration`

快照包括：

- `repository.bundle`：已提交历史。
- `working-tree.patch`：tracked 二进制补丁。
- `untracked/`：49 个未跟踪文件，保持相对路径。

校验：

- Bundle SHA-256：`39A2FC583856AF0F3E322C66DB8BA6E5B5B45C7A2DB5A868AC0B615831DF1040`
- Patch SHA-256：`79E01C1EE429D5768DEB8ADBD84C399A5F5E940DE8A0E5909AB58633117258D0`
- 快照文件数：51
- 快照总大小：30,631,924 bytes

后续仍然只读提取，不在历史仓库中修复或格式化。

## 7. 准备阶段文件

- [完整实施方案](./IMPLEMENTATION_PLAN.zh-CN.md)
- [来源台账](./SOURCE_LEDGER.md)
- [开发与 Git 流程](./DEVELOPMENT.md)
- CI workflow。
- 手动 Pages workflow。
- Node/Bun 版本约束。
- 开发环境和换行规则。
- Preflight 与资源体积检查。

## 8. 进入 Phase 1 的条件

以下条件全部满足后开始页面和内容开发：

- [x] Fork 和远端关系正确。
- [x] 上游基线 SHA 和标签冻结。
- [x] 历史项目有可恢复快照。
- [x] Astro 6 + Pure 1.4.6 检查和构建通过。
- [x] 方案文档落盘。
- [x] 来源方式矩阵落盘。
- [x] 自动发布保持关闭。
- [ ] GitHub Pages 真实发布模式切换与线上部署验证（留待最终上线）。
- [x] 外部统计、评论和在线一言停用。
- [ ] 本次 release-prep 候选尚未 push；提交后只在本地干净 worktree 复核。

Phase 0 至此完成。后续功能阶段以此冻结基线为准；当前实际进度请始终以实施方案为准。

## 9. 仍需站长确认的发布输入

- 个人资料、公开邮箱/社交链接、收款二维码和居住地最终公开粒度。
- Home 图库、头像、favicon、视频、二维码和字体的公开再分发权；详见
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
- 旧 Blog/Trace 内容是否永久不公开；当前候选只做工作树层面的排除，未做历史重写。
- 自定义域名和真实 Pages 发布设置。首版候选不启用自动部署或定时链接写回。

这些输入不阻塞本地 release-prep 候选的构建验证，但会阻塞线上发布。

## 10. 当前发布状态（release-prep 候选）

Phase 0 的记录只证明了本地准备完成，不等同于站点已上线。当前候选以
`codex/release-prep` 为当前整理对象（与 `develop` 同树）：历史内容和旧聚合路由暂不纳入，
Blog/Trace 空集合行为有代码、测试和浏览器证据；原始文件保存在仓库外快照中，内容恢复仍待站长确认。

候选提交后必须在干净验证 worktree 中依次运行 `bun install --frozen-lockfile`、
`bun run ci`、`bun run links:check:dry`、`bun run release:gate --strict` 和两项浏览器
回归。严格门禁通过只说明当前渲染产物满足技术审计，不代表个人资料、素材权利或内容
已经获得线上发布授权。链接健康检查不自动改写仓库，Pages workflow 仍仅手动触发。

精确的纳入、排除、快照和验证记录见 [RELEASE_PREP_AUDIT.zh-CN.md](./RELEASE_PREP_AUDIT.zh-CN.md)。
