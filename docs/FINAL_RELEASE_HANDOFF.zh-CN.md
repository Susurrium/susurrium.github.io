# 最终内容替换与 GitHub Pages 发布交接

> 适用仓库：`Susurrium/susurrium.github.io`｜当前状态：`codex/release-prep` 候选已完成最终本地验证和可审计提交，尚未上线；站长已确认的资料和边界见 [OWNER_CONFIRMATION_RECORD.zh-CN.md](./OWNER_CONFIRMATION_RECORD.zh-CN.md)，这里只处理其后续变更。

这份清单不要求重做站点结构。Blog、Traces、Sayings、三种卡片、Home 组合、入口、特效、居住地、热力图和音乐播放器都已有实现；当前候选的 Blog/Trace 集合为空，站长已明确 93 个历史内容全部不恢复，原始内容继续在仓库外快照/bundle 中保留。后续若新增资料或要求恢复内容，必须在 [OWNER_CONFIRMATION_RECORD.zh-CN.md](./OWNER_CONFIRMATION_RECORD.zh-CN.md) 之外新增逐项决定，再通过既有门禁验证。

## 1. 必须由站长提供或确认的资料

| 类别      | 需要的最终资料                                                             | 唯一入口                                                                                                            |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 站点身份  | 站名、作者名、简介、语言、Logo、favicon、社交链接、备案/页脚和友链申请资料 | `src/site.config.ts`                                                                                                |
| About 文案 | 站长确认的四段简介（含删除线语义）                                         | `src/data/profile.ts`（决定记录见 `docs/OWNER_CONFIRMATION_RECORD.zh-CN.md`）                                    |
| 入口页    | 视频、poster、Typed 文案                                                   | `public/media/` 与 `src/data/entrance.ts`                                                                           |
| Home 图库 | 六张 Hero 图、Saying 装饰图、无图 Trace 的回退图                           | `public/images/home-media/` 与 `src/data/home-media.ts`（旧锁定图留在 `public/images/largeskull/` 供回归/回滚）       |
| 音乐      | 公共网易云歌单、APlayer/MetingJS 播放器参数与临时歌单 ID                    | `src/data/music.ts` 与 `src/components/MusicPlayer.astro`                                                          |
| 居住地    | 对外可公开的地点粒度、文案、坐标、头像和回退地图                           | `src/data/residence.ts` 与 `public/media/residence/`                                                                |
| 正式内容  | Blog、Trace、Saying 的正文和元数据                                         | `src/content/blog/`、`src/content/traces/`、`src/content/sayings/`                                                  |
| 静态页面  | About、Projects、Links 与本地友链快照                                      | `src/pages/about/index.astro`、`src/pages/projects/index.astro`、`src/pages/links/index.astro`、`public/links.json` |

`src/site.config.ts` 已切换到当前站点身份（`Susurrium`）。后续若要更换最终身份资料，不要只改首页标题：配置中的 `theme.title`、`author`、`description`、`logo`、`footer`、`integ.links.applyTip` 需要一起更新，并重新运行构建与严格门禁。

Home 图库已按当前候选清单完成一次本地化：源目录为 `E:\UserData\Desktop\blog_image`，54 张图片均已转为 `public/images/home-media/*.webp` 并登记在 `src/data/home-media.ts`。当前 Hero 顺序为 `1381117 → 43935854 → 949729 → 725406 → 986446 → 556375`；Saying 使用 34 张、Trace 无图回退使用 20 张。站长已在 owner 工作单确认当前媒体范围；来源/许可证据仍按 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 留档。

## 2. 内容与卡片规则

三种内容是独立 collection，不要把 Trace 或 Saying 塞回 Blog：

| 内容   | 目录                   | 必填元数据                            | 展示规则                                                                                                                                    |
| ------ | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Blog   | `src/content/blog/`    | `title`、`description`、`publishDate` | 默认 `text` 无图文字卡；只有需要时再加 `heroImage`。只进入 RSS、Blog 标签与 Blog 时间线。                                                  |
| Trace  | `src/content/traces/`  | `title`、`publishDate`                | 默认 Media 内容题图卡；添加 `cover` 时显示内容相关图片，省略时按稳定 hash 使用预先上传的回退图。设置 `cover` 时必须同时写 `coverAlt`。 |
| Saying | `src/content/sayings/` | `text`                              | 可选 `originalText`、`author`、`source`；不记录日期、不设置 `sourceUrl`。不进主导航；Home 随机展示，About 提供完整归档入口。卡片只使用 Media 装饰图，不把图片误当作短句内容题图。 |

每个 collection 的完整 schema 都在 `src/content.config.ts`。保留 `draft: true` 可在本地预览而不生成最终路由；发布前确认不再把需要公开的内容留在草稿状态。

题图、正文图片、头像、音频和封面默认应放入仓库内的 `public/` 或由 Astro 静态资源管线处理。最终内容中的远程正文图片、音频、视频、iframe、脚本和样式必须逐项检查：严格门禁会列出精确 URL 及出现页面，不能用“整域名白名单”一并放行。当前已确认并保留的运行时例外是 CARTO 地图样式、公共网易云 Meting 播放器脚本/API、生产 Umami 脚本、CodeTime 徽章 endpoint、启用的 Waline 服务、构建期 GitHub 贡献数据，以及 `public/links.json` 中现有友链头像；普通正文超链接不属于媒体资源扫描，已确认的 CARTO 地图样式也不受文章媒体规则限制。

