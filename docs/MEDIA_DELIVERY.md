# 图片交付与预算验证

文章封面和正文可以使用符合体积限制的 JPG、PNG、WebP 本地图片，由 Astro 构建处理。公共图库继续使用已准备好的静态 WebP，源图宽度不超过 1920px；图片与网站实际使用的配置一同维护。

## 响应式图片

更新 `public/images/home-media/` 中的图片或 `src/data/home-media.ts` 后执行：

```powershell
bun run generate:media-images
bun run verify:media-images
```

生成命令读取现有 WebP，为 Hero、卡片和 About 装饰人物生成响应式候选。Hero 使用 768、1280、1920px；卡片使用 480、960、1920px；装饰人物使用 240、480、960px。小图保持实际宽度，派生图质量参数为 86，源文件保留原始字节。

图片及其清单分别位于 `public/images/home-hero/`、`public/images/card-media/`、`public/media/effects/responsive/` 和 `src/data/*-images.json`。清单记录源哈希、尺寸、候选字节和哈希；只读核验检查实际格式、尺寸、比例、文件和引用。源码、配置、派生图与清单随素材更新一起提交。只更新 Hero 时可以使用 `bun run generate:hero-images`。

阅读页封面生成有界的多尺寸候选，前景和背投图共用文件与 `sizes`。卡片保留原始素材标识并按视口与裁剪缩放选图；裁剪工作台继续读取源文件，防止切换素材时使用上一张图片的候选。About 装饰人物仅在启用条件满足时加载，暂停时释放 `src` 和 `srcset`。

## 预算告警

```powershell
bun run check:assets
```

预算检查保留 JPEG/WebP 的 2 MiB、PNG 的 5 MiB 等硬限制和单文件 50 MiB 仓库上限。告警按用途区分：

- `delivery`：可发布资源及构建输出；
- `source`：文章和组件使用的源文件；
- `master`：图标母版和底图；
- `reference`：历史参考图夹具。

相同字节、相同阈值的告警归并展示，仍保留全部路径和用途。源图存储成本与实际浏览器下载量分别评估，告警数量不等于独立图片问题数。

六张历史 LargeSkull 参考图保存在 `test/fixtures/reference-images/largeskull/`。Phase 2 继续核验其原始 SHA-256，并确认它们不进入发布目录。

## 回归检查

`test/media-budget.test.ts` 覆盖预算边界、分类、归并和精确历史例外。`test/responsive-images.test.ts` 验证真实生成文件、源字节保留、透明度、比例、小图不放大及清单失效。`test/media-build.test.ts` 在隔离目录构建真实 JPEG、透明 PNG 的 Blog 和 Trace 页面，检查封面、正文、分享元数据和源文件保留。

使用项目固定的 Node/Bun 版本运行完整检查：

```powershell
node scripts/run-sequential.mjs ci
bun run release:gate
```

浏览器检查应核对实际 `currentSrc`、前景与背投复用、裁剪工作台切换素材，以及装饰人物的按需加载。导出的裁剪草稿保存在被忽略的 `artifacts/media-workbench/exports/`；预览和诊断资料使用同目录下的 `previews/`、`checks/`。
