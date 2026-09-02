# Naming conventions

This project separates domain semantics, visual implementation, and source provenance.
The goal is to keep the application vocabulary independent from reference projects while
preserving enough provenance to audit locked assets and vendor runtimes.

## Three naming layers

### Domain layer

Names describe what the content is or what a page does:

- `ContentKind`: `blog`, `trace`, `saying`
- `ContentPresentation`: `text`, `media-content`, `media-decorative`
- `MediaCardData` and `MediaCardViewData`

Domain and shared content-layer code must not use a reference project's name as a type,
union member, policy value, or function prefix.

### Presentation layer

Names describe the stable visual responsibility:

- `TextCard` and `BlogTextCardAdapter`
- `MediaCard` for the diagonal media card
- `HeroGallery` for the Home hero slideshow
- `ContributionHeatmap`
- `ambientBackdrop`, `ambient-canvas`, `petalRuntime`, and `clickBurstRuntime`

CSS classes, custom properties, `data-*` attributes, and browser message names use the same
presentation vocabulary.

### Provenance layer

Source names remain where they are useful and truthful:

- `docs/SOURCE_LEDGER.md` source IDs, URLs, and historical references
- `/public/vendor/george` and `/public/vendor/pku` locked runtime paths
- locked asset filenames and their hash records
- explicit compatibility wrappers that are being kept for migration
- actual people, schools, projects, article content, and friend links

Provenance comments must say what is retained and why; they must not make the source name a
new application-level API.

## Canonical rename map

| Previous name | Canonical name |
| --- | --- |
| `arthals-text` | `text` |
| `large-skull-content` | `media-content` |
| `large-skull-decorative` | `media-decorative` |
| `LargeSkullCardData` | `MediaCardData` |
| `LargeSkullCardViewData` | `MediaCardViewData` |
| `toLargeSkullImage` | `resolveMediaImage` |
| `toLargeSkullCardData` | `toMediaCardData` |
| `LargeSkullCard` | `MediaCard` |
| `LargeSkullHero` | `HeroGallery` |
| `large-skull-card-*` | `media-card-*` |
| `large-skull-hero-*` | `hero-gallery-*` |
| `pkuBackdrop` | `ambientBackdrop` |
| effect kind `pku` | `ambient-canvas` |
| `skywt-user-route` | `residence-route` |
| `skywt-user-route-line` | `residence-route-line` |
| `githeatmap-*` | `contribution-heatmap-*` |

`ArthalsBlogCard` and `ArthalsTextCard` are migrated to `BlogTextCardAdapter` and
`TextCardCompat`. The old files may only remain as explicitly documented compatibility
wrappers; new code must not import them.

## Compatibility and migration rules

- Article slugs, routes, collection names, and content fields are not renamed as part of this
  refactor.
- If an old presentation value can occur in persisted JSON or browser storage, normalize it at
  the input boundary and emit only the canonical value. The implementation lives in
  `src/lib/compatibility/content-presentation.ts`; do not move its legacy map into the generic
  content-layer types or policy registry.
- Public asset URLs are retained when an external reference is plausible. A new filename may
  be added, but the old file is not deleted in the same change.
- Generated files are changed through their generator or regeneration command, never by hand.
- `legacy`, `source`, `PKU`, and `SkyWT` are not global search-and-replace targets. Each use is
  reviewed according to its meaning.

## Review rule

Before merging a naming change, search active code and classify every remaining old token. The
only accepted occurrences are provenance, vendor paths, locked asset records, documented
compatibility wrappers, or real content/entities. A visual class or runtime data attribute is
not considered provenance merely because it originated in a reference project.
