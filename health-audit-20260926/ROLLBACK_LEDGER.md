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
