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
