# Susurrium Blog

Susurrium 的个人博客，基于 [Arthals-Ink](https://github.com/zhuozhiyongde/Arthals-Ink) 的真实 Fork 开发。站点主体延续 Arthals 的视觉与架构，并在独立开发阶段接入已确认的入口动画、三类内容、三类卡片和装饰效果。

当前状态：开发前基线已经建立，功能开发尚未开始，GitHub Pages 自动发布保持关闭。

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

`bun run ci` 会依次执行环境预检、只读 ESLint、Astro 检查与静态构建、资源体积检查。

## 分支

- `main`：保留为生产分支。
- `develop`：首版集成分支。
- 功能分支：从 `develop` 创建。

准备阶段只提供手动触发的 Pages workflow，不监听 `main` push，也没有定时任务。

## 许可与来源

仓库代码继续保留上游 Apache-2.0 许可证。外部参考实现、历史项目代码和素材的精确来源、版本、复用方式及必要调整统一记录在[来源台账](./docs/SOURCE_LEDGER.md)；文章测试内容暂沿用上游，正式发布前再替换。
