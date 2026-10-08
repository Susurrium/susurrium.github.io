# 内容写作指南

适用于创建、编辑和预览 Blog、Trace、Saying。首次运行项目见 [开发指南](./DEVELOPMENT.md#环境与本地运行)；发布操作使用 [独立内容发布](./DEVELOPMENT.md#独立内容发布)。

## 选择内容类型与目录

| 类型   | 用途                     | 目录                   | 列表入口   |
| ------ | ------------------------ | ---------------------- | ---------- |
| Blog   | 长文、学习笔记、项目总结 | `src/content/blog/`    | `/blog`    |
| Trace  | 生活、思考和过程记录     | `src/content/traces/`  | `/traces`  |
| Saying | 引文、短句及补充说明     | `src/content/sayings/` | `/sayings` |

正文可以是 Markdown 或 MDX。有随文图片时使用独立目录中的 `index.md`／`index.mdx`，图片与正文一起纳入 Git。已发布内容的路径是公开链接的一部分，更名或移动前核对现有引用。`tags` 为保留路径，开启归档分页时不能使用纯数字内容 ID。

## 创建内容

在仓库根目录执行：

```powershell
bun run new --type blog --folder --language zh-CN "新的文章"
bun run new --type trace --folder "一段记录"
bun run new --type saying --author "作者" --source "出处" "一句值得收藏的话"
bun run new --type blog --mdx --dry-run "预览创建结果"
```

| 选项                   | 行为                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `--type`               | 选择 blog、trace 或 saying，默认 Blog                                  |
| `--folder` / `-f`      | 创建独立目录与 index 文件                                              |
| `--mdx` / `-m`         | 创建 MDX 文件                                                          |
| `--slug`               | 指定安全的单一路径名称；已有同名 Markdown、MDX 或目录 index 会拒绝创建 |
| `--description`        | 摘要；Blog 未提供时先使用标题，需要根据正文完善                        |
| `--language`           | Blog 语言；旧 `--lang` / `-l` 仍兼容                                   |
| `--author`、`--source` | Saying 作者和出处                                                      |
| `--dry-run`            | 只显示目标路径和内容，不写文件                                         |
| `--publish`            | 创建时写入 `draft: false`；默认创建草稿                                |
| `--draft` / `-d`       | 明确创建草稿，不能与 `--publish` 同时使用                              |

命令以 YAML 序列化标题和文本，支持引号及多行内容。手动修改 frontmatter 时保持合法 YAML；完整参数见 [创建脚本](../scripts/new-content.mjs)。

## 填写元数据

下面三个完整示例均为草稿。实际填写对应内容日期，把字段放在文章开头的两行 `---` 之间。字段校验见 [内容 schema](../src/content.config.ts) 和 [共享校验](../src/lib/content-validation.ts)。

### Blog

```yaml
title: 一次周末记录
description: 记录这次出行中值得留下的片段。
publishDate: 2026-10-08T15:00:00+08:00
language: zh-CN
tags:
  - 生活
draft: true
```

Blog 必填标题、摘要和发布日期；标题最长 60 字符，摘要最长 160 字符。可选 `updatedDate`、`heroImage`、`language`、`comment`，评论默认开启。页面已输出主标题，正文从二级标题开始。

### Trace

```yaml
title: 一段周末记录
description: 留下沿途的见闻。
publishDate: 2026-10-08T15:00:00+08:00
tags:
  - 生活
draft: true
```

Trace 必填标题和发布日期；标题最长 80 字符，可选摘要最长 180 字符。可选更新时间与封面。需要跨版本固定配图时填写真实封面；无封面条目的备用图可能因新增内容而重新分配。

### Saying

```yaml
text: Know thyself.
originalText: Know thyself.
author: 古希腊德尔斐神谕
source: 德尔斐神谕
tags:
  - 自省
draft: true
```

Saying 必填 `text`，可选 `originalText`、`author`、`source`、`sourceUrl`、`tags`。引文与原文最长 500 字符，作者最长 80 字符，出处最长 160 字符；`sourceUrl` 只接受 HTTP/HTTPS。不添加日期或 `originalLanguage`。正文可以补充说明；不确定的作者或出处应如实注明。

### 日期与标签

内容日期展示使用 `Asia/Shanghai`；明确时刻建议带时区。`updatedDate` 不得早于 `publishDate`。未来日期不会自动延迟公开，发布状态仍由 `draft` 控制。

标签按内容类型分开，单项最长 80 字符；校验会去除两端空白、进行 NFC 规范化、小写化并去重。标签路径由程序生成，frontmatter 保存可读标签文字。

日期维护命令只递归处理 Blog：

```powershell
bun run date --dry-run
bun run date
```

应用模式可能更新正文日期与 `scripts/blog-metadata.json`，先核对只读结果。脚本按相对路径保存校验记录，任一文章解析失败会停止整批写入，并保留原有 CRLF 换行。

## 封面与正文图片

文章图片优先与 `index.md` 放在同一目录，通过相对路径引用。源文件也需要提交；网站构建不能依赖仓库外的素材备份。

Blog 增加封面字段：

```yaml
heroImage:
  src: ./cover.jpg
  alt: 湖面与岸边的树木
```

Trace 增加封面字段：

```yaml
cover: ./cover.png
coverAlt: 湖面与岸边的树木
```

Trace 设置 `cover` 时必须同时填写 `coverAlt`。Blog 封面也应提供描述图片内容的替代文本。正文图片使用：

```markdown
![湖面与岸边的树木](./lake.jpg)
```

文件名和扩展名应与实际文件一致。JPG、JPEG、PNG、WebP 等符合预算的源图片可以直接使用；照片无需统一预转 WebP，截图可保留 PNG。透明图片应选择支持透明度的格式。

封面通过 Astro `image()` 读取元数据，阅读页和 Markdown 中相对引用的本地图片由构建管线处理。源文件继续保留。`public/` 中的文件原样复制到发布目录，因此不能在其中存放仅供备份的素材。

### 图片预算

| 格式        | 建议最大体积 | 硬限制 |
| ----------- | ------------ | ------ |
| JPG / JPEG  | 512 KiB      | 2 MiB  |
| PNG         | 1 MiB        | 5 MiB  |
| WebP / AVIF | 512 KiB      | 2 MiB  |

超过建议值产生告警，超过硬限制检查失败；源文件与产物均受检查，构建优化不免除源文件检查。预算以 [资源检查脚本](../scripts/check-asset-budget.mjs) 为准。较大的照片先按实际用途缩小或压缩，保留必要清晰度、主体和比例。

在完成新构建后运行 `bun run check:assets`。公共图库、Hero 候选和图标的维护见 [公共素材](./DEVELOPMENT.md#公共素材维护)，卡片显示位置见 [裁剪工作台](./MEDIA_WORKBENCH.md)。

## 草稿与预览

新建命令默认 `draft: true`；普通列表、详情页在开发服务器和生产构建中均过滤草稿。需要通过这些页面预览时，将对应条目设为 `draft: false`，提交前核对公开意图。创建时的 `--publish` 只改变该字段，实际部署仍需发布流程。

运行 `bun run dev` 查看内容。Pagefind 索引在构建时生成，搜索和最终产物应通过 [生产预览](./DEVELOPMENT.md#环境与本地运行) 检查。修改正文后需要重新构建生产预览。内容层的 preview 模式由调用者显式启用，普通路由没有启用它。

## 发布前核对

1. 核对标题、摘要、日期、草稿状态、引文来源、标签和正文链接。
2. 核对本地素材是否提交、封面是否存在、替代文本是否正确、资源预算是否满足。
3. 检查正文、列表、详情、搜索与 RSS 中应有的展示；默认 RSS 只收录 Blog。
4. 新增外部图片、音频、视频、iframe、脚本或样式需要按精确资源审阅，现有服务的允许范围不自动扩大到正文。来源与使用条件见 [素材说明](./THIRD_PARTY_NOTICES.md)。
5. 确认只修改正文、元数据和随文素材，且兼容当前 `main`，再按 [独立内容发布](./DEVELOPMENT.md#独立内容发布) 创建分支、检查并发布。需要新 schema、模板、组件、配置或样式时，先按网站功能流程发布相应代码。

公开个人事实和历史内容时遵循已明确的范围；相关决定见 [历史确认记录](./archive/OWNER_CONFIRMATION_RECORD.zh-CN.md)。
