# Arthals 视觉基线复核

本文件落实 [实施方案 §18.3](./IMPLEMENTATION_PLAN.zh-CN.md#183-arthals-视觉基线门禁)。目标不是把本博客退回为无差别的 Arthals 镜像，而是在既定、已授权的首版定制之外，持续守住 Arthals-Ink 的主题架构、排版语言和交互外壳。

## 对照产物

- 上游：`zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`。
- 当前：本仓库当前提交的静态 `dist` 或生产预览。
- 对照映射：上游 `/` 对当前 `/home`；其余 `/blog/`、文章详情、`/tags/`、`/archives/`、`/search/`、`/about/` 与 `/links/` 一一对应。

上游所用 Astro 5/Vite 在本机 Node 24 下会发生模块传输超时；这是上游工具链与当前运行时的兼容性问题，不是当前站点的构建错误。建立对照产物时使用隔离 Node 22：

```powershell
npx --yes node@22 node_modules/astro/astro.js build
```

上游若含仓库内 `packages/pure` 定制，还需先按其原有脚本设置 `BUN_LINK_PKG=true`，使其使用同一提交内的 Pure 包源码。该步骤只应在临时 detached worktree 中执行。

## 采集与复核

1. 将上游 `dist` 服务在 `http://127.0.0.1:4322`，将当前 `dist` 或 `astro preview` 服务在 `http://127.0.0.1:4321`。
2. 用 `--headless=new --remote-debugging-port=9224` 启动一个隔离 Chrome。
3. 在当前仓库运行 `bun run capture:visual-baseline`。
4. 打开 `artifacts/visual-baseline/manifest.json`，确认 9 个页面 × 4 个视口/主题 × 2 个站点 × 顶部/底部，共 **144** 张截图均已生成，且无意外运行时异常。
5. 成对检查同名的 `upstream-*` 与 `current-*` 图片。未在下表登记的字号、间距、颜色、圆角、壳层布局、Header/Footer 结构或交互变化均应作为回归处理。

截图是复核证据而非提交物，默认位于被忽略的 `artifacts/` 路径。这样最终替换个人内容、题图、视频和音乐时，不会让包含测试身份或上游素材的二进制文件进入 Git 历史。

## 已登记的首版差异

| 区域            | 当前实现                                                                                                                            | 允许原因与边界                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 根路径与首页    | `/` 是可重播的视频/逐字入口；实际 Home 位于 `/home`，采用 LargeSkull 六图、四层波浪、随机 Saying、并列 Blog/Trace、居住地和热力图。 | 用户锁定的信息架构与授权的 LargeSkull、xyx404、SkyWT、HanLife 效果。共享 Header、Footer、字体和 Pure 主题壳层仍应继承 Arthals 语言。 |
| 主导航          | `Blog / Traces / Projects / About / Links`，Logo 指向 `/home`。                                                                     | 用户锁定 Blog/Trace 双内容模型与入口语义；Saying 仅从 Home 卡片和 About 进入。                                                       |
| 内容集合与卡片  | Blog、Trace、Saying 三集合；Blog 默认无图卡，Trace 可有内容题图/无图回退，Saying 用 LargeSkull 装饰图。                             | 用户锁定的内容模型和卡片策略。卡片的文字层级、容器圆角、主题色与响应式壳层应保持 Pure/Arthals 风格。                                 |
| 全局/页面效果   | 除文章阅读页和 Links 外使用 PKU 三角/连线背景；Links 使用花瓣与空白点击粒子；About 有右侧小人；音乐跨路由单例。                     | 用户获得授权的参考组件。效果只能位于显式宿主内，不能遮挡内容、重复挂载或破坏 reduced-motion。                                        |
| About、Links    | About 增加 Saying 入口、居住地与右侧小人；Links 排在导航末位并使用花瓣。                                                            | 已确认的页面职责与效果排他规则。                                                                                                     |
| 外部服务        | Waline、统计、在线一言、Meting 和定时抓取均禁用；GitHub 卡片可在构建期回退。                                                        | 用户的部署与隐私边界。不能为视觉相似性重新引入它们。                                                                                 |
| Astro/Pure 适配 | 当前固定 Astro 6.1.8 + astro-pure 1.4.6，而上游冻结在 Astro 5 + Pure 1.3.4。                                                        | 已锁定的兼容性基线。适配不应改变未登记的视觉令牌或壳层行为。                                                                         |

## 发布前复核

最终个人资料替换后，重新运行一次该采集命令，并同时完成 `bun run ci` 与 `bun run release:gate`。只有截图复核、浏览器回归、严格发布门禁都通过，且用户明确授权发布，才可以开启 `main` 推送部署并修改 GitHub Pages 生产状态。
