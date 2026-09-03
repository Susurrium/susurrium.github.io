# Owner Confirmation Record

> 记录日期：2026-09-02（Asia/Shanghai）｜确认人：Susurrium｜状态：`OWNER_CONFIRMED`｜性质：发布准备阶段的历史决定记录

本文件是发布准备树的可追溯决定账本。它把站长确认工作单中的决定映射到仓库
实现；相关候选后来已经合并并发布。本文件继续作为内容、隐私、素材和授权边界的
历史证据，不等同于对未来新增内容的自动授权。

## 1. 证据来源

| 证据 | 位置/标识 |
| --- | --- |
| 站长确认工作单 | `E:\code\blog-susurrium-owner-confirmation-worksheet-20260902.md` |
| 工作单 SHA-256（本次记录时） | `1D0E49E157962D4CB9B1AB0898E5F6AB25415A152056605AE9906E964F45FF27` |
| 应用前基线提交 | `70c0e97bcdeeee35d1701aa66cc03428f7d0f07d` |
| 历史路径机器矩阵 | `E:\code\branch-state-audit-final-20260902-1115\path-decisions.csv` |

工作单初始粘贴的 About 第二句漏写了“原因”；站长随后直接提供的完整文字是本次
最终文案的权威来源，差异已在工作单中保留说明。

## 2. 决定账本

### About

决定：`KEEP_CUSTOM`。以下是确认时的原始标记形式：

```text
你好，我是 Susurrium，一个目前就读于北京大学医学部非典型医学牲。
一边被~~分化生化物化~~药理药代药动折磨，一边在~~完成CS231n 的 Assignment~~查找loss 不下降原因时心态崩溃。
非常佩服A神，于是选择用相同的模版做了这个博客。
最喜欢的游戏的~~那个夏天的~~ow。
```

实现文件 [`src/data/profile.ts`](../src/data/profile.ts) 保留所有可见文字，并将
`~~...~~` 转成 `<del>...</del>`。Home 的
`src/components/home/ProfileIntro.astro` 和 `/about` 页面都从这一个数据源渲染，
所以不存在两份简介各自漂移的问题。旧短版和历史长版均不恢复。

### 个人公开事实

| 范围 | 决定 | 实现结果 |
| --- | --- | --- |
| 学校 | `KEEP` | 北京大学 |
| 院系 | `KEEP` | 医学部 |
| 在读状态 | `KEEP` | `current` |
| 起始月份 | `KEEP` | `2025-09` |
| 计算机科学技术双学位 | `REJECT` | 不公开、不恢复 |
| 旧教育经历 | `REJECT` | 不恢复北京大学 2021、人大附中 2014 |
| 课程助教经历 | `REJECT` | 不恢复 2024-09-11《计算机系统导论》 |
| 助教链接 | `REJECT` | 不恢复 `https://slide.huh.moe/` |

`src/data/education.ts` 和 `src/data/experience.ts` 按上述边界保持；没有从历史
About 内联资料整树复制个人事实。

### 历史内容

决定：`ALL_REJECT`。机器审计识别的 93 个真实历史内容候选（Blog 86、Trace 4、
Saying 3）全部不进入当前发布树。它们只保留在外部快照、隔离区和 bundle 中，
不对 Git 历史做重写。`card-preview-*`、`draft-*`、截图、浏览器 profile、临时
HTML/日志和生成状态文件同样排除，不进入 collection、RSS、Pagefind 或生产路由。

### 媒体、链接、字体与位置

站长对工作单列出的当前媒体、视频、音乐、地图、头像、二维码、项目/社交链接和
字体授权范围回复“上面的全部没问题”，并填写 `MEDIA_RIGHTS: CONFIRMED`、
`FONT_RIGHTS: CONFIRMED`。因此本候选记录为 `OWNER_CONFIRMED`；仓库仍保留
第三方来源/许可证说明，项目 Apache-2.0 不被误读为素材许可证。

Residence 决定为 `PUBLIC_LOCATION_PRECISION: CITY`：仅公开当前配置的北京城市级
坐标（`39.9, 116.4`、`publicPrecision: 'city'`），不恢复更精确历史坐标。

### 生成物与副作用

- `.github/workflows/check-links.yml`（O1）决定为 `EXCLUDE_SIDE_EFFECT_WORKFLOW`；
  作为外部/隔离证据保留，不纳入候选，不启用 schedule、自动写回、自动 commit 或 push。
- 卡片裁剪预览及生成卡片内容决定为 `EXCLUDE_GENERATED`；只用于审阅，不成为
  正式文章或构建索引输入。

## 3. 实施边界与剩余授权

本记录当时授权的范围仅是：在本地 `develop` / `codex/release-prep` 候选树中写入上述
内容、保留已确认公开粒度、排除明确生成物，并运行完整验证。该范围已随发布准备
阶段结束而关闭；它不构成未来内容的自动授权：

- push 到任何远端、合并到 `main`、修改 Pages 设置或部署；
- 删除/覆盖外部快照、隔离区、历史 bundle；
- 把未来新增历史内容自动视为 `KEEP`；新增候选仍需新的 owner 决定。

若未来需要公开 93 个历史内容中的任何一项，必须为具体 slug 新建 `KEEP`/`EDIT`
记录，并重新执行路径审计、隐私/授权审查、构建和浏览器回归。
