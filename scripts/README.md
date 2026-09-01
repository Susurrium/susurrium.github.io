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
