# Arthals 视觉基线复核

本文件落实 [实施方案 §18.3](./IMPLEMENTATION_PLAN.zh-CN.md#183-arthals-视觉基线门禁)。目标不是把本博客退回为无差别的 Arthals 镜像，而是在既定、已授权的首版定制之外，持续守住 Arthals-Ink 的主题架构、排版语言和交互外壳。

## 对照产物

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`。
- 当前：本仓库当前提交的静态 `dist` 或生产预览。
- 对照映射：上游 `/` 对当前 `/home`；其余 `/blog/`、文章详情、Blog 标签（当前 `/blog/tags`，上游 `/tags/`）、`/archives/`、`/search/`、`/about/` 与 `/links/` 一一对应。Trace/Saying 标签分别位于 `/traces/tags`、`/sayings/tags`，不参与跨类型对照。

上游所用 Astro 5/Vite 在本机 Node 24 下会发生模块传输超时；这是上游工具链与当前运行时的兼容性问题，不是当前站点的构建错误。建立对照产物时使用隔离 Node 22：

```powershell
bun run build
```

候选仓库固定 Bun 1.4.0，并通过 `scripts/run-sequential.mjs` 以
`bun run astro -- build` / `bun run astro -- check --noSync` 建立稳定的 Windows
构建边界；对照构建仍应在隔离 worktree 中执行，不能复用脏工作树的 `dist`。

上游若含仓库内 `packages/pure` 定制，还需先按其原有脚本设置 `BUN_LINK_PKG=true`，使其使用同一提交内的 Pure 包源码。该步骤只应在临时 detached worktree 中执行。

## 采集与复核

1. 将上游 `dist` 服务在 `http://127.0.0.1:4322`，将当前 `dist` 或 `astro preview` 服务在 `http://127.0.0.1:4321`。
2. 用 `--headless=new --remote-debugging-port=9224` 启动一个隔离 Chrome。
3. 在当前仓库运行 `bun run capture:visual-baseline`。
4. 打开 `artifacts/visual-baseline/manifest.json`，确认默认 7 个共享页面 × 4 个视口/主题 × 2 个站点 × 顶部/底部，共 **112** 张截图均已生成；如果通过 `VISUAL_CURRENT_BLOG_DETAIL_PATH` 和（可选的）GitHub 详情环境变量提供详情页，再按 manifest 中实际页面数核对（最多 9 页、144 张）。同时确认无意外运行时异常。
5. 成对检查同名的 `upstream-*` 与 `current-*` 图片。未在下表登记的字号、间距、颜色、圆角、壳层布局、Header/Footer 结构或交互变化均应作为回归处理。

截图是复核证据而非提交物，默认位于被忽略的 `artifacts/` 路径。这样最终替换个人内容、题图、视频和音乐时，不会让包含测试身份或上游素材的二进制文件进入 Git 历史。

## 已登记的首版差异

| 区域                   | 当前实现                                                                                                                                                                                                                                                                                                             | 允许原因与边界                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 根路径与首页           | `/` 是可重播的视频/逐字入口；实际 Home 位于 `/home`，采用 Media 六图、四层波浪、随机 Saying、ProfileIntro、并列 Blog/Trace、Timeline、Education、居住地和热力图；Saying/Profile 纵向分组与后续区块共用 Home 外层内容轨，About 与 Recent、Education、Residence 使用同级标题规格；站内前进入口使用 `ahead` 按钮。 | 用户锁定的信息架构与授权的 Media、xyx404、SkyWT、HanLife 效果。共享 Header、Footer、字体和 Pure 主题壳层仍应继承 Arthals 语言。                 |
| 主导航                 | `Home / Blog / Traces / Projects / About / Links`，Logo 指向 `/home`。                                                                                                                                                                                                                                               | 用户锁定 Home 入口、Blog/Trace 双内容模型与入口语义；Saying 仅从 Home 卡片和 About 进入。                                                            |
| 内容集合与卡片         | Blog、Trace、Saying 三集合；Blog 默认无图卡，Trace 可有内容题图/无图回退，Saying 用 Media 装饰图。                                                                                                                                                                                                              | 用户锁定的内容模型和卡片策略。卡片的文字层级、容器圆角、主题色与响应式壳层应保持 Pure/Arthals 风格。                                                 |
| 搜索页标签入口         | `/search` 保持 Pagefind 搜索主任务；输入说明下方显示 `Blog Tags`、`Trace Tags`、`Saying Tags` 三个类型级标签索引按钮及唯一标签数，移动端自然换行。                                                                                                                                                                   | 解决已有作用域标签路由不可发现的问题；搜索图标仍直达 `/search`，入口不扩展主导航、不改 Pagefind/noindex，也不改变内容卡片。                          |
| Trace/Saying 标签入口  | Trace/Saying 归档标题下显示紧凑的作用域标签预览和 `View all tags`；无标签时保留索引入口与空状态；Media 卡片仍只有一个主链接。                                                                                                                                                                                   | 解决已有标签路由不可发现的问题；入口位于归档边界，不改冻结的 Media DOM、CSS、斜边和移动端交互。                                                 |
| 文章详情底部           | Blog 保留版权/分享/二维码卡片；Trace、Saying 不显示该卡片及其 `Support the author` 行。                                                                                                                                                                                                                              | 这是按内容策略登记的有意差异；不影响正文、导航、评论、全站公共 Footer 或 Projects 赞助页面。                                                         |
| 全局/页面效果          | 除文章阅读页和 Links 外使用 PKU 三角/连线背景；Links 使用花瓣与空白点击粒子；About 有右侧小人；音乐跨路由单例。                                                                                                                                                                                                      | 用户获得授权的参考组件。效果只能位于显式宿主内，不能遮挡内容、重复挂载或破坏 reduced-motion。                                                        |
| About、Links           | About 增加 Saying 入口、居住地与右侧小人；Links 位于 About 之后并使用花瓣。                                                                                                                                                                                                                                          | 已确认的页面职责与效果排他规则。                                                                                                                     |
| 外部服务               | 保留 Waline、生产 Umami、CodeTime 徽章、公共网易云 Meting 音乐、CARTO 地图和构建期 GitHub 贡献数据；Friend Circle 关闭且不渲染/请求。                                                                                                                                                                                | 这些是已确认的功能例外；友链头像沿用 `public/links.json`。正文中的未知远程图片、音频、视频、iframe、脚本和样式仍由最终门禁逐项审查，不按整域名放行。 |
| 空状态与时间线         | Home 没有已发布 Saying 或所选年份 Blog 时整段不渲染；Blog/Trace/Saying 归档保留明确空状态。Timeline 使用 Asia/Shanghai 选择不晚于当前年的最新有文年份。                                                                                                                                                              | 避免空白区域和错误年份；正式内容替换后需再次检查有/无内容两种状态。                                                                                  |
| Opening Media 生命周期 | 详情页模糊图随滚动淡出，返回顶部恢复；ClientRouter 换页、resize、reduced-motion 均有清理/降级。                                                                                                                                                                                                                      | Blog 与 Trace 共用 `layered-blur` 首图能力；应由 `verify:browser:lifecycle` 和人工滚动复核。                                                         |
| Astro/Pure 适配        | 当前固定 Astro 6.1.8 + astro-pure 1.4.6，而上游冻结在 Astro 5 + Pure 1.3.4。                                                                                                                                                                                                                                         | 已锁定的兼容性基线。适配不应改变未登记的视觉令牌或壳层行为。                                                                                         |

## 发布前复核

当前 release-prep 候选的截图仍只作为仓库外人工证据；提交后应在干净验证 worktree
重新采集，并同时完成 `bun run ci`、`bun run links:check:dry` 与
`bun run release:gate --strict`。只有截图复核、浏览器回归、严格发布门禁都通过，且用户明确授权发布，才可以开启 `main` 推送部署并修改 GitHub Pages 生产状态。
