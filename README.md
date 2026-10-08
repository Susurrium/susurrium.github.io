# Susurrium Blog

Susurrium 的个人博客，基于 [Arthals-Ink](https://github.com/zhuozhiyongde/Arthals-Ink) 的真实 Fork 开发。站点主体延续 Arthals 的视觉与架构，并在独立开发阶段接入已确认的入口动画、三类内容、三类卡片和装饰效果。

项目已完成主体功能和一轮项目加固，内容基线为 1 篇 Blog、5 篇 Saying，Trace 允许为空。发布版本以 `main` 分支和成功的 GitHub Pages 部署记录为准。完整改动与验证记录见 [项目加固记录](./docs/PROJECT_HARDENING.zh-CN.md)，本轮收尾见 [发布候选记录](./docs/RELEASE_20260926.zh-CN.md)，开发与发布流程见 [开发文档](./docs/DEVELOPMENT.md)。

## 锁定基线

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`
- Astro：`7.3.1`，保留 unified Markdown 渲染
- astro-pure：`1.4.7`，兼容补丁由 `patches/` 和 Bun 锁文件重放
- Node.js：`>=22.12.0`
- Bun：`1.4.0`
- 输出：静态站点，目标地址 `https://susurrium.github.io/`

## 文档

- [最终内容替换与发布交接](./docs/FINAL_RELEASE_HANDOFF.zh-CN.md)
- [内容数据架构](./docs/CONTENT_DATA_ARCHITECTURE.zh-CN.md)
- [卡片裁剪工作台](./docs/CARD_CROP_REVIEW.md)
- [图片交付与预算验证](./docs/MEDIA_DELIVERY.md)
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

Windows 本地完整检查建议使用 `node scripts/run-sequential.mjs ci`，构建可用 `node scripts/run-sequential.mjs build`。它们执行相同检查序列，避免本机曾出现的 Bun 启动链下 esbuild 管道停滞；Linux CI 保留 `bun run ci`。

`bun run ci` 会依次执行环境预检、只读 ESLint、Astro 检查与静态构建、阶段契约、全部 `test/` 测试、发布就绪审计和资源体积检查。当前生产基线的 Blog/Trace 目录可以为空；历史文章暂未纳入当前发布树，但仍保存在仓库外快照/bundle 中，是否恢复须按归档对账报告逐篇确认。`bun run release:gate --strict` 必须在新构建后运行；它按最终渲染 DOM 检查 SEO、资源、旧身份和未登记外部媒体。

## 分支

- `main`：生产分支，只接收经过验证的 PR；包括 `develop → main` 的网站版本发布，以及从 `main` 创建、只修改内容和随文素材的独立内容发布。
- `develop`：网站集成分支，必须包含当前生产基线；网站功能从这里开发。
- `codex/*`：短生命周期分支。网站功能从 `develop` 创建并 PR 回 `develop`；独立文章从 `main` 创建并 PR 回 `main`。完成后同步生产基线并清理分支。
- `upstream`：Arthals-Ink 只读参考源，不直接合并未经审阅的代码。

独立内容发布只能修改已支持的 Blog、Trace 或 Saying 正文及其专属媒体；不能依赖 `develop` 中尚未发布的 schema、模板或组件。内容 PR 合并到 `main` 并部署后，必须通过 PR 将 `main` 同步回 `develop`。网站功能仍使用 `codex/* → develop → main` 的发布路线。

GitHub Pages 保留手动 `workflow_dispatch`，且只允许选择 `main` 分支。部署工作流对同一份产物完成 `bun run ci`、严格 `release:gate` 和三项浏览器回归后才上传；普通 CI 的浏览器任务复用已验证的构建产物。链接健康检查仅使用人工 `links:check:dry`，不会自动 commit/push。

## 许可与来源

仓库代码继续保留上游 Apache-2.0 许可证。外部参考实现、历史项目代码和素材的精确来源、版本、复用方式及必要调整统一记录在[来源台账](./docs/SOURCE_LEDGER.md)；第三方字体、图片、视频和二维码的权利边界见 [third-party notices](./docs/THIRD_PARTY_NOTICES.md)，不由项目许可证自动覆盖。
