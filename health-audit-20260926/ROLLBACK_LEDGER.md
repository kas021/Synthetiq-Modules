# Rollback Ledger — CODE RED recovery publish (2026-09-26)

Owner report: all modules dark during the Vidhawk media-relay outage (`proxy.vidhawk.buzz` → 502
for every route; upstream `hls.1embed.buzz` → Cloudflare 403). Fix strategy: an independent,
labelled AniKage rescue chain in every Vidhawk-dependent module.

## Pre-publish tag

- `pre-code-red-20260926` → `2dbcd2a` (pushed to origin BEFORE any edits)

## Publish commits (one per module — single `git revert` rollback)

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| Anikoto | 5.0.2 → 5.0.4-beta.3 | `43e499b` | Anikoto-5.0.4-beta.3.zip | 620625d46079a66641b39413c21c058fc7c0d877ef9addd4a8b40043fb5a3a1f |
| Synthetiq Anime | 1.0.2 → 1.0.4 | `05e863e` | Synthetiq-Anime-1.0.4.zip | 2a02bfa9bca6310bcf5e512f0d3c143d717094d3c6b29494c07d9b9b307af0b5 |
| Synthetiq Flux | 1.0.1 → 1.0.2 | `cb6760b` | Synthetiq-Flux-1.0.2.zip | 40407a74706eba46aa04b48b2a53197c6c10f9f6fea11c39dcc97624d8ba6dc9 |

- CI: run `36246675631` — success. Bot commit: `5ee5b49` (signed catalogue).
- Post-publish verification: each release asset downloaded and SHA-256-matched byte-for-byte
  against the certified ZIPs; signed index entries carry non-empty `signature` values.

## Rollback recipes

1. Single module: `git revert <commit>` (43e499b / 05e863e / cb6760b) → push → CI republishes the
   signed index pointing back at the previous ZIP (old ZIPs stay in `modules/`, releases stay live).
2. All three (batch): `git revert cb6760b 05e863e 43e499b` → push.
3. Emergency full revert to pre-publish state: `git reset --hard pre-code-red-20260926 && git push --force-with-lease origin main`.
4. Testing catalogue counterpart: `kas021/Module-Testing-PL` commit `f2b22c6` (Anime 1.0.4 + Flux 1.0.2,
   bundle Testing-82); Anikoto beta.3 published there in `aa32034` (bundle Testing-79).

## Certification evidence (on the exact published bytes)

- House tester: PASSED (both new modules) — streams, captions, segment downloads, episode-integrity fixtures.
- Release gate: ALL_PASSED 3/3 titles (`ts_media`) for both modules; Anikoto beta.3 certified earlier.
- S2 quick app-runtime: stream + media decode OK, zero failure codes (Anime ~9.0 s, Flux ~1.7 s).
- Baseline contrasts: old versions fail identically-or-worse in the same windows (empty streams).

---

## Batch 2 — held-candidate promotion (2026-09-26, owner: "publish to all users now")

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| AnimeAV1 | 1.2.8 → 1.3.0-beta.3 | `dd7d6f8` | AnimeAV1-1.3.0-beta.3.zip | 570737ff97ca1bb29753162a4025c513e976f13bc57dabc05e044521cea68782 |
| One Pace | 3.0.5 → 3.0.6 | `038c312` | One-Pace-3.0.6.zip | 9e2199589ede6aa5aeb6ebfa6cfd29543ddb04e224695d331327b86a50f08b25 |

- Tag: `pre-av1-onepace-20260926` → `0565c90` (pushed before edits).
- CI run `36248318014` — success. Post-publish: both release assets downloaded and SHA-256-matched
  byte-for-byte; signed index entries carry signatures (minAppVersion 8.0.0).
- Rollback: `git revert 038c312 dd7d6f8` → push; or `git reset --hard pre-av1-onepace-20260926` (force).

### Excluded / unchanged

