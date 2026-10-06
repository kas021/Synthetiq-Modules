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

---

# CimaClub 1.0.0 → 1.1.0 (2026-10-05, same day)

Owner report: an episode failed with "This source could not provide a working video link", and the home
screen was slow. Both investigated at the module boundary.

- Published: `modules/CimaClub-1.1.0.zip` replaces 1.0.0 in `catalogue.json` (same identity
  `SP-VID-287-CIMACLUB`, lineage untouched); `bundleVersion 133 → 134`.
- Commits: `c44b576` (module + catalogue), `9ae533d` (bundle 134); tag `pre-cimacub-1.1.0-20261005`.
- Certified bytes: sha256 `68a47a7dcc475c37427ca665409157bceb8903b55682e7aa2e41b2b59db252b3`; gate
  ALL_PASSED (Package/Home/Search/Details PASS, Streams 2/2 `mp4_bytes`).
- Changed: home rows load in parallel (8.4 s → 1.3 s measured); DoodStream (Cloudflare bot wall) and
  cybervynx (playlists carrying TikTok ad PNGs, verified segment-level) are no longer offered.
- Superseded ZIPs kept: `modules/CimaClub-1.0.0.zip` stays in place (rollback = catalogue edit).
- ROLLBACK: re-point the entry at `CimaClub-1.0.0.zip` and roll the bundle FORWARD (135); a plain
  revert of `9ae533d` alone is rejected by the bundle downgrade check.

## Coverage evidence for 1.1.0

8 titles × 4 sampled episodes (first/second/middle/last), 2026-10-05:

| show | episodes | sampled result |
|---|---|---|
| four hands two sonatas | 12 | ep1✗ ep2✗ ep7✓ ep12✓ |
| a love other than yours | 6 | ep1✓ ep2✓ ep4✓ ep6✓ |
| anna pigeon | 9 | ep1✗ ep2✗ ep5✗ ep9✓ |
| the ordinary jackpot | 8 | ep1✓ ep2✓ ep5✓ ep8✗ |
| one piece (window) | 2 | ep1✓ ep2✓ |
| gayong | 1 | ep1✓ |
| detective conan | 14 | ep1202✗ ep1203✗ ep1209✗ ep1215✓ |
| the batman | 1 | ep1✗ |

**14/24 sampled episodes resolve (58%).** A failing episode was verified by hand: all three MixDrop
mirrors deleted at the host (`/f/<ref>` → "File not found", no `wurl`), DoodStream bot-walled,
cybervynx ad-stuffed → no playable source exists for that episode.

---

# CimaClub 1.1.0 → 1.2.0 (2026-10-06) — episode coverage fix

Owner feedback: "some episodes aren't working" — the servers list is not enough.

**Root cause:** the module only read the `data-watch` server list. The site repeats its players in a
download section that can carry an **extra mirror the server list omits**. On the reported episode all
three listed MixDrop mirrors were deleted at the host, while the download-only ref
`mixdrop.top/f/1nvjog1nal8z1n` was alive and served real mp4 (`206 video/mp4`, `ftyp`).

**Change:** `watchServers` now harvests refs from the server list **and** every `/e/`, `/f/`, `/d/`
player link on the page, maps `/f/`+`/d/` to the `/e/` embed, and dedupes per family+ref so the same
file is not fetched twice. JavaScript only; identity unchanged.

- Certified bytes: sha256 `3ddee1d22400b00963d5085b92efd648f36e64128c8af0a9dffbea55b995de86`;
  gate ALL_PASSED — and the Streams phase now passes on `four hands two sonatas`, the show from the
  report.
- **Measured coverage: 14/24 → 21/24 sampled episodes (58% → 88%)** across 8 titles × 4 episodes:

| show | before | after |
|---|---|---|
| four hands two sonatas | ep1✗ ep2✗ ep7✓ ep12✓ | ep1✓ ep2✓ ep7✓ ep12✓ |
| a love other than yours | 4/4 | 4/4 |
| anna pigeon | ep1✗ ep2✗ ep5✗ ep9✓ | ep1✓ ep2✓ ep5✓ ep9✓ |
| the ordinary jackpot | ep1✓ ep2✓ ep5✓ ep8✗ | ep1✓ ep2✓ ep5✓ ep8✓ |
| detective conan | ep1202✗ ep1203✗ ep1209✗ ep1215✓ | ep1202✓ ep1203✗ ep1209✗ ep1215✓ |
| one piece / gayong | ✓ | ✓ |
| the batman | ✗ | ✗ (all mirrors dead at host) |

- Home/feed also measured: 5 sections in ~1.0 s, feed 50 items in ~0.8 s.
- Commits: `90f5acc` (module + catalogue), `5385b16` (bundle roll-forward); tag
  `pre-cimacub-1.2.0-20261005`.

## Bundle incident (worth remembering)

My first bundle build for this release reused number **135**, which commit `845a89a` (movie-candidate
batch, another agent) had already created. CI's immutable-package check rejected the push
("Immutable package was modified: bundles/…-135.zip"), correctly. Fix applied in `5385b16`: 135 restored
byte-for-byte from `845a89a` and the catalogue rolled forward to **136**. Lesson: check
`git log -- bundles/Synthetiq-Module-Bundle-<n>.zip` before choosing a bundle number — never assume the
next number is free in a shared repo.

- ROLLBACK: re-point the catalogue entry at `modules/CimaClub-1.1.0.zip` and roll the bundle FORWARD
  (137). 135 must never be rebuilt again.


