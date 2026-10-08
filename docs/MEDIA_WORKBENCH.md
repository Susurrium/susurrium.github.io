# 媒体裁剪工作台使用指南

适用于调整归档卡片与 Home Hero 的显示区域，保存确认历史并应用到网站。公共图库更新见 [维护指南](./DEVELOPMENT.md#公共素材维护)，图片分配与组件契约见 [架构说明](./ARCHITECTURE.md#卡片与媒体)。

## 打开工作台

启动本地开发服务器，打开 `http://127.0.0.1:4321/tools/card-crop-review`，端口以终端输出为准。顶部可切换卡片裁剪与 Hero 定位。路由不加入导航和 sitemap；公开产物中存在该工具页面时，这些设置不构成访问控制。

## 调整卡片

1. 在左侧选择素材，可按文件、用途和状态筛选。Saying、Trace 复用同一文件时共享卡片记录，Hero 使用独立模式。
2. 切换“斜边在左／斜边在右”，两个框各自保存焦点与缩放。画布比例跟随下方正式卡片预览的真实媒体框。
3. 拖动图片，使用滚轮、滑杆或 `+/-` 缩放。画布聚焦时方向键移动 2%，Shift 加方向键移动 5%；`R` 重置，`Enter` 确认并前进。
4. “完整显示”使用 contain，适合需要保留完整构图的图片；默认 cover 会填满媒体框。源图片不被修改。
5. 使用“确认当前框”“两个框都可以”或“两个框都不合适”记录决定。“确认并处理下一张”跳至下一张待处理素材。
6. 检查桌面和手机的正式预览，再导出配置。“两个框都可以”可保存 preferred frame。

### 场景边界

| 场景                     | 当前约定                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- |
| Saying／Trace 归档       | 主基准；预览复用正式 MediaCard，在相同视口及非 hover 状态下核对                 |
| Home Recent／随机 Saying | 复用身份与裁剪决策，但紧凑卡片高度、54% 图片列和底部信息栏会改变可见区域        |
| 手机卡片                 | 使用同一份焦点和缩放，媒体框比例随布局改变；独立场景覆盖必须显式配置            |
| `cropRects` 与 `frame`   | 用于导出和审计，640×448 是参考坐标；实际显示由 fit、transform 和当前 frame 决定 |

不同宽高比会显示不同范围；检查 Home 或手机效果时使用对应页面与视口。极宽图片或分散主体可选 contain，或标记为不合适。缺少明确可用的生产记录时使用既定回退，不让图片消失。

## 调整 Hero

1. 切换“Hero 定位”，选择六张幻灯片中的一张。预览直接复用 HeroGallery／HeroMediaFrame，并按真实 Home 舞台等比缩小，包含 Logo、遮罩、波浪和安全区。
2. 分别调整桌面与手机的焦点和缩放。两个尺寸独立保存，舞台高度遵循 Home 的 `clamp(70vh/62vh)` 规则。
3. “静态构图”用于定位；“运行预览”显示当前单张图片的缩放动效，不模拟六张图之间的淡入淡出。
4. 点击“确认当前尺寸”。“复制到另一尺寸”只复制草稿，另一尺寸仍需检查确认。
5. 可“加载已应用配置”重新检查生产值；导出 `hero-crop-editor-v1.json` 后按下文应用。

## 保存状态与确认历史

| 状态       | 保存位置                                    | 对网站的影响                                   |
| ---------- | ------------------------------------------- | ---------------------------------------------- |
| 编辑草稿   | 浏览器 localStorage，按协议、主机、端口隔离 | 编辑过程中保存，不更新正式配置                 |
| 确认版本   | 随草稿及导出 JSON 保存                      | 每个素材、方向或 Hero 尺寸最多 20 份不可变记录 |
| 导出文件   | 手动下载的 JSON                             | 可跨浏览器恢复草稿与历史；下载本身不应用配置   |
| 已应用配置 | `src/data/*-crop-selections.generated.ts`   | 经应用脚本更新，重新构建或开发刷新后供网站读取 |

普通撤销／重做最多保留 60 个操作，不删除确认历史。确认后再修改焦点或缩放会变为待处理；“恢复最近确认”可恢复构图，并进入普通撤销记录。“查看确认历史”可载入旧草稿，或在二次确认后“恢复并确认”。

“取消全部确认”只清除确认标记，保留焦点、缩放、适配模式、方向草稿及历史。工具栏“清空草稿”会同时清除本地历史。重审素材优先使用前者，清空前导出备份。

卡片草稿键为 `susurrium:card-crop-editor:v2`，Hero 为 `susurrium:hero-crop-editor:v1`。旧版不含历史字段的卡片配置导入时会从当前已确认值建立初始版本。应用脚本只提取当前确认结果，确认历史不会写入正式配置。

### 本地文件保存

```powershell
New-Item -ItemType Directory -Force artifacts/media-workbench/exports, artifacts/media-workbench/previews
```

下载位置由浏览器决定。将导出 JSON 保存到 `exports/`，可按日期分批并保留原文件名；截图和临时验证产物放入 `previews/`。目录均被 Git 忽略，需长期保存的记录另行备份。根目录的误下载 `card-crop-editor-v*.json`、`hero-crop-editor-v*.json` 也被忽略，仍应移入上述本地目录。

## 应用卡片配置

在仓库根目录先预览差异，再应用：

```powershell
node scripts/apply-card-crops.mjs artifacts/media-workbench/exports/card-crop-editor-v2.json --dry-run
node scripts/apply-card-crops.mjs artifacts/media-workbench/exports/card-crop-editor-v2.json
```

等价入口为 `bun run card-crops:apply -- <JSON>`。默认合并局部导出，保留未包含的生产记录；`--replace` 才替换整表，有意清空还需 `--allow-empty`。dry-run 列出新增、修改和删除。

脚本检查文件名及 `public/images/home-media/` 的源图尺寸，为两个框计算标准化矩形，写入 `src/data/card-crop-selections.generated.ts`。未确认或标为不合适的条目会跳过并说明原因；已确认素材缺失、不合法输入或损坏生产表使整批操作失败，不写入正式配置。

当前卡片生产 schema 为 2，导出 profile 为 `archive-card`；旧版无 profile 仍按兼容规则验证。导出中的 `cardCropPolicy` 记录主场景与覆盖范围，`confirmationHistoryVersion: 1` 保存历史版本。定义见 [卡片裁剪类型](../src/lib/card-crop/types.ts)。

## 应用 Hero 配置

```powershell
node scripts/apply-hero-crops.mjs artifacts/media-workbench/exports/hero-crop-editor-v1.json --dry-run
node scripts/apply-hero-crops.mjs artifacts/media-workbench/exports/hero-crop-editor-v1.json
```

等价入口为 `bun run hero-crops:apply -- <JSON>`。只更新明确确认的桌面／手机尺寸，未确认尺寸保留生产值。脚本写 `src/data/hero-crop-selections.generated.ts`，不改源图或卡片配置；无已应用记录的尺寸使用居中 cover 回退。

新导出 profile 为 `home-hero`、schemaVersion 为 1。旧版无 profile 需要通过完整形状验证，缺少 `confirmed` 的历史格式按兼容规则视为已确认。Card 数据、错误版本或损坏批次会拒写；空批次的显式处理选项为 `--allow-empty`，应先核对 dry-run 输出。定义见 [Hero 类型](../src/lib/hero-crop/types.ts)。

## 检查结果

应用脚本以原子替换更新配置。检查 generated 文件差异，在相关归档、Home 与详情中核对图片身份、构图、桌面／手机表现，再随素材变更提交。生成文件通过脚本维护。

需要完整素材队列时，可运行 `bun run card-preview:generate`。脚本只补足缺少的 `card-preview-*` Saying／Trace，不覆盖已有正文；当前队列为 Saying 38 个槽位（34 张图）与 Trace 24 个槽位（20 张图），素材变化时以脚本输出为准。临时正文会进入真实构建，审阅后必须移出，即使命中 `.gitignore` 也不能留在正式构建树中。

## 异常与恢复

| 情况                           | 处理                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| 更换浏览器、端口或清除站点数据 | 导入已备份 JSON；仅有生产配置时可加载生产值，完整确认历史需原导出  |
| 确认后误拖动                   | 恢复最近确认，或从确认历史载入并重新确认                           |
| 全批需要重新审阅               | 取消全部确认，保留历史与草稿                                       |
| 导出后页面未变化               | 检查是否执行对应应用脚本、是否有明确确认项、生产预览是否重新构建   |
| 导入脚本拒绝文件               | 核对 profile、版本、源图和生产表；保留失败信息，修正后重新 dry-run |
| 同名源图已替换                 | 重新审阅对应构图与尺寸，不沿用未经复核的旧确认                     |
| Home 与归档显示范围不同        | 检查各自的真实尺寸与布局，遵守上述场景边界                         |

## 实现位置

页面为 [card-crop-review.astro](../src/pages/tools/card-crop-review.astro)，界面位于 [tools 组件](../src/components/tools/)，交互位于 [card-crop-editor.ts](../src/scripts/card-crop-editor.ts) 和 [hero-crop-editor.ts](../src/scripts/hero-crop-editor.ts)。应用入口为 [卡片脚本](../scripts/apply-card-crops.mjs) 与 [Hero 脚本](../scripts/apply-hero-crops.mjs)。
