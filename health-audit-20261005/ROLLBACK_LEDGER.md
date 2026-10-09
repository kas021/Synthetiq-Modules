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

---

# Shahiid 2.1.1 → 2.1.2 (2026-10-06) — episode coverage + graceful empty pages

Owner: "next focus on SHAHID Module". Three separate defects, all module-side.

**1. `extractEpisodes` threw on movie-shaped pages.** Some entries live under `/seasons/` but are a
single film or a bare landing page — an `<h1>` and a rating widget, no player (`data-post-id` is only
thumbs-rating), no iframe/video. The module threw "no episodes found", which surfaces as a broken
screen. Now logs and returns `[]`.

**2. Silent truncation at 500 episodes.** The paginator is a rolling window (page 1 links only to 2-4)
and the walk discovered pages one at a time, capped at 25 pages = 500 episodes. The season URL accepts
`?epp=N` directly — **verified to N=61**, One Piece carries ~1180 — so the module was hiding ~680
episodes. Walk is now direct-URL, in batches of 6, `MAX_PAGES` 62, `MAX_EPISODES` 1240, with a
**call-wide 12 s budget** so a slow connection returns a partial list instead of failing outright.
Declared `maxConcurrentRequests` 4 → 6 to match the batching (precedent: Miruro, Synthetiq-Movies).

**3. Search ranked a 1-episode special first.** For "one piece" the first card was
`/seasons/one-piece-heroines/` (حلقة خاصة, 1 episode). Specials/films/OVA reels are now demoted below
real seasons in the search sort.

## Measured (before → after)

| probe | 2.1.1 (live) | 2.1.2 |
|---|---|---|
| One Piece main series | 530 eps in 35.2 s | **860 eps in 13.3 s** |
| One Piece, unbounded walk | — | 1203 eps in 20.7 s (used to pick the budget) |
| Death Note | ok | 37 eps, 1→37, in 8.3 s |
| `naruto` movie-shaped page | threw | `[]`, no exception |
| last episode (1180) | — | 2 streams in 10.4 s |
| release gate | Details FAIL (`naruto` eps=0) | **ALL_PASSED**, Streams 3/3 (`naruto` now 288 eps) |
| house tester | PASS 28 / WARN 2 | PASS 28 / FAIL 0 / WARN 2 |

- Certified bytes: sha256 `242d17684dd2576d6407fa5e09304a0c53f8607f64b82a92996dc998f0971688`.

## Ceiling evidence (why the budget is 12 s)

An experimental variant that ranked the `/series/` aggregate above single seasons **timed out at
20000 ms** in the harness ("Episode integrity checks threw: Timed out after 20000ms") because the
aggregate walk enumerates several seasons. That is the runtime's per-call ceiling showing itself, so
the walk is explicitly budgeted below it rather than being allowed to run to completion.

- ROLLBACK: re-point the catalogue entry at `modules/Shahiid-2.1.1.zip` and roll the bundle FORWARD.

---

# Synthetiq Flux 1.0.3-beta.4 → 1.0.3-beta.5 (2026-10-06) — cold resolves never loaded

Owner report: "taking really long to load… it doesn't even load." Identity `SP-VID-077-ANIME-DIRECT`.

**Root cause (module budget, not dead content).** The play path gave the provider ONE resolve round,
capped at 10 s, inside an 11 s session budget. Measured against `vidhawk.buzz`: the first call for a
given title/episode/audio regularly needs **17.7 s / 19.9 s / 28.2 s**, and in the worst case never
answers at all (>40 s, 0 bytes), while the **next call for the same pair answers in 0.09-0.3 s**. So the
round was capped before the provider finished, the module gave up, and the user saw a long wait then
"no playable source".

**Fix.** Two resolve rounds (both servers `flow`+`zuri` in parallel, 9 s cap each) inside a 19 s budget;
the retry lands on the warmed provider, and the existing AniKage rescue — which runs in parallel — covers
the class that never answers. No catalogue/verification/labelling behaviour changed.

## Measured

| probe | result |
|---|---|
| resolve, cold pair (fresh episode) | 45 s+ no response, twice |
| same pair minutes later | **0.29 s** |
| cold pair B / C | 19.9 s → 0.088 s; 28.2 s → 0.13 s |
| `server=flow` | 0.09 s on one pair, >40 s no response on two others |
| `/api/stream/race` | 200 in 12.3 s once; 404 after 18.1 s on a fresh pair |
| `/api/play?t=` | 200 in 0.09 s, full tracks/captions/intro/outro |
| cold episode through the fixed module | **playable at 18.0 s** via labelled rescue (`AniKage · MegaPlay (koto)`), 5 subtitles |
| house tester | **MODULE PASSED, 0 WARN** |
| release gate | **ALL_PASSED** — one piece eps=1180, attack on titan eps=25, Streams 2/2 TS media |

