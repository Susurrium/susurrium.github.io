# 参考实现与维护历史摘录

整理日期：2026-10-08。各节保留原事件的日期、来源与结果；未注明日期的历史改名仅作为迁移对照。现行操作见 [开发指南](../DEVELOPMENT.md)，实现契约见 [架构说明](../ARCHITECTURE.md)。

## 历史命名对照

来源为原命名规范中的历史改名表。仍支持的输入兼容由当前架构及代码维护。

| 旧名                     | 正式名称                 |
| ------------------------ | ------------------------ |
| `arthals-text`           | `text`                   |
| `large-skull-content`    | `media-content`          |
| `large-skull-decorative` | `media-decorative`       |
| `LargeSkullCardData`     | `MediaCardData`          |
| `LargeSkullCardViewData` | `MediaCardViewData`      |
| `toLargeSkullImage`      | `resolveMediaImage`      |
| `toLargeSkullCardData`   | `toMediaCardData`        |
| `LargeSkullCard`         | `MediaCard`              |
| `LargeSkullHero`         | `HeroGallery`            |
| `large-skull-card-*`     | `media-card-*`           |
| `large-skull-hero-*`     | `hero-gallery-*`         |
| `pkuBackdrop`            | `ambientBackdrop`        |
| effect kind `pku`        | `ambient-canvas`         |
| `skywt-user-route`       | `residence-route`        |
| `skywt-user-route-line`  | `residence-route-line`   |
| `githeatmap-*`           | `contribution-heatmap-*` |
| `ArthalsBlogCard`        | `BlogTextCardAdapter`    |
| `ArthalsTextCard`        | `TextCardCompat`         |

## 2026-08 素材审阅与初版分配

2026-08-30 台账登记了 54 张用户图库：Hero 6 张，Saying 装饰图 34 张，Trace 备用图 20 张，后两组并集覆盖原始素材。初版文字曾以 Trace ID 稳定哈希描述备用图选择；该记录仅保留初版语义，当前分配以完整归档映射为准。

素材斜边按文件名记录，历史桌面／手机预览位于 `artifacts/home-media-card-previews/09`–`12`。2026-08-31 引入焦点、缩放及 cover/contain 审阅，以处理主体在填充过程中被裁切的问题。斜边来源清单留在 [来源台账](../SOURCE_LEDGER.md#612-历史素材斜边参考)，现行操作见 [工作台](../MEDIA_WORKBENCH.md)。

## 2026-09-02 视觉采集

原记录位于 `E:\code\blog-susurrium-visual-baseline-final-20260902-1620`。manifest 报告 `expectedCaptures=112`、`captures=56`；PNG 文件 112 张，运行时异常 0。

当次代表性人工复核覆盖 Home、About、Links 的桌面／移动明色状态，记录了 Header、主内容、About 删除线、卡片、移动折行与 Links 花瓣的实际渲染。manifest 的 11 条 browser resource error 均出现在 Links，原记录归因于 `www.george-blog.top` 的过期 TLS／连接关闭，与当次友链检查一致。上述范围和错误保留为历史证据，其他页面、主题及未来发布需另行验证。

对照上游为 `zhuozhiyongde/Arthals-Ink@15f5ad110af8ed8f38a1e506dd890d2d921f118f`。当次记录采用七个共享页面、四种视口/主题、两个站点、顶部/底部截图；详情扩展最多九页、144 张。截图保存在本地或仓库外证据目录，未作为网站正文提交。

## 2026-09 历史状态审计调用

原脚本说明中的来源路径及调用形式如下，输出目录必须为新目录：

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

未分类计数校验示例：

```powershell
$run = Get-Content E:\code\branch-state-audit-<timestamp>\run.json | ConvertFrom-Json
if ($run.counts.unclassifiedPathDecisions -ne 0 -or
    $run.counts.unclassifiedRuntimeCandidates -ne 0) {
  throw 'path classifier has unclassified candidates; review path-decisions.csv'
}
```

完整历史路径与内容决定见 [对账报告](./BRANCH_STATE_RECONCILIATION.zh-CN.md) 和 [站长确认记录](./OWNER_CONFIRMATION_RECORD.zh-CN.md)。未变化路径在 path-diffs 中默认省略但保留计数；分类版本 1 不为 UNCHANGED 路径创建恢复决策。具体当前接口见开发指南的低频工具章节。

## 首版实施进展记录

以下内容来自来源台账的首版进展部分，完整模块来源继续由稳定来源 ID 定位：

- `BASE-ARTHALS` Fork、远端与冻结标签，`BASE-PURE`／`BASE-ASTRO` 依赖和锁文件，`BASE-SIGNATURE` 本地组件，`BASE-PAGES` CI 与手动部署已建立。
- 历史只读快照与外部来源的版本、URL、视觉校准边界已登记。
- Phase 1：三类内容模型、路由、六项导航与测试内容。
- Phase 2：LargeSkull 锁定图、Hero／波浪、卡片策略、随机 Saying、双栏与 Blog Timeline；About 的 Saying 入口随本阶段加入。
- Phase 3：可重复根入口、本地视频与 Typed.js、音乐持久壳与详情紧凑模式、二维码及图片放大生命周期；记录了生产构建、三套静态契约、Chrome 点击与同源网络扫描。
- Phase 4：PKU 三层、George 点击与花瓣、原始 vendor 本地化和统一宿主；记录了 SHA、产物、策略、桌面／移动／减少动画／多路由及同源网络核验。
- Phase 5：SkyWT 本地素材与 MapLibre、Globe/定位/回退，HanLife 53 周公开贡献解析与六小时缓存、中性骨架，以及 About 专属 TNXG 素材和生命周期；静态 SHA 与纯函数回归已记录，浏览器结果随阶段提交保存。
- Phase 6：本地 Footer 适配、noindex/sitemap/RSS 修复、产物审计、严格发布检查与移动目录回归。

个人位置、头像、文案和 93 个历史内容不恢复的决定见原始 owner 记录。之后的加固、复验与发布候选分别见 [项目加固](./PROJECT_HARDENING.zh-CN.md) 和 [发布候选](./RELEASE_20260926.zh-CN.md)。

## 2026-10-06 图标迁移核验

源文件从 `E:\code\release-prep-quarantine-20260902-021422\.tmp-favicon-c-preview` 原样迁入。母版原名为 `outline-edge-brown-union-conservative.png`，底图为 `feet-restored-v3.png`；路径、尺寸和 SHA-256 保留于 [图标来源](../SOURCE_LEDGER.md#图标制作源文件)。

当次记录保留了母版、底图和全部正式图标的原始字节。sharp 重建 PNG 的编码与旧文件存在字节差异，但母版、五张 PNG 和 ICO 三帧的解码 RGBA 像素均相同。当次检查分别报告了字节一致与像素一致的结果。
