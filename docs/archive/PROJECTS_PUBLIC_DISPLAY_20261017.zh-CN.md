# Projects 公开展示决定

记录日期：2026-10-17（Asia/Shanghai）。确认人：Susurrium。依据：本次对话中用户明确要求“按照下面的方案开发”，并提供五个项目的顺序、完整描述、标题目的地与入口清单。

## 展示内容与入口

用户授权在 Projects 公开新增 Susurrium Blog 和 OKF Workspace，并按下表展示全部五个项目。每行入口按列出顺序排列，首个入口同时作为标题目的地。

| 顺序 | 项目 | 描述 | 入口 |
| --- | --- | --- | --- |
| 1 | Susurrium Blog | 基于 Astro 构建的个人博客，用于长文写作、生活记录与引文收藏，提供全文搜索和媒体裁剪工作台。 | [访问博客](https://susurrium.github.io/home/) · [GitHub](https://github.com/Susurrium/susurrium.github.io) · [开发记录](https://susurrium.github.io/blog/susurrium-blog-development/) |
| 2 | OKF Workspace | 以 Obsidian 为中心的个人工作空间，管理资料、学习、任务与项目，并支持内嵌 Codex 会话。 | [GitHub](https://github.com/Susurrium/okf-workspace) · [下载与安装](https://github.com/Susurrium/okf-workspace/releases/latest) · [使用指南](https://github.com/Susurrium/okf-workspace/blob/main/docs/USER-GUIDE.md) |
| 3 | PkuHoleToolkit | 北大树洞的导出备份与关注迁移工具，可将帖子、评论和图片保存到本地，并从备份向新账号迁移关注。 | [GitHub](https://github.com/Susurrium/PkuHoleToolkit) · [安装与更新](https://github.com/Susurrium/PkuHoleToolkit/releases/latest) · [使用说明](https://github.com/Susurrium/PkuHoleToolkit/blob/main/README.md#安装与首次使用) |
| 4 | PkuHoleStudio | 北大树洞客户端，支持日常浏览、发帖互动和 24 小时热榜，并提供本地归档、全文搜索、标签笔记与可选 AI 研究。 | [GitHub](https://github.com/Susurrium/PkuHoleStudio) · [下载程序](https://github.com/Susurrium/PkuHoleStudio/releases/latest) · [使用说明](https://github.com/Susurrium/PkuHoleStudio/blob/main/README.md#安装与使用) |
| 5 | Signature Generator | 将静态签名图片制作成书写动画：手动标注笔顺与墨迹区域，调整速度和配色，导出黑色或渐变动态 SVG。 | [在线使用](https://susurrium.github.io/signature-generator/) · [GitHub](https://github.com/Susurrium/signature-generator) |

## 首次方案的实施范围

桌面按上述顺序使用两列，手机使用单列；底部入口显示图标与简短文字，允许换行并提供键盘焦点和可访问名称。Support 继续使用已有微信、支付宝二维码，授权调整为相同尺寸、接近当前大小的正方形展示框，完整显示图片并将遮罩相对整个框居中，验证中心偏差不超过 1px。

此次授权包含更新远端引用、核对生产基线、从最新 develop 创建 `codex/*` 分支、本地修改及必要验证；不包含修改其他项目仓库、提交、推送、合并或部署。页面引导语、Support 说明文字、Course notes、GPG 公钥、导航和页脚保持本次请求规定的范围。此前历史决定保留原始语境，见 [站长确认记录](./OWNER_CONFIRMATION_RECORD.zh-CN.md)。

## 后续展示确认（2026-10-17）

用户随后明确要求保持原有两行描述和纯图标入口，并在审阅完整范围与验证方案后要求“按照上面的方案开发完善”。本节确定当前展示要求；首次方案保留其原始语境。

- 五个项目的顺序、完整描述、标题目的地和全部入口 URL 继续使用上表内容。
- 标题最多显示一行，描述最多显示两行，完整文字保留在数据和 DOM 中；桌面描述区域保持原有 3rem 高度，手机不额外固定描述高度。
- 入口仅显示原有尺寸的图标与圆形背景，保持原有内边距和横向间距；入口标签用于可访问名称，保留明确键盘焦点，极窄空间允许换行。
- 保留 Support 正方形展示框、完整图片和遮罩居中布局，并完成相关交互回归。
- 沿用当前工作分支，以文件补丁修正组件、同步维护说明并验证新构建；提交、推送、合并、部署及其他项目仓库不在本次操作范围内。

## 项目描述确认（2026-10-17）

用户明确要求在常见电脑宽度下两行完整展示，并保留尽量详细的功能说明，随后确认“好的，按照上面这个修改”。当前项目描述采用下表；项目顺序、入口、布局与操作授权范围沿用已有确认。

| 项目 | 当前描述 |
| --- | --- |
| Susurrium Blog | 基于 Astro 的个人博客，用于写作、生活记录与引文收藏，提供全文搜索和媒体裁剪。 |
| OKF Workspace | 基于 Obsidian 的个人工作空间，管理资料、任务与项目，支持内嵌 Codex 会话。 |
| PkuHoleToolkit | 北大树洞备份与迁移工具，导出帖子、评论和图片，支持向新账号迁移关注。 |
| PkuHoleStudio | 北大树洞客户端，支持浏览发帖、24 小时热榜、本地归档、全文搜索与可选 AI 研究。 |
| Signature Generator | 将签名图片制作成书写动画，标注笔顺与墨迹，调整速度和配色，导出动态 SVG。 |

按当前页面默认字体和字号，以 1280–1920px 常见电脑宽度验证两行内完整展示；窄屏继续使用两行截断规则。

## 提交与推送授权（2026-10-17）

用户随后明确要求“提交推送”，授权将本次 Projects 与 Support 修改及对应文档提交，并推送至 `origin/codex/projects-support-layout`。合并与部署不在本次授权范围内。

## 正式部署与分支清理授权（2026-10-17）

用户随后明确要求“正式部署、清理分支”，授权按仓库流程创建并合并本次工作分支到 develop、develop 到 main 的 PR，检查与审阅通过后手动部署 main 的 GitHub Pages，并完成线上验证。发布后通过 main 到 develop 的 PR 同步生产基线；核对工作分支提交已进入目标分支、本地状态干净后，删除本次本地和远端工作分支。
