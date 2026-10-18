# Obsidian 多设备同步文章发布授权记录

> 日期：2026-10-19（Asia/Shanghai）｜确认人：Susurrium｜范围：本篇文章发布

## 内容与授权

用户在完成正文、方案比较、CLab 说明及随文截图审阅，并要求提交推送后，进一步明确要求“正式部署发布”。本次授权覆盖通过 PR 将《用 CLab、Tailscale 和 LiveSync 搭建 Obsidian 多设备同步》合并到 main、手动部署 GitHub Pages，以及通过 PR 将生产基线同步到 develop。

文章文件为 `src/content/blog/obsidian-clab-tailscale-livesync/index.md`，公开地址为[Obsidian 多设备同步文章](https://susurrium.github.io/blog/obsidian-clab-tailscale-livesync)。内容提交为 `baef2c72a0f6a5759f989845c7f561354460e323`。

正文依据用户提供的部署记录、设备使用情况、同步需求和校外同步体验整理。CLab 配额截图由用户提供并明确同意用于本文，来源与 SHA-256 记录在[来源台账](../SOURCE_LEDGER.md#clab-配额截图)。账号、私钥路径、服务器域名和密码使用示例值或替换说明，文章不包含实际密码、私钥、Setup URI 或登录令牌。

## 日期与发布方式

- 保留已审阅稿件的 `publishDate: 2026-10-18` 与 `draft: false`；本次是首次发布，部署操作不推进正文日期。
- 配置记录中的 2026 年 7 月日期、实测版本和真实 Vault 尚未接入的历史语境继续保留。
- 内容提交已完成本地完整 CI（166 项测试）、严格发布检查及四项浏览器回归。友链只读检查保留既有链接的请求失败与 TLS 错误结果，未改动友链数据。
- 通过内容分支到 main 的 PR 发布；Pages 从 main 手动触发，合并与部署分别检查。
- 本记录确认本篇文章及其发布范围，执行结果以对应 PR、Actions 运行和线上核验为准。