Links 的 Friend Circle 已关闭：页面不输出标题、空占位区、状态文案，也不会请求远程接口；相关历史代码可以保留，但不能重新挂载到页面。友链头像仍按现有 `public/links.json` 方案处理，不要求本次改成统一本地头像。

## 3. 入口、音乐和居住地的替换约束

### 入口

`src/data/entrance.ts` 的所有媒体路径已按桌面/移动、WebM/MP4 与 poster 分开。替换时保持这些同源路径可访问；根路径 `/` 每次直达都会重新播放，并通过手动进入跳转到 `/home`，不要把 Media Hero 放回根入口。

### 音乐

当前音乐暂使用参考站公共网易云歌单 `12812783625`。如需切换到第二个参考站，修改 `src/data/music.ts` 中的 `id` 和 `playlistUrl` 为 `8152976493`；如公共接口失效，再统一替换同文件中的 `api` 模板。发布前应确认播放器脚本、公共接口和歌单内容仍可访问，并评估版权与第三方服务稳定性。

播放器会从公共歌单动态取得曲目、音频、封面和歌词，不需要在仓库中维护 `audioSrc`。严格发布门禁会检查歌单服务配置与已登记的 APlayer/MetingJS 资源；公共服务失效时，应替换 `src/data/music.ts` 中的 API 模板或歌单 ID。

### 居住地

`src/data/residence.ts` 是唯一配置源。请只放入愿意公开的地点精度；更新 `label`、`city`、`region`、`displayName`、`caption`、`latitude`、`longitude`、`mapImage`、`ownerAvatar` 与 `visitorAvatar` 后，保留 CARTO 的明/暗地图样式作为现有惰性加载地图的底图。不要把精确住址或不适合公开的坐标提交进 Git 历史。

## 4. 逐项替换顺序

1. 在 `codex/release-prep` 或其后继分支替换站点身份和静态页面；当前候选不纳入历史 Blog/Trace/Saying 内容与旧聚合路由，93 个真实历史内容已按 owner 决定全部不恢复，原始内容仍可从外部快照恢复。Projects、公开链接、个人资料和二维码若发生新增变更，必须先建立新的逐项 owner 记录。Friend Circle 保持关闭状态，不要恢复标题或“准备中”占位。
2. 本次图库已完成本地化；若后续继续替换，请在 `public/images/home-media/` 生成同源 WebP，并同步更新 Hero、Saying 装饰和 Trace 回退三组数组的描述及路径。三组数组即使复用同一批图，也要保持独立，避免一次替换误伤另一种卡片策略。Media 的装饰斜边参考由 `src/data/home-media.ts` 的 `cardCutSideByFilename` 按文件名固定，不要恢复按索引奇偶交替。图片源内容的保留侧不能再从斜边方向推断；请使用本地 `/tools/card-crop-review` 统一裁剪工作台逐张拖动/缩放与正式卡片同步的两个斜边框，确认后导出 JSON，并用 `scripts/apply-card-crops.mjs` 应用到 `src/data/card-crop-selections.generated.ts`。未确认的图继续使用安全回退。
3. 填写居住地并确认公共音乐配置；确认音频不自动播放，只在用户点击后播放。
4. 运行下方的完整验证。候选验证必须在干净 worktree 中执行 `bun run ci`、`bun run links:check:dry` 和 `bun run release:gate --strict`；不要把最终资料写入白名单，也不要删除检查来“通过”。
5. 人工浏览 `/`、`/home`、Blog/Trace/Saying 详情、`/about`、`/links`、移动端和暗色主题，确认自己的图、文案、坐标和链接均符合预期。

## 5. 最终验证与发布

在没有本地预览进程占用 `dist/` 时运行：

```powershell
bun run ci
bun run capture:visual-baseline
bun run release:gate
```

`capture:visual-baseline` 生成的截图位于被 Git 忽略的 `artifacts/visual-baseline/`，用于人工确认新增资料没有破坏已锁定的主体视觉或已登记的目标差异。候选的 `release:gate --strict` 必须以 `0 failure(s)` 结束；素材权利、个人资料和内容授权仍由人工清单决定，不由脚本替代。

只有这三项完成且站长明确授权上线后，才执行发布动作：

1. 复核 `git status`，只暂存本次已审核的文件。
2. 合并并推送已验证的提交到 `main`。
3. 在 GitHub 仓库 Settings → Pages 中选择 **GitHub Actions**。
4. 当前 workflow 仍是手动触发，并会在上传产物前再次执行 `release:gate`，测试资料无法被误发。若决定启用后续自动部署，保留 `workflow_dispatch` 并只增加 `push → branches: [main]`；现有预检与 Phase 6 已支持这种最终状态，首版始终不添加 PR 或 `schedule`。
5. 在真实 `https://susurrium.github.io/` 验证入口重放、`/home`、深层路由、404、RSS、sitemap、canonical、音乐点击播放和移动端效果。

发布前的实现依据、来源和已完成的回归证据分别见 [完整实施方案](./IMPLEMENTATION_PLAN.zh-CN.md)、[开发流程](./DEVELOPMENT.md)、[准备状态](./PREPARATION_STATUS.md)、[视觉基线](./VISUAL_BASELINE.md) 与 [来源台账](./SOURCE_LEDGER.md)。
