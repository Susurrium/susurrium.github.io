# Susurrium Blog

Susurrium 的个人博客，基于 [Arthals-Ink](https://github.com/zhuozhiyongde/Arthals-Ink) 的真实 Fork 开发。站点主体延续 Arthals 的视觉与架构，并在独立开发阶段接入已确认的入口动画、三类内容、三类卡片和装饰效果。

当前状态：`codex/release-prep` 正在固化为可审计的本地候选基线（目前与 `develop` 同一提交）。当前候选可在空 Blog/Trace 集合下构建，尚未对外上线；素材权利、个人资料和最终内容仍需站长单独确认。历史分支、checkpoint 与工作树的逐路径对账见 [分支/检查点对账报告](./docs/BRANCH_STATE_RECONCILIATION.zh-CN.md)。

## 锁定基线

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`
- Astro：`6.1.8`
- astro-pure：`1.4.6`
- Node.js：`>=22.12.0`
- Bun：`1.4.0`
- 输出：静态站点，目标地址 `https://susurrium.github.io/`

## 文档

- [完整实施方案](./docs/IMPLEMENTATION_PLAN.zh-CN.md)
- [最终内容替换与发布交接](./docs/FINAL_RELEASE_HANDOFF.zh-CN.md)
- [开发前准备状态](./docs/PREPARATION_STATUS.md)
- [来源与复用台账](./docs/SOURCE_LEDGER.md)
- [开发、验证与 Git 流程](./docs/DEVELOPMENT.md)

## 本地命令

```powershell
bun install --frozen-lockfile
bun run dev
bun run ci
```

`bun run ci` 会依次执行环境预检、只读 ESLint、Astro 检查与静态构建、阶段契约、全部 `test/` 测试、发布就绪审计和资源体积检查。当前候选的 Blog/Trace 目录可以为空；历史文章暂未纳入当前发布树，但仍保存在仓库外快照/bundle 中，是否恢复须按对账报告逐篇确认。`bun run release:gate --strict` 必须在新构建后运行；它按最终渲染 DOM 检查 SEO、资源、旧身份和未登记外部媒体。

## 分支

- `main`：保留为生产分支。
- `develop`：首版集成分支。
- 功能分支：从 `develop` 创建。

当前部署工作流只允许手动触发，不监听 `main` push，也没有定时任务；上传 Pages 产物前强制执行 `release:gate`。链接健康检查仅作为人工 `links:check:dry` 工具，候选不包含会自动 commit/push 的 workflow。最终发布清单通过且获得你的上线确认后，才启用自动发布并在 GitHub Pages 中完成实际部署设置。

## 许可与来源

仓库代码继续保留上游 Apache-2.0 许可证。外部参考实现、历史项目代码和素材的精确来源、版本、复用方式及必要调整统一记录在[来源台账](./docs/SOURCE_LEDGER.md)；第三方字体、图片、视频和二维码的权利边界见 [third-party notices](./docs/THIRD_PARTY_NOTICES.md)，不由项目许可证自动覆盖。