- Certified bytes: sha256 `1fd232d5dcb9a65e823cbf2146294356a56f11a1a5fec6a53486a30a9a8c9f9c`.
- Backend hand-off: `docs/VIDHAWK_BACKEND_FIX_BRIEF.md` (the part a client cannot fix: cold-resolve
  stalls, `flow` per-request stalls, race 404). Applies to every Vidhawk-backed module, not just Flux.
- ROLLBACK: re-point the catalogue entry at `modules/Synthetiq-Flux-1.0.3-beta.4.zip` and roll the
  bundle FORWARD.

---

# Anime4up 1.0.0-beta.10 (2026-10-06) — community module, FIRST catalogue release

Owner: a community member's module ("v20") that worked for some episodes and failed for others;
asked to test it and publish it if it clears ~75-80% reliability.

**Root cause (one line of reading, catastrophic effect).** The module read every response through
`text()`. The app's `fetchv2` polyfill keeps JSON responses in memory and returns an **EMPTY `text()`**
for them — the parsed value is only exposed through `json()`. Share4Max (the top-ranked server family,
`share4max.com/iframe/<id>`) answers its mirror-list request with JSON, so **every Share4Max mirror list
was read as an empty body** and discarded; only the HTML-based hosts (mp4upload/voe/uqload) could ever
play, which is exactly the "some videos work, some don't" report. Fixed by backfilling from `json()` in
`requestText` and preferring the parsed payload in the Share4Max partial. (An earlier pass hardened the
payload parser for both shapes and bounded the Share4Max phase to 9 s; those changes are kept.)

## Evidence (all on the certified bytes)

- Live: 6 Share4Max shares harvested from archived episode pages, fetched from the live service and run
  through the module's own resolver — **0/6 before the fix, 6/6 after** (avg 4.4 s, max 21.7 s), routes
  from Share4Max-FHD plus mp4upload/voe on the mixed share.