- **TVApp-Live 0.1.0-beta.7** — excluded per owner instruction ("leave live tv out"); it was never in the
  official catalogue and the live-TV experience needs app 9.0.0. Remains held at
  `~/Desktop/standalone-tvapp-live/dist/TVApp-Live-0.1.0-beta.7.zip`
  (SHA-256 `14f6484fc79f5277b401286dffcf12284cf797c4b77de2ed396d9c2963e7c6f6`).
- Testing-catalogue side (kas021/Module-Testing-PL): commit `b05c5fb` — AnimeAV1 beta.3 retired (file
  preserved); Anikoto / Synthetiq Anime / Synthetiq Flux candidates auto-retired to `_module_history/`
  (production superseded); index = 7 candidates, bundle `Testing-83`.

---

## Batch 3 — German-module fixes (2026-09-26, owner: "if everything is good and all edge cases are tested publish")

Immediate predecessor state: Anikoto 5.0.4-beta.4 + Aniworld 1.3.1 promoted minutes earlier in `a4e7a37`
(bot-signed `4a9ee9d`). This batch supersedes Aniworld 1.3.1 — it keeps the live build's behaviour
(including the `trending` discovery-feed alias) and adds the Filemoon server + the certified subtitle repair.

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| Aniworld | 1.3.1 → 1.3.2 | `9399ed3` | Aniworld-1.3.2.zip | 0a56360b7e14e121d48fca5ec749f540751fd56c85852557efc279bc50ffd3ff |
| MegaKino | 1.1.2 → 1.1.4 | `1af632b` | MegaKino-1.1.4.zip | 5a1770f0a9b5ba40dfe964121e0a46cfb3d5de2a27f75cdf2702f6723f88343d |

- Tag: `pre-german-fixes-20260926` → `4a9ee9d` (pushed before edits).
- CI run `36275385915` — success. Bot commit `060d9b5` (signed catalogue).
- Post-publish verification: signed index entries (version + sha256 + non-empty signature, minAppVersion
  8.0.0) AND both release assets downloaded (`module-aniworld-v1-v1.3.2`, `module-megakino-v1-v1.1.4`)
  and SHA-256-matched byte-for-byte against the certified ZIPs.
- Certification evidence: Aniworld 1.3.2 — S2 quick PASS (run `2026-09-26T22-05-02-902Z_s2_aniworld-v1_0a52a235`),
  gate ALL_PASSED (3/3 titles, first attempt), fixtures 8/8 (Filemoon 3 incl. both fail-closed cases +
  subtitle 5), FIPS-197 AES-256 vector + synthetic GCM round-trips + a live-captured payload decrypt,
  live probe = 4 servers per episode (Vidmoly DE/EN + Filemoon DE Subs/EN Subs). MegaKino 1.1.4 —
  S2 quick dub PASS (`2026-09-26T20-49-02-109Z_s2_megakino-v1_e8654777`), gate ALL_PASSED,
  search regression 4/4 vs 3/4 fail on the frozen 1.1.2 baseline.
- Rollback: single — `git revert 1af632b 9399ed3` → push (CI republishes the signed index pointing at
  1.3.1 / 1.1.2 — old ZIPs stay in `modules/`, releases stay live); emergency — `git reset --hard
  pre-german-fixes-20260926` + `git push --force-with-lease origin main`.
- Superseded ZIPs kept: Aniworld 1.3.1 (live since 22:01Z), Aniworld 1.3.0, MegaKino 1.1.2.

---

## Batch 4 — Trio playback repairs (2026-09-27, owner: "ok publish moduels to all users anyways")

Supersedes the newly published German batch's Anikoto generation (5.0.4-beta.4 → 5.0.5-beta.2) and the
live Flux 1.0.2 / Anime 1.0.4. Root change: rescue routes now survive the released app's probe byte-cap
(2 MB → 4 MB in-app hint), accept size-capped reachability as evidence, and prefer routes without
player-broken segment names (`brokenRefs === 0`). AniKoto deadline 3000 → 5000 ms.

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| Synthetiq Flux | 1.0.2 → 1.0.3-beta.4 | `ff46045` | Synthetiq-Flux-1.0.3-beta.4.zip | 0be9b5ff36ab62c77b5c4b902ac6aff8191dee2afcbd894c91cab14d847fc7bd |
| Synthetiq Anime | 1.0.4 → 1.0.5-beta.2 | `5cc9982` | Synthetiq-Anime-1.0.5-beta.2.zip | 9f2e60c3b0284c26da5ffc9222d01047ca154b64b9d9570104ea39c1a0687bb4 |
| Anikoto | 5.0.4-beta.4 → 5.0.5-beta.2 | `07faf4a` | Anikoto-5.0.5-beta.2.zip | 15e0637a91e856bf791a85ff04d26734d881e6164bf5ebe4d2273a9d6b73ad23 |

