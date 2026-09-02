# Third-party asset notices

This file records assets that are not covered by the repository's Apache-2.0
code license. It is an audit aid, not a substitute for retaining the underlying
license or permission evidence. The owner confirmation for the current
candidate is recorded in `docs/OWNER_CONFIRMATION_RECORD.zh-CN.md`; a future
asset marked `PENDING` must not be deployed until its rights are confirmed.

## Fonts

- `public/fonts/AbrilFatface-Regular.ttf` — accompanied by
  `public/fonts/AbrilFatface-OFL.txt` (SIL Open Font License 1.1). Keep the
  license text with the font when redistributing it.
- `public/fonts/Paralines-Regular.otf` — `OWNER_CONFIRMED` by the 2026-09-02
  owner worksheet. The local font has no embedded copyright/license metadata;
  the author's Behance page identifies it as a free font and asks users to
  reference the owner. Keep the page/permission evidence with the owner record
  when publishing:
  <https://www.behance.net/gallery/28060847/Paralines-Free-Font>.
- `public/fonts/Satoshi-Variable.ttf` and `Satoshi-VariableItalic.ttf` —
  inherited assets whose local license notice is not present in this
  repository. The owner worksheet's `FONT_RIGHTS: CONFIRMED` applies to the
  current candidate font range; retain the external license/permission evidence
  separately because Apache-2.0 does not cover these files.

## Images, video, and personal media

- `public/images/home-media/` (54 WebP), the entrance waterfall media, the
  tracer companion, current favicon/avatars, and the project QR images are
  owner-provided/currently selected assets. The owner confirmed the current
  candidate scope on 2026-09-02; visible third-party characters, logos,
  watermarks, or payment identifiers are not implied to be licensed by the
  project itself, so retain the owner's source/permission evidence.
- `public/media/residence/*` contains a historical visual module and a current
  owner marker image. The candidate deliberately exposes only city-level
  coordinates (`publicPrecision: 'city'`); the owner confirmed this precision
  and the current media scope on 2026-09-02.

## External services and links

The candidate keeps explicit runtime exceptions documented in
`docs/SOURCE_LEDGER.md` (CARTO/OSM maps, Waline, public music, Umami,
CodeTime, and manually reviewed friend avatars). External links are content,
not a license grant. `public/links.json` is a manually reviewed snapshot and
must not be mutated automatically during deployment.
