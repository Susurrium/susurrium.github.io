# Third-party asset notices

This file records assets that are not covered by the repository's Apache-2.0
code license. It is an audit aid, not a substitute for a final rights review.
Do not deploy an item marked `PENDING` until the owner has retained a license,
permission, or a replacement asset.

## Fonts

- `public/fonts/AbrilFatface-Regular.ttf` — accompanied by
  `public/fonts/AbrilFatface-OFL.txt` (SIL Open Font License 1.1). Keep the
  license text with the font when redistributing it.
- `public/fonts/Paralines-Regular.otf` — `PENDING`. The local font has no
  embedded copyright/license metadata. The author's Behance page identifies it
  as a free font and asks users to reference the owner; retain a copy of that
  page/permission or replace the font before public deployment:
  <https://www.behance.net/gallery/28060847/Paralines-Free-Font>.
- `public/fonts/Satoshi-Variable.ttf` and `Satoshi-VariableItalic.ttf` —
  inherited assets whose local license notice is not present in this
  repository. `PENDING` final license verification; this candidate does not
  claim that Apache-2.0 covers them.

## Images, video, and personal media

- `public/images/home-media/` (54 WebP), the entrance waterfall media, the
  tracer companion, current favicon/avatars, and the project QR images are
  owner-provided/currently selected assets. Their source and public
  redistribution scope must be confirmed by the owner before deployment;
  visible third-party characters, logos, watermarks, or payment identifiers
  are not implied to be licensed by this project.
- `public/media/residence/*` contains a historical visual module and a current
  owner marker image. The candidate deliberately exposes only city-level
  coordinates; the marker image remains `PENDING` for ownership and privacy
  review.

## External services and links

The candidate keeps explicit runtime exceptions documented in
`docs/SOURCE_LEDGER.md` (CARTO/OSM maps, Waline, public music, Umami,
CodeTime, and manually reviewed friend avatars). External links are content,
not a license grant. `public/links.json` is a manually reviewed snapshot and
must not be mutated automatically during deployment.
