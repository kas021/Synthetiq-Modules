# WeebCentral 4.1.10 Release Report

Date: 2026-08-15

## User-visible symptoms

- Some Player builds showed an indefinite chapter-loading state or an empty chapter list.
- Earlier module revisions used `String.matchAll`, which is not consistently
  available in the app's `flutter_js` JavaScript runtime.
- The popularity feed could surface legacy titles whose current WeebCentral
  series pages no longer contain chapters.
- Series using `Act` labels sorted lexically (`Act 1`, `Act 10`, `Act 100`)
  because only `Chapter`, `Chap`, and `Ch` labels were assigned numeric values.

## Root causes

The incident had separate layers that must not be conflated:

1. The module parser had a JavaScript-runtime compatibility defect around
   `matchAll` in older revisions.
2. WeebCentral's catalogue includes titles that still have metadata and cover
   art but no current chapter list.
3. The chapter parser treated `Act` labels as unnumbered text, so the fallback
   title comparison produced lexical rather than numeric ordering.
4. A separate Player reader/UI regression temporarily affected chapter opening.
   That app-side issue is not part of this module package.

## Module changes

- Preserved the existing module lineage:
  - `id`: `weebcentral-v2`
  - `moduleFamilyId`: `weebcentral-v2`
  - `moduleIdentity`: `SP-IMG-1004-WEEBCENTRAL`
  - `moduleIdentityNumber`: `1004`
- Uses `RegExp.exec` loops compatible with the app's JavaScript runtime.
- Resolves exact series IDs and the complete `/full-chapter-list` endpoint.
- Keeps Home sections on the latest-updates catalogue to reduce stale,
  chapterless entries while retaining explicit Popular and Latest feeds.
- Recognizes `Act` as a numbered chapter label and preserves the label in the
  UI while sorting by its numeric value.
- Preserves decimal numbering such as `Act 210.8`.
- Continues to return stable chapter URLs and direct page-image URLs.

## Verification evidence

### Physical iPhone feedback on 4.1.9

- Chainsaw Man displayed all 232 chapters in order.
- One Piece displayed its complete list and opened a chapter immediately.
- Nura: Rise of the Yokai Clan exposed the remaining `Act` ordering defect.

### 4.1.10 automated and runtime verification

- Fast app-like module test: 28 passed, 0 failed.
- Nura: 217 chapters; `Act 210.8` through `Act 1` received numeric values and
  sorted correctly; 28 page images were returned and the sampled PNG loaded.
- Chainsaw Man: 232 chapters; 30 page images; sampled PNG loaded.
- One Piece: 1,190 chapters; 17 page images; sampled PNG loaded.
- All three titles passed through the real Flutter `ImageClientRuntime`, not
  only a Node fixture.

## Compatibility and rollout

- This is an in-place patch update from the existing `weebcentral-v2` lineage.
- Existing saved titles and repository bindings retain the same stable module
  identity.
- The old 4.0.2 ZIP and Bundle 89 remain immutable for rollback.
- Bundle 90 is rebuilt from the current catalogue so fresh repository imports
  receive the current module versions rather than the stale Bundle 89 copies.
- Synthetiq Manga and Atsu are not changed by this release and require separate
  source-specific verification.

## Package

- File: `modules/WeebCentral-4.1.10.zip`
- SHA-256: `b946d2982f105b6cbd4d310efcc2a7e09f3a65089c737b4ed5e4458dc095215a`
- Bundle: `bundles/Synthetiq-Module-Bundle-90.zip`
- Bundle SHA-256: `ba416fc0b68e34c87d424d6e741a044d16a34e410e70eeb5e33af8378aef5142`
