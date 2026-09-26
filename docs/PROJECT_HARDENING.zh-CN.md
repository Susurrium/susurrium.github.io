# 项目加固记录

实施开始：2026-09-08；首轮收尾验证：2026-09-12。工作分支：`codex/project-hardening`。下文保留首轮实施与验证结果；2026-09-26 的提交、复验及发布收尾另见 [发布候选记录](./RELEASE_20260926.zh-CN.md)。

## 实施范围

保留现有入口、首页轮播、卡片造型和装饰效果；修复数据一致性、浏览器生命周期、维护脚本、构建和发布检查。`packages/pure/` 继续作为历史参考，实际运行主题来自 npm 包。

| 检查项 | 已实施方案 |
| --- | --- |
| 已知依赖漏洞 | Astro 7.3.1、Pure 1.4.7、sharp 0.35.4、MDX 8.0.0；更新兼容范围依赖并冻结 Bun 锁文件。 |
| 地图运行时安全修复 | MapLibre 升至 6.4.1；同步更新本地 ESM 主模块、shared/worker 和 CSS，保留按需加载并锁定哈希。 |
| Pagefind 构建失败被吞掉 | 站点接管 Pagefind API；创建、扫描、写文件任一步失败都会使构建失败，finally 关闭服务。 |
| Hero 配置误导入覆盖 | 校验 profile/schema/完整批次；错误配置拒写；只合并明确确认的视口，原子替换配置。 |
| Card 局部配置覆盖整表 | 默认合并；`--replace` 才完整替换，清空须再指定 `--allow-empty`；dry-run 展示差异。 |
| 搜索 URL 筛选失效 | Pagefind 异步创建前恢复筛选；变更同步到 URL；加载失败可重试。 |
| 音乐订阅叠加 | 持久化播放器每个实例只绑定一次事件；重连保留状态；回归覆盖多次路由切换。 |
| 音乐首屏开销与故障 | 用户点击后才加载 APlayer CSS/JS/公共歌单；站点直接处理 Meting 数据；超时、重试和歌单链接反馈。 |
| Waline 页面释放 | 保存 init 实例并在断开连接时 destroy；浏览量目标按组件实例管理；修复正常取消 reaction 请求时误报 console.error。 |
| 地图取消与重开竞态 | 主地图可取消后重试；地球使用独立 CSS 引用和任务标识，旧任务不能清除新状态。 |
| 系统主题覆盖手选 | 自有主题控制器区分 light/dark/system；只有 system 跟随操作系统，存储不可用时可降级。 |
| 本地封面丢失 | 正确保留 Astro 图片元数据的路径、尺寸和格式；卡片、阅读页与社交元数据复用。 |
| Trace 图片跨页不一致 | 原始 cover 优先；归档集中分配备用图，Home、标签和详情复用同一条记录的映射。 |
| 标签列表顺序 | 先使用 registry 排序，再分页；不依赖原始集合读取顺序。 |
| 嵌套 ID 与特殊标签 | 内容链接按路径段编码；标签的显示文本、单段 slug、URL 编码分离；校验与分页/标签保留路径冲突。 |
| surface 策略未生效 | 导航、首页、归档、标签、搜索、RSS、阅读入口使用统一策略；关闭阅读会同步退出公开发现入口。 |
| RSS 与文章渲染不一致 | 复用 Astro/MDX 正文渲染，再清理交互控件/脚本；保留表格、提示块、数学语义，资源和内容链接转绝对地址。 |
| 许可名称与链接不符 | 共用 `src/data/content-license.ts` 的 CC BY-NC-SA 4.0 名称和链接。 |
| 日期脚本遗漏嵌套文章 | 递归查找 Markdown/MDX，以相对路径区分同名文件；YAML 解析、dry-run、CRLF 保留、失败整批拒写。 |
| 新建内容 YAML 损坏 | 站点自有命令创建 Blog/Trace/Saying；安全序列化标题/引号/多行文本，默认草稿，使用 language 字段。 |
| 无障碍 | 代码复制按钮有名称，等剪贴板成功再反馈；导航 landmark、跳转主要内容、地图可交互区域语义、卡片列表/标题语义。 |
| GitHub 热力图部分失败 | 缺失天数标记未知，不宣称零贡献；快照日期可见；超时覆盖响应正文。 |
| 发布资源扫描遗漏 | HTML/CSS 语法树提取资源，覆盖协议相对 URL、带引号 url()、srcset、CSS 变量和内联样式。 |
| 回归依赖示例文案 | 从 sitemap/真实详情发现文章、搜索词、有无目录；无内容分支明确记录，不往发布产物注入测试页。 |
| 内容扩展性能 | Catalog 维护 key 索引；每个详情仅传递当前和相邻条目；避免反复序列化全量文章和线性查找。 |
| 工作台小问题 | 修正内部锚点，清理 hash 监听，Hero 新导出带独立 profile。 |

