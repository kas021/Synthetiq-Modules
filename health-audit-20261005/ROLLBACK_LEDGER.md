# Rollback Ledger — CimaClub first release (2026-10-05)

Owner instruction: *"ok publish ill test"* — publish the certified CimaClub candidate to all users for
testing. New module, so this is an **append** publish (not update-in-place): identity
`SP-VID-287-CIMACLUB` (#287) confirmed by that instruction.

## Pre-publish tag

- `pre-cimacub-publish-20261005` → `1a62e5b` (pushed to origin BEFORE any edits)

## Publish commits

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| CimaClub | (new) → 1.0.0 | `0a9fa69` | CimaClub-1.0.0.zip | 7981937c7c5ac953a9aa5623cea43241fd1d3a1de28a73c59995cddd4d3842a9 |

| Bundle | Version | Commit | File | SHA-256 |
|---|---|---|---|---|
| Synthetiq-Module-Bundle | 130 → 131 | `adfce9a` | bundles/Synthetiq-Module-Bundle-131.zip | 67f4b2e824c5c132537d010a196bfd948e1f8a692cc4b666c964e91c3de3de46 |

- Catalogue: 37 → **38 modules**, entry appended at the end of `modules[]`
  (`presentation.category = "Movies & TV"`, `recommended: false`, language "Arabic (subtitled)",
  icon `assets/module-icons/cimacub.png?v=20261005-1`).
- Bundle rebuilt from the 38-module catalogue and gated with the app's refresh-loop skip predicate
  (`verify_bundle_skip.py build 131`): zero writes ⇒ no "Repository import" crash for fresh installs.
- Superseded ZIPs kept: **none** (first release).

## Certification evidence (on the exact published bytes)

- Release gate, exact ZIP: **ALL_PASSED** — Package / Home / Search / Details PASS;
  Streams **2/2 segment-OK `probe=mp4_bytes`** (queries `one piece` [series, 2 eps] and `gayong`
  [movie, single-item path]), resolved via MixDrop mirror 1 in ~0.7–1.2 s.
- App-repo contract check on the same ZIP: OK; repo dry-run suites: 21/21 pass
  (`scripts/anikage_module.test.cjs`, `scripts/public_release_guard.test.mjs`).

## Post-publish verification (live)

- Signed index (`repository.json` via the API): entry `cimacub-v1` v1.0.0, `contentType: video`,
  sha256 == certified, non-empty `signature` (88 chars),
  `packageUrl` → `module-cimacub-v1-v1.0.0/CimaClub-1.0.0.zip`; index module count 38.
- Release asset downloaded and **byte-identical** to the certified ZIP (SHA-256 matched).
- Icon URL live: HTTP 200 `image/png` (300×300).
- Repo-phase gate re-run after raw.githubusercontent propagation (~4–5 min lag): expected `Repo: PASS`
  including bundle sha / contains / inner-ZIP-sha assertions.

## Module facts a rollback would drop

- Catalogue read from the source's own WordPress REST API (posts ARE episodes/movies).
- Playback: episode `/watch` page → MixDrop servers → Dean-Edwards packed block unpacked →
  `MDCore.wurl` signed mp4, returned per play with the embed page as `Referer` (links expire ~4 h,
  never cached). DoodStream mirrors (9 of the 18 servers per episode) sit behind a Cloudflare bot wall
  and are deliberately not offered. Subtitles on this source are burned into the video.

## Rollback recipes

1. **Unlist (preferred if it misbehaves):** delete the `modules/CimaClub-1.0.0.zip` entry from
   `catalogue.json` **and roll the bundle FORWARD** (`verify_bundle_skip.py build 132`, bump
   `bundleVersion`/`bundleFile`) → push. Code and ZIPs stay; fresh installs stop seeing it, existing
   installs keep working.
2. **Plain revert of the module commit alone** (`git revert 0a9fa69`) is safe only together with a
   bundle roll-forward; reverting `adfce9a` alone is **rejected** by `build_repository.mjs`
   ("Bundle version downgrade rejected").
3. **Emergency full revert to pre-publish state:**
   `git reset --hard pre-cimacub-publish-20261005 && git push --force-with-lease origin main`
   (last resort — the house route is roll-forward).
