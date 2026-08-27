# 开发前准备状态

> 记录范围：Phase 0 准备阶段（已完成）｜当前实施进度请查看：[IMPLEMENTATION_PLAN.zh-CN.md](./IMPLEMENTATION_PLAN.zh-CN.md)

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
- 将 npm Pure 未发布的 Arthals `Signature` 组件登记并移到本地。
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

### 4.2 目标栈状态

已验证：

- `astro check`：0 errors。
- ESLint：0 errors。
- `astro build`：成功。
- 输出模式：static。
- 生成页面：164。
- RSS：成功。
- Sitemap：成功。
- Pagefind：成功索引 164 页。
- `bun run ci`：完整通过，包括真实 Node 版本、Bun、远端、工作流触发器、frozen lock、lint、构建和资源门禁。
- GitHub Linux CI：提交 `dc8e6d80c079545a41f9812ea5e5bcc8687d04e2` 已通过，[运行记录](https://github.com/Susurrium/susurrium.github.io/actions/runs/33050923402)。

当前生成的 Arthals 测试站点为 465 个文件、约 42 MiB；后续本地视频和音乐尚未加入。

上游保留的 4 张测试图片超过首版新资源的 2 MiB 门禁。它们使用路径、精确字节数和 SHA-256 临时锁定在 `scripts/asset-budget-legacy.json`；这不是放宽全局限制。图片被替换或修改后例外会立即失效，正式发布前必须删除这些上游占位资源和对应例外。

## 5. 已禁用外部服务

- Umami。
- Google Analytics。
- Waline。
- 在线 hitokoto。
- Substats。
- Arthals CodeTime badge。

Pure 1.4.6 要求 quote 配置存在，因此暂时指向本地 `/data/development-quote.json`。Phase 1 将由本地 Sayings collection 正式替代。

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
- [x] 准备提交已推送到 `develop` 并通过 GitHub CI。

Phase 0 至此完成。后续功能阶段以此冻结基线为准；当前实际进度请始终以实施方案为准。

## 9. 目前不是阻塞项的输入

- 最终视频、音乐和图片尚未提供。
- 最终个人文案和内容尚未提供。
- GitHub 热力图尚未创建定时任务，这是既定选择。
- 自定义域名尚未决定，首版默认不用。

这些事项不阻塞占位开发。

## 10. 当前发布状态（Phase 6）

Phase 0 的记录只证明了本地准备完成，不等同于站点已上线。当前仓库保留测试文章、上游身份与开发期媒体，因此部署工作流仍仅可手动触发；远端 Pages 尚未作为最终站点验收。

截至当前版本，`bun run ci`、生产构建、浏览器生命周期回归和 Arthals 视觉基线采集均已通过。严格门禁仅剩以下 7 类最终内容替换项：

- 上游测试文章和友情链接中的图片热链；
- 临时 LargeSkull 题图描述；
- 临时 Saying 文本；
- Arthals 身份与站点配置；
- 上游作者/资料引用；
- 上游 Arthals 域名引用。
- 每日音乐仍为本地不可播放占位，尚未提供同源音频文件。

已不再有 GitHub 动态卡片 API、`target=_blank` 安全属性、Waline 或统计运行时的发布拦截。个人资料与本地音乐替换后应重新运行严格门禁，而不是将这些开发期例外永久白名单化。精确替换入口见 [最终内容替换与 GitHub Pages 发布交接](./FINAL_RELEASE_HANDOFF.zh-CN.md)。

最终资料替换后，应依次运行 `bun run ci` 与 `bun run release:gate`；手动 Pages workflow 在上传产物前会再次执行严格门禁。经用户确认后，保留 `workflow_dispatch` 并只启用 `push → branches: [main]`，在 GitHub Pages 设置中选择 **GitHub Actions**，并对实际 `https://susurrium.github.io/` 进行上线回归。
