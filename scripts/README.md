## 友链健康检查

`check-links.mjs` 会探测 `public/links.json` 中 `cf-links` 与
`inactive-links` 两个分组的博客地址。连续失败达到阈值后，条目会自动移动到
`inactive-links`；恢复后会按稳定的添加顺序移回。头像地址不会参与判定，避免单独的
CDN 故障把整篇博客误判为失效。

```powershell
# 只查看结果，不修改文件
bun run links:check:dry

# 执行检查并更新分组/状态记录
bun run links:check
```

默认每次检查请求 3 次，临时故障连续 2 次检查失败才移动；证书错误、HTTP 404/410
和降级到 HTTP 的重定向会在本次重试结束后立即移动。可用
`--retries=N`、`--threshold=N`、`--timeout=N` 和 `--concurrency=N` 调整；脚本还会把
失败计数保存在 `scripts/link-health.json`，因此不会因一次短暂网络抖动立即移动。

候选仓库不启用定时链接 workflow，也不会在部署时自动写回状态。发布审计期间只运行
`links:check:dry`；如果未来要启用写模式，必须由人工审阅 diff 后单独提交
`public/links.json` 和 `scripts/link-health.json`，并重新评估 workflow 的权限与触发器。

## 其他会写文件的开发脚本

- `card-preview:generate` 只为卡片裁剪审阅生成 `src/content/sayings/card-preview-*` 与
  `src/content/traces/card-preview-*` 临时内容。审阅后必须移出；即使命中 `.gitignore`，也不能让
  这些文件留在构建树中。
- `cache:avatars` 会写入 `public/avatars/` 并可能更新 `public/links.json`。头像缓存目录已忽略；
  若要把缓存作为生产资源保留，必须先逐项审阅来源、许可和清单 diff，再单独纳入提交。
- `capture:visual-baseline` 的默认输出目录是 `artifacts/visual-baseline/`。使用自定义
  `VISUAL_OUTPUT_DIR` 时，仍应选择仓库外目录或已忽略的 `artifacts/` 子目录。

## 历史分支/工作树审计

`branch-state-audit.mjs` 是只读的 Git 状态盘点器。它扫描当前仓库可见的 refs、
Codex checkpoint/capture refs 和 reflog，并以 commit/tree 去重；每个唯一状态都会
与选定的 HEAD 做路径、模式和 blob id 比较。脚本不会切换分支、写入索引、恢复历史
文件或删除 Git 对象；输出目录已经存在时会拒绝运行，避免覆盖证据。

默认输出到新的 `artifacts/branch-state-audit-<timestamp>/`（`artifacts/` 已被忽略）。
如果要保留在仓库之外，请显式指定一个不存在的绝对目录：

```powershell
node scripts/branch-state-audit.mjs `
  --snapshot-dir E:\code\release-prep-snapshot-20260902-021211 `
  --snapshot-dir E:\code\develop-sync-snapshot-20260902-083331 `
 --bundle E:\code\blog-susurrium-before-release-20260902-021211.bundle `
 --bundle E:\code\blog-susurrium-before-develop-sync-20260902-083331.bundle `
  --bundle E:\code\blog-susurrium-history-audit-20260902-092106.bundle `
  --bundle E:\code\blog-susurrium-release-final-20260902-043328.bundle `
 --out E:\code\branch-state-audit-<unique-timestamp>
```

主要产物：

- `refs.csv`：每个 ref/快照分支/bundle head/reflog 事件及其解析到的 commit/tree；
- `states.csv`：唯一 `(commit, tree)` 状态与路径计数；
- `path-diffs.csv`：相对当前 HEAD 的 `CHANGED`、`CURRENT_MISSING`、
  `HISTORICAL_MISSING` 路径/blob/mode 差异（默认省略未变化行，但会计数）；
- `path-decisions.csv`：按唯一路径聚合的确定性分类表。每行包含状态集合及计数、
  覆盖的 state/tree 数量、样本 tree/state、分类、处理决策和理由；默认不为
  `UNCHANGED` 路径生成决策行（没有差异就没有恢复决策）。
- `snapshot-evidence.csv`：快照中的 `untracked.txt`、暂存/未暂存清单、porcelain 状态
  和 patch 的路径记录。patch 文件本身的大小与 SHA-256 在 `sources.csv` 中保留；
  未跟踪文件不会被普通 patch 包含，因此必须同时提供快照目录；
- `unreachable.csv`：`git fsck` 的不可达/悬空对象清单；默认只将 commit 作为候选状态，
  需要时可加 `--include-unreachable-trees`；
- `report.md` 与 `run.json`：范围、数量、警告、命令参数和证据文件说明。

当前分类器版本（`pathClassifierVersion=1`）会产生以下稳定类别：`CURRENT_ONLY`（只在比较 HEAD）、
`EXPECTED_EVOLUTION`（同路径但 blob/模式演进）、`QUARANTINE_TEMP`（临时预览/截图/日志）、
`REJECT_ORPHAN_DOC_ASSET`、`USER_CONFIRM_CONTENT`（真实内容候选，必须站长确认）、
`REJECT_GENERATED_CONTENT`、`REJECT_DRAFT_CONTENT`、`REJECT_SUPERSEDED_RUNTIME`、
`REJECT_UNUSED_ASSET`、`REJECT_SIDE_EFFECT_WORKFLOW`、`REJECT_GENERATED_STATE` 和
兜底的 `UNCLASSIFIED`。`report.md` 与 `run.json` 会同时记录每类数量、未分类路径数及
未分类运行时候选数；出现非零值时必须先扩展规则或人工审阅，不能把它当作已确认删除。

这些差异和分类只是候选证据，不是自动恢复或删除建议。恢复任何内容前，应在独立审计
分支中逐项记录来源、隐私/许可证、产品意图和运行时验证结果；对 `USER_CONFIRM_CONTENT`
必须取得站长明确决定后再迁移或发布。

可在审计完成后用 PowerShell 把“未分类必须为零”作为一个可重复的门槛：

```powershell
$run = Get-Content E:\code\branch-state-audit-<timestamp>\run.json | ConvertFrom-Json
if ($run.counts.unclassifiedPathDecisions -ne 0 -or
    $run.counts.unclassifiedRuntimeCandidates -ne 0) {
  throw 'path classifier has unclassified candidates; review path-decisions.csv'
}
```
