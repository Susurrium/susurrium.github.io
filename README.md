# Susurrium Blog

Susurrium 的个人博客，基于 [Arthals-Ink](https://github.com/zhuozhiyongde/Arthals-Ink) 的真实 Fork 开发。站点主体延续 Arthals 的视觉与架构，并在独立开发阶段接入已确认的入口动画、三类内容、三类卡片和装饰效果。

当前状态：生产版本已经发布到 GitHub Pages，远程 `main`、`develop` 均已收敛到生产提交 `7993411`。当前发布基线包含 5 篇 Saying，Blog/Trace 仍为空集合；后续正式文章按本文档和 [开发、验证与 Git 流程](./docs/DEVELOPMENT.md) 进入发布链路。历史审计和发布准备材料已归档，当前分支结构只保留 `main`、`develop` 与短生命周期的 `codex/*` 工作分支。

## 锁定基线

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`
- Astro：`6.1.8`
- astro-pure：`1.4.6`
- Node.js：`>=22.12.0`
- Bun：`1.4.0`
- 输出：静态站点，目标地址 `https://susurrium.github.io/`

## 文档

- [最终内容替换与发布交接](./docs/FINAL_RELEASE_HANDOFF.zh-CN.md)
- [内容数据架构](./docs/CONTENT_DATA_ARCHITECTURE.zh-CN.md)
- [卡片裁剪工作台](./docs/CARD_CROP_REVIEW.md)
- [来源与复用台账](./docs/SOURCE_LEDGER.md)
- [第三方素材说明](./docs/THIRD_PARTY_NOTICES.md)
- [视觉基线](./docs/VISUAL_BASELINE.md)
- [开发、验证与 Git 流程](./docs/DEVELOPMENT.md)

历史审计材料见 [`docs/archive/`](./docs/archive/)。

## 本地命令

```powershell
bun install --frozen-lockfile
bun run dev
bun run ci
```

`bun run ci` 会依次执行环境预检、只读 ESLint、Astro 检查与静态构建、阶段契约、全部 `test/` 测试、发布就绪审计和资源体积检查。当前生产基线的 Blog/Trace 目录可以为空；历史文章暂未纳入当前发布树，但仍保存在仓库外快照/bundle 中，是否恢复须按归档对账报告逐篇确认。`bun run release:gate --strict` 必须在新构建后运行；它按最终渲染 DOM 检查 SEO、资源、旧身份和未登记外部媒体。

## 分支

- `main`：生产分支，只接收经过验证的发布合并。
- `develop`：集成分支，必须保持包含当前生产基线。
- `codex/*`：短生命周期的功能、文章、修复或文档分支，完成后通过 PR 合并并清理。
- `upstream`：Arthals-Ink 只读参考源，不直接合并未经审阅的代码。

当前 GitHub Pages 部署工作流保留 `workflow_dispatch`，因此 `main` push 会触发 CI，但不会自动发布；需要在 Actions 中手动运行 `Deploy to GitHub Pages`。部署前强制执行 `bun run ci` 和严格 `release:gate`。链接健康检查仅使用人工 `links:check:dry`，不会自动 commit/push。

## 许可与来源

仓库代码继续保留上游 Apache-2.0 许可证。外部参考实现、历史项目代码和素材的精确来源、版本、复用方式及必要调整统一记录在[来源台账](./docs/SOURCE_LEDGER.md)；第三方字体、图片、视频和二维码的权利边界见 [third-party notices](./docs/THIRD_PARTY_NOTICES.md)，不由项目许可证自动覆盖。