- Tag: `pre-trio-publish-20260927` (pushed before edits). CI run `36281645746` — success. Bot commit `d28874a`.
- Post-publish verification: signed index entries (new version + exact sha256 + non-empty signature) fetched via
  the repo contents API, AND all three release assets downloaded and SHA-256-matched byte-for-byte.
- Certification evidence: real Flutter app-runtime matrix 4/4 PASS on released 8.6 (`10613cc9`) — Flux sub 5.2 s,
  Anime sub 9.1 s, AniKoto sub 2.5 s + dub 2.6 s (resolution + playability + download probe). S2 quick: Flux PASS,
  Anime PASS, Anikoto PARTIAL with zero failure codes (quick profile). Node `--test` suites 21/21 in-repo.
- Known limitation (not module-fixable): mid-play freeze on iOS/iPadOS/macOS/Windows when proxied providers serve
  `.html`-disguised segment refs — released app `/segment.mp4` dispatch defect; app-side fix exists in the app
  worktree (commit `f94816f2`, owner lane, NOT shipped). Android unaffected.
- Rollback: `git revert 07faf4a 5cc9982 ff46045` → push (CI republishes the signed index pointing at the
  previous versions; old ZIPs stay in `modules/`); emergency — `git reset --hard pre-trio-publish-20260927`
  + `git push --force-with-lease origin main`.
- Superseded ZIPs kept: Flux 1.0.2, Anime 1.0.4, Anikoto 5.0.4-beta.4.

---

## Batch 5 — AniPM first public release (2026-09-27, owner: "publish for me to check now to all suers")

First publish of `anipm-v1` (ani.pm English anime engine — the AniKoto reliability alternative the owner
asked for). New module: nothing superseded; identity `SP-VID-084-ANIPM` provisioned per publish approval.

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| AniPM | (new) → 0.1.0-beta.2 | `3a6313e` | AniPM-0.1.0-beta.2.zip | a64f63ff8a932947e79b63f3eec4e36a844d25f83104a2007176471e1e83f8a0 |

- Tag: `pre-anipm-publish-20260927` (pushed before edits). CI run `36284353463` — success. Bot commit `b5533ec`.
- Post-publish verification: signed index entry fetched (moduleId `anipm-v1`, version `0.1.0-beta.2`, exact
  sha256, non-empty signature, `packageUrl` release asset), release asset downloaded and SHA-256-matched
  byte-for-byte, icon URL (`assets/module-icons/anipm.png?v=20260927-1`) live HTTP 200 `image/png`.
- Certification evidence (final bytes): unit suites 18/18; house tester 26/26 PASS; real app-runtime Sub+Dub
  legs ALL PASS on released 8.6 (playability 206, download probe walked playlist — 45,045 bytes,
  `hlsHasSegments:true`); S2 quick Grade PASS, failureCodes `[]` (run `2026-09-27T00-53-37-326Z_s2_anipm-v1_eb33bb43`).
  Report: `dev_assets/modules/_development/anipm-v1/HERMES-ANIPM-2026-09-27.md` (+ `~/Downloads` copy).
- Architecture: ani.pm-native API; dual engines — AniPM (settlar; iOS/iPadOS — Cloudflare client asymmetry
  detected and skipped elsewhere) + MegaPlay backup (all platforms; nexabloom media). Extensionless media
  URLs; per-track Referer headers on caption tracks.
- Known limitation (app-side, shared with Batch 4 trio): macOS/Windows mid-play proxy `.html`-ref defect
  (`f94816f2`, owner lane, NOT shipped). Android/iOS playback complete.