## 工具链兼容性

Astro 7 默认 Markdown 处理器发生变化，本项目明确使用 `@astrojs/markdown-remark` 的 `unified()`，保留既有 remark/rehype/Shiki 插件与 HTML 空白压缩行为。升级依据见 [Astro 官方 v7 迁移说明](https://docs.astro.build/en/guides/upgrade-to/v7/)。

Pure 1.4.7 的内部依赖仍指向 Astro 6/MDX 5，因此在根包中统一覆盖为测试过的版本；`patches/astro-pure@1.4.7.patch` 保存两处兼容调整：

1. 将 PostPreview 的条件 class 写为三元表达式，避免新版原生编译器输出不合法的逻辑运算/null 合并表达式。
2. 将主题注入的 Markdown 插件合并到 unified processor，避免旧配置接口和重复管线。

主题 Pagefind hook 由站点配置移除，使用站点自己的集成替代。升级 Pure 时应审阅并重做补丁；不要直接删除补丁或恢复旧的索引子进程。`bun install --frozen-lockfile` 会重放补丁。

`patches/@waline%2Fclient@3.15.2.patch` 只调整上游实际入口 `dist/slim.js` 的 ArticleReaction watcher：组件卸载取消自身请求时处理 `AbortError`，其他错误仍然抛出。没有全局屏蔽日志或放宽浏览器错误门禁。回归测试执行已安装包中的组件，验证真实取消以及普通错误继续传播；原包测试失败，补丁后通过。升级 Waline 时须复核该补丁是否已被上游修复替代。

Node 运行 Astro 构建/检查，Bun 1.4.0 负责安装、脚本和单测。源码实际直接使用的解析器、UI、样式、类型和构建库已列为直接依赖。

9 月 12 日重新审计发现锁定的 MapLibre 5.24.0 命中 [GHSA-jrc7-96c5-q579](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579)。依照公告升级到修复版 6.4.1，同时更新浏览器实际加载的本地文件。新版发布形式为 ESM，使用极小的本地 module 入口桥接现有加载契约；原始发行模块未改写。

## 资源和发布流程

- Satoshi 正体：127,420 → 42,688 bytes；斜体：129,748 → 43,896 bytes。Abril：56,308 → 19,168 bytes；Paralines：11,544 → 9,184 bytes。原始字体保留，页面使用 WOFF2，只有常用正体预加载。
- 六张 Hero 使用 768/1280/1920 宽度候选；不放大小于候选宽度的原图。图片比例、焦点坐标和原始编辑键保持一致，首图 preload 与 img 使用同一 srcset/sizes。
- `bun run generate:hero-images` 根据图库重新生成候选及 `src/data/hero-images.json`；字体可通过 `scripts/generate-fonts.py` 重建。
- 资源预算增加 `src/content`，覆盖文章附件；增加单页 HTML、初始 JS/CSS gzip 预算。动态加载资源仍需浏览器验证。
- CI 的单测不再按多个重叠子集重复执行；浏览器任务下载静态验证通过的同一个 dist。
- 构建产物传递采用官方 [upload-artifact v7](https://github.com/actions/upload-artifact) / [download-artifact v8](https://github.com/actions/download-artifact)，下载摘要不匹配时失败。
- Pages 仍需手动触发，build/deploy 均限制 main。上传前对同一份产物执行严格发布检查和三项浏览器回归。
- 无 GPU 的 CI 使用 Chromium 官方 [SwiftShader 驱动模式](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)，明确启用软件渲染，避免依赖即将移除的自动 WebGL 回退。

## 验证结果

2026-09-12 最终验证结果：

| 检查 | 结果 |
| --- | --- |
| `bun install --frozen-lockfile` | 通过，Pure 与 Waline 补丁均可随安装重放。 |
| 完整 CI 序列 | `node scripts/run-sequential.mjs ci` 退出码 0；环境预检、ESLint、真实构建、Astro 检查、Phase 1–6、单元测试、资源检查全部通过。 |
| 构建与类型 | 生成 26 个静态页面；Astro 检查 201 个文件，0 errors / 0 warnings / 0 hints。空 Trace 和 docs 集合的提示符合当前内容基线。 |
| 单元与回归测试 | 19 个文件、130 项测试、563 个断言，0 失败；其中客户端专项 13 项、54 个断言。 |
| 严格发布门禁 | `bun run release:gate` 通过，0 失败、0 警告。 |
| 正式浏览器回归 | `verify:phase6:browser`、`verify:home-hero`、`verify:browser:lifecycle` 均 0 失败。Waline 补丁重建后再次通过生命周期验证；20 次跨页音乐订阅和 DOM 身份检查稳定，0 未捕获异常、0 console.error。 |
| 专项交互 | 资源失败重试与跨页保留、音乐按需加载与失败重试、剪贴板异步成功/失败、地图关闭途中加载完成与快速重开均通过；文章页面无障碍树中的可见按钮均有名称。 |
| 实际地图 | 本地 MapLibre 6.4.1 ESM 和 worker 可用；真实外部底图进入 ready，WebGL2 可用；采用 CI 同款 SwiftShader 参数的独立 Chrome 中也完成渲染。 |
| 内容扩展 | 临时 MDX 夹具验证了本地封面、嵌套路径、特殊标签、表格、数学、提示块、表达式与相对链接的实际构建；夹具已移除，最终构建只含正式内容。 |
| 页面复核 | 桌面首页、390px 移动端文章、Hero 工作台截图已检查，无横向溢出；文章仅一个 h1；工作台继续使用原图编辑，页面使用响应式候选。 |
| 依赖审计 | 最后一次 `bun audit --json` 返回 `{}`，即当日审计源未报告锁文件中的已知漏洞；不代表未来持续无漏洞。 |
| 资源预算 | 290 个产物文件，共 34.20 MiB；单页最大 HTML 0.15 MiB、本站初始 JS gzip 0.09 MiB、CSS gzip 0.03 MiB；0 硬失败。 |

资源检查保留 16 条建议体积告警，涉及 10 个不同源文件，其中 6 个 public 文件在 dist 中再次计数；包含原始媒体和文章 PNG。文章图片经 Astro 优化输出，Hero 使用新增响应式版本，未通过扩大豁免名单消除告警。上述初始脚本体积不含按需地图/音乐或远程资源。

音乐失败/重试及实例生命周期的独立浏览器专项使用受控 APlayer/API 夹具；它证明站点交互边界，不证明公共音乐服务持续可用。地图竞态也使用受控响应，另对实际地图运行时和外部底图做了独立检查。没有提交评论、改动第三方服务或运行远程 GitHub Actions。

Windows 本机的一次 `bun run ci` 在 esbuild 子进程输入管道写入时停滞；停止该次进程后，直接 Node 入口执行相同完整序列通过。上游根因尚未确认，Windows 的推荐命令已写入 README 和 DEVELOPMENT；Linux 工作流仍使用 `bun run ci`，需推送后实际验证。

## 维护注意

- Trace 备用图在一次构建的所有页面中一致。新增排在前面的 Trace 时，归档交替规则仍可能重新分配备用图；需要永久固定的文章应显式填写 cover。
- 内容的展示日期固定为 Asia/Shanghai。日期脚本不会在检查时自动执行；使用 dry-run 先看变化。
- 音乐、地图和评论继续依赖已配置的第三方服务；故障有降级/重试，不修改公共服务或线上配置。
- 原有超过建议体积的媒体仍保留。预算的建议告警与硬失败分别处理，未用新白名单隐去问题。
- 首轮（2026-09-12）未推送、未提交、未部署。GitHub Actions 的 Linux 作业需在推送后实际执行；本地验证不代表已运行远程工作流。
