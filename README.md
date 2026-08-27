# Susurrium Blog

Susurrium 的个人博客，基于 [Arthals-Ink](https://github.com/zhuozhiyongde/Arthals-Ink) 的真实 Fork 开发。站点主体延续 Arthals 的视觉与架构，并在独立开发阶段接入已确认的入口动画、三类内容、三类卡片和装饰效果。

当前状态：Phase 0–5 与 Phase 6 的本地实现、审计和浏览器回归已完成。测试内容和人工发布保护仍保留，因此尚未对外正式上线。

## 锁定基线

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`
- Astro：`6.1.8`
- astro-pure：`1.4.6`
- Node.js：`>=22.12.0`
- Bun：`1.4.0`
- 输出：静态站点，目标地址 `https://susurrium.github.io/`

## 文档

- [完整实施方案](./docs/IMPLEMENTATION_PLAN.zh-CN.md)
- [开发前准备状态](./docs/PREPARATION_STATUS.md)
- [来源与复用台账](./docs/SOURCE_LEDGER.md)
- [开发、验证与 Git 流程](./docs/DEVELOPMENT.md)

## 本地命令

```powershell
bun install --frozen-lockfile
bun run dev
bun run ci
```

`bun run ci` 会依次执行环境预检、只读 ESLint、Astro 检查与静态构建、阶段契约、发布就绪审计和资源体积检查。最终替换个人资料后，再运行 `bun run release:gate`；它会把测试内容、旧身份和外部媒体等发布阻断项视为失败。

## 分支

- `main`：保留为生产分支。
- `develop`：首版集成分支。
- 功能分支：从 `develop` 创建。

当前部署工作流只允许手动触发，不监听 `main` push，也没有定时任务；这是为了避免测试内容被意外发布。最终发布清单通过且获得你的上线确认后，才启用自动发布并在 GitHub Pages 中完成实际部署设置。

## 许可与来源

仓库代码继续保留上游 Apache-2.0 许可证。外部参考实现、历史项目代码和素材的精确来源、版本、复用方式及必要调整统一记录在[来源台账](./docs/SOURCE_LEDGER.md)；文章测试内容暂沿用上游，正式发布前再替换。