- Offline: 20/20 parser checks; 2,000 real episode URLs (from the source's own sitemaps) accepted by the
  `extractStreamUrl` route; `A4EP` round-trip ok.
- Not verifiable from here: the anime4up site itself is Cloudflare-walled to every machine available
  (Mac/browser/VPS/reader service; only robots+sitemaps answer) — the catalogue path is unchanged from
  what the community member tested.

## Publish trail

- **beta.9 was rejected by CI**: `Duplicate identity number: video:100` (Synthetiq-One owns 100 in the
  video range 1-999). The module was re-cut as **beta.10 with `SP-VID-101-ANIME4UP` / number 101** —
  code bytes unchanged; note the pipeline enforces uniqueness per content type, so a new module MUST
  take a free number from the registry's ranges before packaging.
- New file (the pushed beta.9 ZIP is immutable): `modules/Anime4up-1.0.0-beta.10.zip`,
  sha256 `3a28b4175a7030105490930820720fde63f9a49fffe1013cbc51d33c74668a2c`.
- Tag `pre-anime4up-publish-20261006`. Commits: `9c0541e` (module+icon+catalogue, beta.9 - superseded),
  `eae4ba2` (beta.10 entry + ZIP), `eb4dacc` (bundle 140).
- Catalogue entry appended (first release): category `Anime`, purpose `Arabic Anime`,
  `recommended:false`, icon `assets/module-icons/anime4up.png` (fetched from the live domain, PNG magic
  verified, 50x50). App-repo registry entry added (`dev_assets/modules/module_registry.json`, number 101).
- Superseded ZIP kept: `modules/Anime4up-1.0.0-beta.9.zip` (never signed; unreferenced).
- ROLLBACK: unlist the Anime4up entry from `catalogue.json` (retire, never delete) and roll the bundle
  FORWARD; the module is new, so there is no older published version to restore.






---

# AniPM 0.1.0-beta.3 → 0.1.0-beta.4 (2026-10-07) — downloads keep audio, default route

Community reports: (a) episode "audio gets delayed at random times"; (b) "every module fails for
downloads except AniPM, but an AniPM download has no audio".

Cause (module-side): AniPM resolves up to two engines and listed the settlar ("AniPM") engine first.
The app's DEFAULT stream is also the stream its downloader fetches, the downloader reads only
`STREAM-INF` variants (never `EXT-X-MEDIA` audio renditions), and the settlar media host rejects the
app's non-NSURLSession clients — so a settlar-default download had no audio path at all. The same
route is the prime suspect for the reported A/V drift.

Change: default route order swapped — MegaPlay first (muxed), settlar second (still selectable as the
alternate server). Code bytes otherwise untouched.

## Evidence (on the certified bytes)

- MegaPlay route: single variant `CODECS="avc1.640028,mp4a.40.2"` (muxed); 321 segments over the full
  24.6-minute episode; real segment PTS tracks the manifest within ±0.02 s (no drift, no discontinuity).
- Route-order unit check (stub settlar present in a test build): `streams[0]` = `MegaPlay · Sub`.
- House tester: PASS 30 / FAIL 0 / WARN 0 (One Piece 1180, Bleach 366, Death Note 37).
- Release gate: ALL_PASSED (Home 6 sections/148 items; streams 2/2 segment-OK, `ts_media`).
- Download-worthiness sweep (same day, segment PIDs sniffed): AniKoto 5.0.5-b2, Synthetiq Anime
  Direct 1.0.3-b5 and Synthetiq Anime 1.0.5-b2 all hand out muxed nexabloom routes — the same CDN
  family AniPM's MegaPlay default uses. AnimeAV1's fMP4 route: video confirmed, audio unverified.
- Not verifiable from here: the settlar route itself (the site hard-blocks this network). If drift
  persists on the MegaPlay default, it is not this route.

## Publish trail

- ZIP: `modules/AniPM-0.1.0-beta.4.zip`, sha256
  `501ffce64440f18354246610d60883dc3d4c48a819cbc23a9186c0de2a28d126`.
- Tag `pre-anipm-beta4-20261007`. Commit `69d86ce` (ZIP + catalogue + bundle 141). CI run
  `37692762608` success.
- Post-publish verified: signed index v0.1.0-beta.4 sha == certified; release asset byte-identical;
  bundle 141 asset byte-identical (`25b780c4b9…`); raw index serving beta.4; the published `index.js`
  carries the fix (MegaPlay push precedes settlar).
- Superseded ZIP kept: `modules/AniPM-0.1.0-beta.3.zip`.
- ROLLBACK: point the catalogue entry back at `modules/AniPM-0.1.0-beta.3.zip` and roll the bundle
  FORWARD (142), or revert `69d86ce` alone — old release assets stay live.

---

# Synthetiq Anime 1.0.5-beta.2 → 1.0.5-beta.3 (2026-10-07) — season-aware search ordering

Owner report: searching a show name returned the show, but reaching its other seasons required
typing the show name WITH the season ("Show Name Season 2"); a show-name search should return all
seasons and related entries.

Cause (module-side, presentation): the seasons were present in AniList's results but its
`SEARCH_MATCH` ranking interleaved them with movies/OVAs/specials — e.g. "my hero academia" listed
S1, FINAL, More, BATTLE HEROES, S4, Two Heroes, S2(7th), S6, S7, S3(10th), S5 — so the first
screenful on a phone hid every season.

Change: client-side season-aware ordering — seasons/parts of the same series grouped with their
best-matching entry, sorted base → Cour/Part → Season 2 → Season 3 → … → movies/OVAs/specials;
unrelated results keep relevance order. Result cards now carry `year`. No extra network calls;
streams/episodes/subtitles paths untouched (diff = helpers + two call sites + card fields).

## Evidence (on the certified bytes)

- Post-fix ordering: my hero academia S1(2016)→S7→FINAL→extras; classroom S1(2017)→S2(2022)→
  S3(2024)→4th→5th; spy x family S1→Cour 2→S2→S3→movie.
- Relevance sanity: "naruto" → Naruto first; "one piece" → ONE PIECE first.
- House tester: PASS 31 / FAIL 0 / WARN 0. Release gate: ALL_PASSED (streams 2/2 segment-OK).

## Publish trail

- ZIP: `modules/Synthetiq-Anime-1.0.5-beta.3.zip`, sha256
  `9f03899641ba3aab8f45eb069312ed9ead6a5d8b53dc01fb461d7a1064e4ebd7`.
- Tag `pre-sanime-beta3-20261007`. Commit `38f371f` (ZIP + catalogue + bundle 142). CI run
  `37694604723` success.
- Post-publish verified: signed index v1.0.5-beta.3 sha == certified; release asset byte-identical;
  bundle 142 asset byte-identical (`a421caceab…`); fix present in the published `index.js`
  (`orderSeasons` at both call sites).
- Superseded ZIP kept: `modules/Synthetiq-Anime-1.0.5-beta.2.zip`.
- ROLLBACK: point the catalogue entry back at `modules/Synthetiq-Anime-1.0.5-beta.2.zip` and roll
  the bundle FORWARD (143), or revert `38f371f` alone — old release assets stay live.

---

# KickAssAnime 4.1.0 → 4.2.0 (2026-10-08) — search, seasons, home + module icon

Owner: "lets look into kiss ass anime and make it a top tier module", then "release ... make sure
the PFP for the module is correctly shown". Released live with bundle 143.

## Fixes (module-side)

1. **Search**: the catalogue matches titles literally and the module stopped at the first variant
   that answered. Added generated punctuation variants (colon at every word boundary, `. ` forms,
   year parentheses, tail-tokens fallback) + result merging. Natural 24-query list 22/24 → 24/24;
   season-qualified hard set 2/8 → 8/8.
2. **Seasons**: family-grouped ordering (base → Cour/Part → Season 2 → 3 → … → specials/OVAs/movies)
   + year/type on cards.
3. **Home**: 3 → 6 rows (Recently Added / Popular Shows parsed from the site's server-rendered
   payloads incl. IIFE arg-ref resolution; Coming Soon from `/api/schedule`); one parallel
   fan-out; 711 ms; 0 duplicate hrefs; 0 items without images.
4. **Icon**: the entry had NO `iconUrl` and no icon file (blank tile for users). Added
   `assets/module-icons/kickassanime.png` (192x192 from the source's own favicon, transparent
   corners) + the entry's iconUrl.

## Evidence (certified bytes)

- House tester PASS 32/0/0 · release gate ALL_PASSED · S2 quick **grade PASS**
  (READY_FOR_EXPLICIT_RELEASE_REVIEW).
- Byte-hash verified before/after every harness run; post-publish: release asset and bundle 143
  byte-identical; icon URL 200 / image/png / 192x192 / byte-identical to the committed blob.

## Publish trail

- ZIP: `modules/KickAssAnime-4.2.0.zip`, sha256
  `4f31c3cd519a37ecf552e838f6d4e3b41fa72e8ab91f5489ff8c326b4bc8748f`.
- Tag `pre-kaa-420-20261008`. Commit `3817f95` (ZIP + icon + catalogue + bundle 143). CI run
  `37853480723` success.
- Bundle 143 sha256 `886db553b6d2931bb27d43fe3d4d0c33f68be20b6b1c6a060acb1109c8851d70`.
- Superseded ZIP kept: `modules/KickAssAnime-4.1.0.zip`.
- ROLLBACK: point the entry back at `modules/KickAssAnime-4.1.0.zip` and roll the bundle FORWARD
  (144), or revert `3817f95` alone (the icon addition reverts with it).


# MovieDB 0.1.0-beta.12 → 0.1.0-beta.13 (2026-10-09) — play every format the source serves (direct MP4/TS)

## Issue (owner report)

"The source could not provide a working video link" on titles that play on moviedb.wiki;
reproduced on live beta.12 with The Mentalist S1E1 — stream resolve empty after ~15 s.

## Cause

The resolver required HLS (`#EXTM3U`) on every candidate route and discarded everything else.
VidLove/moviebox now serves many titles as direct MP4 (The Mentalist S1E1: 626 MB video/mp4,
1920x1080 H.264+AAC, Range honoured); every direct-file route was thrown away.

## Fix (module-side)

Range-first route fetch (never drags the file; over-cap drop can no longer eat the deadline);
non-playlist routes accepted when byte-verified (mp4 `ftyp|styp|moof` or TS `0x47` via 4 KB probe;
`video/*` content-type as the dropped-body fallback); same acceptance in the variant walk;
inline-manifest check rejects only HTML error pages; `probeSegment` byte-first (no
suffix/content-type-only rejections); `streamType` emitted per route (top-level + each servers[]).

## Evidence (certified bytes)

- Resolve battery 4 titles (The Mentalist / Gladiator / Friends / Breaking Bad): all RESOLVED
  540–6,813 ms, direct MP4; before: all empty.
- House tester PASS 30/0/1 WARN (Bleach count — identical on live beta.12; pre-existing).
- Release gate ALL_PASSED — 3/3 streams segment-verified (mp4_bytes), attempts=1.
- SHA stable across the whole battery.

## Publish trail

- ZIP: `modules/MovieDB-0.1.0-beta.13.zip`, sha256
  `109180c8c90c74011780d796cec733dc68fb256742ef630064ea1ef36467325c`.
- Tag `pre-moviedb-b13-20261009`. Commit `f3f842d` (ZIP + catalogue + bundle 144). CI run
  `37962544581` success. Served release asset byte-identical; fix present in shipped JS.
- Bundle 144 sha256 `dd900d979088d6773fe9bff7d26757933b7134c057b161d8762d0e097e513c88`.
- Superseded ZIP kept: `modules/MovieDB-0.1.0-beta.12.zip`.
- ROLLBACK: point the entry back at `modules/MovieDB-0.1.0-beta.12.zip` and roll the bundle
  FORWARD (145), or revert `f3f842d` alone.

# Alpha Movies 0.2.0-beta.2 → 0.2.0-beta.3 (2026-10-09) — embedded subtitles + poster/title fixes

Owner instruction: *"if it's working, I want to do send the update over to all users"* — publish the
certified 0.2.0-beta.3 candidate to production for all users.

## Pre-publish tag

- `pre-alphamovies-b03-20261009` (pushed to origin BEFORE any edits)

## Publish commits

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| Alpha Movies | 0.2.0-beta.2 → 0.2.0-beta.3 | `694c01d` | Alpha-Movies-0.2.0-beta.3.zip | 169a207b996f135ec2b5d2aa8d81ca5d32904454e75dc74b2c42cb7356580e7c |

| Bundle | Version | Commit | File | SHA-256 |
|---|---|---|---|---|
| Synthetiq-Module-Bundle | 144 → 145 | `56a2be5` | bundles/Synthetiq-Module-Bundle-145.zip | 70d3aac8d21c480dfdbd1104c669e02938ec9ac4e08caad915ad460021450907 |

Bot signed-index commit: `dc9690e`. CI run `37988975679` success.

## Certification evidence (on the exact published bytes)

- Suites 91/91 · release gate ALL_PASSED 3/3 first attempt (inception/breaking bad/severance) ·
  app-runtime ALL PASS on 8.5.33 AND 9.0.71+250 (Breaking Bad with 6 subtitles) · S2 quick: runtime
  PASS both runs, media decode PASS / 2-of-3 on the second (sample flake; same route class decoded in
  run A + both runtime legs) · house tester PASS 30 / FAIL 1 (documented extension-less-master
  artifact, production parity).

## Coverage evidence

- Matrix instant: HOME 3 sections / 32 items in 1.97 s; episodes 5/13 (38%) sampled.
- Hand-verified the two 0/4 titles on BOTH builds with the same refs — One Piece
  `alpha:tv:37854:1999:1` and The Batman `alpha:tv:2022:1:1`: beta.3 returns 2 accepted servers each;
  live beta.2 returns **0 candidates** ("The provider did not answer for this title"). Coverage
  strictly widens; the matrix percentage is an aggregator-mirror instant, not a regression.

## Post-publish verification (live)

- Signed index (API): alpha-movies `0.2.0-beta.3`, sha256 matches certified, signature present.
- Release asset `module-alpha-movies-v0.2.0-beta.3` downloaded: sha256 byte-identical; fix phrases
  present in the shipped JS (`caption payload trimmed…`, `embeddedSubRenditions`).
- Bundle 145: raw index sha == local build; raw catalogue + bundleVersion flipped on poll.
- Icon: raw URL 200 `image/png`, byte-identical to the committed blob.
- Superseded ZIP kept: `modules/Alpha-Movies-0.2.0-beta.2.zip`.

## Module facts a rollback would drop

Embedded in-manifest subtitles (English-first, 6–8 languages measured); Wikidata title identity
(unblocks title-keyed providers — One Piece/The Batman resolve only on this version); TVMaze poster
fallback; `MM:SS` caption-timestamp parser fix; 2 MiB bridge payload budget; scalar-free failure
snapshots.

## Rollback recipes

- Single revert: `git revert 694c01d` + rebuild the bundle FORWARD (146) in the same pass.
- Emergency: restore the beta.2 entry from tag `pre-alphamovies-b03-20261009` and roll the bundle
  forward — never a bundle downgrade.
