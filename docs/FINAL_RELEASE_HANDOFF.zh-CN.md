# 最终内容替换与 GitHub Pages 发布交接

> 适用仓库：`Susurrium/susurrium.github.io`｜当前状态：所有页面、内容模型、组件和开发期审计已完成；这里只处理由站长亲自决定或提供的最终资料。

这份清单不要求重做站点结构。Blog、Traces、Sayings、三种卡片、Home 组合、入口、特效、居住地、热力图和音乐播放器都已有实现；替换资料时只改下表指定的入口，再通过既有门禁验证。

## 1. 必须由站长提供或确认的资料

| 类别      | 需要的最终资料                                                             | 唯一入口                                                                                                            |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 站点身份  | 站名、作者名、简介、语言、Logo、favicon、社交链接、备案/页脚和友链申请资料 | `src/site.config.ts`                                                                                                |
| 入口页    | 视频、poster、Typed 文案                                                   | `public/media/` 与 `src/data/entrance.ts`                                                                           |
| Home 图库 | 六张 Hero 图、Saying 装饰图、无图 Trace 的回退图                           | `public/images/largeskull/` 与 `src/data/home-media.ts`                                                             |
| 音乐      | 每日曲目名称、作者、说明、同源音频；可选本地封面                           | `public/media/music/` 与 `src/data/music.ts`                                                                        |
| 居住地    | 对外可公开的地点粒度、文案、坐标、头像和回退地图                           | `src/data/residence.ts` 与 `public/media/residence/`                                                                |
| 正式内容  | Blog、Trace、Saying 的正文和元数据                                         | `src/content/blog/`、`src/content/traces/`、`src/content/sayings/`                                                  |
| 静态页面  | About、Projects、Links 与本地友链快照                                      | `src/pages/about/index.astro`、`src/pages/projects/index.astro`、`src/pages/links/index.astro`、`public/links.json` |

`src/site.config.ts` 仍有 Arthals 测试身份；这是当前严格门禁的故意阻断项。不要只改首页标题：配置中的 `theme.title`、`author`、`description`、`logo`、`footer`、`integ.links.applyTip` 需要一起换成最终资料。

## 2. 内容与卡片规则

三种内容是独立 collection，不要把 Trace 或 Saying 塞回 Blog：

| 内容   | 目录                   | 必填元数据                            | 展示规则                                                                                                                                    |
| ------ | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Blog   | `src/content/blog/`    | `title`、`description`、`publishDate` | 默认 Arthals 无图文字卡；只有需要时再加 `heroImage`。只进入 RSS、Blog 标签与 Blog 时间线。                                                  |
| Trace  | `src/content/traces/`  | `title`、`publishDate`                | 默认 LargeSkull 内容题图卡；添加 `cover` 时显示内容相关图片，省略时按稳定 hash 使用预先上传的回退图。设置 `cover` 时必须同时写 `coverAlt`。 |
| Saying | `src/content/sayings/` | `text`、`publishDate`                 | 不进主导航；Home 随机展示，About 提供完整归档入口。卡片只使用 LargeSkull 装饰图，不把图片误当作短句内容题图。                               |

每个 collection 的完整 schema 都在 `src/content.config.ts`。保留 `draft: true` 可在本地预览而不生成最终路由；发布前确认不再把需要公开的内容留在草稿状态。

题图、正文图片、头像、音频和封面都应放入仓库内的 `public/` 或由 Astro 静态资源管线处理。不要在最终内容中保留 `https://` 图片、视频、音频、脚本或样式热链：严格门禁会拒绝这些运行时资源。普通的正文超链接和已确认的 CARTO 地图样式不受这条限制。

## 3. 入口、音乐和居住地的替换约束

### 入口

`src/data/entrance.ts` 的所有媒体路径已按桌面/移动、WebM/MP4 与 poster 分开。替换时保持这些同源路径可访问；根路径 `/` 每次直达都会重新播放，并通过手动进入跳转到 `/home`，不要把 LargeSkull Hero 放回根入口。

### 音乐

把音频与可选封面放到 `public/media/music/`，然后在 `src/data/music.ts` 的每一个 `dailyMusic` 项目上填写同源绝对路径，例如 `/media/music/quiet-morning.ogg`。不要使用远程播放器、Meting、网易云或 CDN 音频。

每日选择会轮换所有条目，因此每一首而不是只第一首都必须有可播放的 `audioSrc`。严格发布门禁会检查：没有占位曲目、曲目数与音频路径数一致、所有路径都是 `public/` 内的真实文件。封面是可选项。

### 居住地

`src/data/residence.ts` 是唯一配置源。请只放入愿意公开的地点精度；更新 `label`、`city`、`region`、`displayName`、`caption`、`latitude`、`longitude`、`mapImage`、`ownerAvatar` 与 `visitorAvatar` 后，保留 CARTO 的明/暗地图样式作为现有惰性加载地图的底图。不要把精确住址或不适合公开的坐标提交进 Git 历史。

## 4. 逐项替换顺序

1. 先在新分支替换站点身份、静态页面和测试内容；删除不需要保留的上游文章、链接、作者资料和域名引用。Links 的 Friend Circle 要么换成已审核的本地快照，要么连同标题一起移除，不能保留“准备中”状态。
2. 本地化所有最终媒体，并同时替换 Hero、Saying 装饰和 Trace 回退三组数组的描述及路径。三组数组即使暂时使用同一批图，也要保持独立，避免以后一次替换误伤另一种卡片策略。
3. 填写居住地和所有每日音乐；确认音频不自动播放，只在用户点击后播放。
4. 运行下方的完整验证。严格门禁的零失败不是可选项；不要把最终资料写入白名单，也不要删除检查来“通过”。
5. 人工浏览 `/`、`/home`、Blog/Trace/Saying 详情、`/about`、`/links`、移动端和暗色主题，确认自己的图、文案、坐标和链接均符合预期。

## 5. 最终验证与发布

在没有本地预览进程占用 `dist/` 时运行：

```powershell
bun run ci
bun run capture:visual-baseline
bun run release:gate
```

`capture:visual-baseline` 生成的截图位于被 Git 忽略的 `artifacts/visual-baseline/`，用于人工确认新增资料没有破坏 Arthals 主体视觉或已登记的目标差异。`release:gate` 必须以 `0 failure(s)` 结束。

只有这三项完成且站长明确授权上线后，才执行发布动作：

1. 复核 `git status`，只暂存本次已审核的文件。
2. 合并并推送已验证的提交到 `main`。
3. 在 GitHub 仓库 Settings → Pages 中选择 **GitHub Actions**。
4. 当前 workflow 仍是手动触发，并会在上传产物前再次执行 `release:gate`，测试资料无法被误发。若决定启用后续自动部署，保留 `workflow_dispatch` 并只增加 `push → branches: [main]`；现有预检与 Phase 6 已支持这种最终状态，首版始终不添加 PR 或 `schedule`。
5. 在真实 `https://susurrium.github.io/` 验证入口重放、`/home`、深层路由、404、RSS、sitemap、canonical、音乐点击播放和移动端效果。

发布前的实现依据、来源和已完成的回归证据分别见 [完整实施方案](./IMPLEMENTATION_PLAN.zh-CN.md)、[开发流程](./DEVELOPMENT.md)、[准备状态](./PREPARATION_STATUS.md)、[视觉基线](./VISUAL_BASELINE.md) 与 [来源台账](./SOURCE_LEDGER.md)。
