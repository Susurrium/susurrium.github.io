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

资源预算：

```powershell
bun run check:assets
```

上游遗留的大图只可通过 `scripts/asset-budget-legacy.json` 的精确路径、字节数和 SHA-256 临时豁免。不要为新资源增加宽泛例外；替换上游占位图时同时删除对应条目。

CI 等价命令：

```powershell
bun run ci
```

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
2. 运行占位和外部请求扫描。
3. 运行 `bun run ci`。
4. 验证深层路由、404、RSS、sitemap。
5. 将 deploy workflow 增加 `main` push 触发。
6. 合并到 `main`。

首版不创建 `schedule`。

## 9. 参考实现

复制或改动参考实现时，在代码文件头或邻近注释记录：

- 来源 URL。
- 仓库和 commit（若有）。
- 台账条目 ID。
- 复用方式：直接、略调、混合或自行开发。
- 与原实现的必要差异。

来源变化必须同步更新 `docs/SOURCE_LEDGER.md`。