- Rollback: `git revert 3a6313e` → push (CI republishes the signed index without the module; ZIP stays in
  `modules/`); emergency — `git reset --hard pre-anipm-publish-20260927` + `git push --force-with-lease origin main`.
- Superseded ZIPs kept: none (first release).
- Update (same day, owner: "push the new module AniPM to recommended above Anikoto for now"): catalogue
  `presentation.recommended` flipped to `true` and the entry repositioned directly above Anikoto
  (`c13dde4`, CI `36284582964`, bot `be14021`). Presentation-only — same certified bytes (`a64f63ff…`).
  Rollback of this ordering change: `git revert c13dde4` → push.

## Batch 6 — AniPM 0.1.0-beta.3 defect fixes (2026-09-27, owner-approved: "Yes — publish AniPM 0.1.0-beta.3 to all users now")

Fix build for the two owner-reported defects on the live 0.1.0-beta.2 (no endless scroll on home; no
subtitles in any Sub or Dub mode). Module-side only; beta.2 history untouched.

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| AniPM | 0.1.0-beta.2 → 0.1.0-beta.3 | `49d7c15` | AniPM-0.1.0-beta.3.zip | 610acac3d6ce301623f462c4d5a90d9bce9cc81a2b8931fe1575c746fed25311 |

- Tag: `pre-anipm-b3-publish-20260927` (pushed before edits). CI run `36285666590` — success. Bot commit `27f0033`.
- Post-publish verification: signed index entry fetched (moduleId `anipm-v1`, version `0.1.0-beta.3`, exact
  sha256, non-empty signature, `packageUrl` release asset `module-anipm-v1-v0.1.0-beta.3`); release asset
  downloaded and SHA-256-matched byte-for-byte; catalogue position re-verified (AniPM index 4, directly
  above Anikoto index 5, `recommended:true` kept).
- Fixes: (1) `discovery_v1` capability — Featured hero + paginated rows + endless "All Anime" grid via
  `/api/anime/catalog` (8,955 titles / ~299 pages); legacy `search('')` home kept as fallback. (2) captions —
  settlar's `media.settlar.io` caption URLs 403 every non-NSURLSession client and outranked the reachable
  MegaPlay set; the reachable set (per-track Referer headers) is now preferred top-level and mirrored onto
  the settlar route.
- Certification evidence (final bytes): unit suites 20/20; house tester 30/30 PASS (incl. discovery legs);
  app-runtime Sub+Dub ALL PASS on released 8.6 (subtitles:1 live, playability 206, playlist walked); S2
  quick Grade PASS, failureCodes `[]` (run `2026-09-27T01-19-27-322Z_s2_anipm-v1_8660221b`).
- Rollback: `git revert 49d7c15` → push (index republishes pointing back at beta.2; both ZIPs remain in
  `modules/`); emergency — `git reset --hard pre-anipm-b3-publish-20260927` + `git push --force-with-lease origin main`.
- Superseded ZIPs kept: AniPM-0.1.0-beta.2.zip (still in `modules/`, never deleted).

## Batch 7 — AnimeAV1 1.3.0-beta.4 source-host rescue (2026-09-27, owner-approved: "Yes — publish AnimeAV1 1.3.0-beta.4 to all users now")

Owner report: "ok Anime AV1 why isnt it working rn". Live diagnosis: the site rotated its embed lineup to
UPNShare (animeav1.uns.bio) + Voe while beta.3 implemented only MP4Upload (correctly rejected as the
unplayable port-183 class) + the Vidhawk fallback — and the Vidhawk relay is in a 502 outage (fresh
tickets confirm: race/play 200, every proxy track 502). Every resolution ended
"AnimeAV1 SUB hosts could not provide verified media" (<1 s), reproduced on One Piece ep1 + ep351.

| Module | Old → New | Commit | ZIP | Certified SHA-256 |
|---|---|---|---|---|
| AnimeAV1 | 1.3.0-beta.3 → 1.3.0-beta.4 | `f9c824f` | AnimeAV1-1.3.0-beta.4.zip | 3b039a10a2952569bb879d6a18ca9f979ccdc53cbfecfe72dd3a2241b0fc6175 |

- Tag: `pre-av1-b4-publish-20260927` (pushed before edits). CI run `36357558443` — success. Bot commit `e9ba4b3`.
- Post-publish verification: signed index entry (version `1.3.0-beta.4`, exact sha256, non-empty signature,
  `packageUrl` release asset `module-animeav1-v1-v1.3.0-beta.4`); release asset downloaded and
  SHA-256-matched byte-for-byte.
- Fix contents: site hosts UPNShare + Voe added; independent AniKage (EchoVideo / MegaPlay) rescue starts
  concurrently with the site hosts; byte-first validation retained; dead relays skipped fast.
- Certification evidence (final bytes): house tester 31/31 PASS; release gate ALL_PASSED
  ("READY FOR OWNER DEVICE TEST", queries One Piece / Jujutsu Kaisen / Solo Leveling); S2 quick Grade PASS,
  failureCodes `[]` (run `2026-09-27T22-43-50-998Z_s2_animeav1-v1_fac172d5`); app-runtime SUB (One Piece)
  + DUB (Solo Leveling) all-pass incl. playability + download probe.
- Registry: AnimeAV1 was missing from `dev_assets/modules/module_registry.json` — added as entry #45
  (`SP-VID-060-ANIMEAV1`, family `animeav1_v1`) with the certified ZIP staged at
  `dev_assets/modules/AnimeAV1-1.3.0-beta.4.zip`.
- Rollback: `git revert f9c824f` → push (index republishes pointing back at beta.3; both ZIPs remain in
  `modules/`); emergency — `git reset --hard pre-av1-b4-publish-20260927` + `git push --force-with-lease origin main`.
- Superseded ZIPs kept: AnimeAV1-1.3.0-beta.3.zip (still in `modules/`, never deleted).

## Batch 8 — Mugiwara 1.1.0-beta.5: app-side playback fix + catalogue repair (2026-09-28, owner-approved: "ok fix and send to users")
- Published: Mugiwara-1.1.0-beta.5.zip — supersedes live 1.0.4 (zip kept in `modules/`). Certified SHA
  `be79e89310c221091d52c7cc7aaf15ba5aeda2a7b87a74fe9ea66d45901be857`; release asset byte-verified equal.
- Commit `fac5026` + signer bot `f58e203`; tag `pre-mugiwara-b5-publish-20260928`; CI run `36477750265` success.
- Cause (proven in the app runtime): Sibnet's 302 Location is protocol-relative (`//dv97…`); live 1.0.4 accepted
  only `https://` (the tester's node-fetch normalizes it to absolute, masking the defect) so the app received the
  UNRESOLVED router URL and the reachability leg timed out (`TimeoutException`, Monster ep1). beta.5 accepts both
  forms, resolves against the base URL, and byte-verifies each route before returning it.
- Also in beta.5: One Piece 61 → 1,220 episodes; `imageHeaders` (poster-403 class); Special A seasons; film
  aliases; full-catalogue home feed (1,234 titles).
- Certification: house PASS; release gate ALL_PASSED (live 1.0.4 FAILS the same gate — special-a 0 eps, One Piece
  61, dandadan 12); module regressions 16/16; app-runtime Sub+Dub ALL PASS; S2 standard GRADE PASS zero failure
  codes (run `2026-09-28T20-05-14-324Z_s2_mugiwara-v1_f7224a96`; simulator video advanced, audio-device caveat).
- Registry: `dev_assets/modules/module_registry.json` mugiwara-v1 → `1.1.0-beta.5` (was stale at 1.0.0).
- Rollback: `git revert fac5026` → push (index republishes to 1.0.4; both ZIPs remain in `modules/`); emergency —
  `git reset --hard pre-mugiwara-b5-publish-20260928` + `git push --force-with-lease origin main`.
- Known open (owner reports, NOT fixed by beta.5 — app-lifecycle class): duplicate playback after background/resume;
  frozen frame after language-switch resume.
