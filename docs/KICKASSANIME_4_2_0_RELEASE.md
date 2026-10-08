# KickAssAnime 4.2.0 — release note (search, seasons, and home pass)

## Status

Certified upgrade of the live stable module (`kickassanime-v3`, SP-VID-038-KICKASSANIME) from
4.1.0 → 4.2.0. **Not published — waiting on the owner's decision.**

## 1. Search: plain-word queries now find what users type

The catalogue's search matches titles literally, punctuation included, and the module stopped at
the first variant that answered. Natural-query test (24 titles, same list, both builds):

- **Live 4.1.0: 22/24** — failures: `re zero`, `kaguya sama love is war`
- **Candidate 4.2.0: 24/24**

| query | 4.1.0 | 4.2.0 |
|---|---|---|
| `re zero` | **0** | 12 |
| `kaguya sama love is war` | **0** | 6 |
| `dr stone` | 8 | 9 |
| `fullmetal alchemist brotherhood` | 1 | 5 |
| `mushi shi` | 2 | 2 |

Fix: query variants are generated from the query itself (colon, dash, `". "`, `";"`, the combined
`T1-T2: rest` shape, colon-at-any-word-boundary incl. `"spy x family code: white"`, year-parens
for `"Hunter x Hunter (2011)"`, and a tail-tokens fallback for long queries), and results are
**merged** across variants (deduped by slug, early exit at 12) instead of stopping at the first
that answers.

Season-qualified / hard set (same 8 queries, both builds): **live 2/8 → candidate 8/8** —
`attack on titan final season` 0→3, `demon slayer kimetsu no yaiba` 0→3, `spy x family code white`
0→1, `dr stone new world` 0→2, `hunter x hunter 2011` 0→1, `dont toy with me miss nagatoro` 0→2.

## 2. Seasons ordered, not shuffled

Results group by series family and sort base → Part/Cour → Season 2 → 3 → … →
specials/OVAs/movies; unrelated results keep their rank; cards carry `year` + `type`. Measured
after: AoT `S1 2013 → S2 2017 → S3 2018 → S3P2 2019 → Final 2021 → P2 2022`; Mushoku
`S1 2021 → Part 2 → S2 2023 → S2P2 2024 → S3 2026`.

## 3. Home: 3 → 6 rows (in ~800 ms)

New rows parsed from sources the module wasn't using before:

- **Recently Added** (24) — the site's server-rendered `/recent` payload
- **Popular Shows** (18) — the site's server-rendered `/popular` payload
- **Coming Soon** (13) — `/api/schedule`, sorted soonest-first

The SSR payloads minify keys away and hoist repeated strings into the IIFE's argument list, so the
parser resolves `title_en:C`-style refs positionally (a..z = 0..25, A..Z = 26..51) and skips items
it cannot resolve rather than showing slugs. All rows fetch in ONE parallel fan-out
(Featured / Trending / Recently Added / Popular / Coming Soon / Browse) with family-level dedupe.

## Verification (final bytes, sha 4f31c3cd…)

- House tester: **PASS 32 / FAIL 0 / WARN 0** (One Piece 1198 eps, Bleach 366, Death Note 37)
- Release gate: **ALL_PASSED** — search `re zero` 12 (was 0), details, streams 2/2 segment-OK
- S2 quick (Flutter runtime harness): **grade PASS — READY_FOR_EXPLICIT_RELEASE_REVIEW**
  (Flutter runtime PASS, media decode PASS, zero failure codes)
- Search loop: 24/24 natural queries (repeat pass, no false negatives); hard set 8/8 (live 2/8);
  dub resolves labelled (`jujutsu kaisen` dub 3.1 s); dead title (Tomo-chan) fails honestly in 1.1 s
- Sample matrix: 8/8 queries + 3 deep chains with captions (up to 8 tracks)
- Home: 6 sections / 98 items / 711 ms, **0 duplicate hrefs, 0 items without images**
- Bytes stable across the entire battery (sha verified before/after)

## Known limits (source-side, unchanged)

One stream family (VidStreaming HLS; the site's other entry is DASH, deliberately not advertised).
Some titles are upstream-empty (the site's own API returns zero servers). `/recent` + `/popular`
are single pages (their feeds report `hasMore:false`).

## Artifact

`KickAssAnime-4.2.0.zip` — sha256 `4f31c3cd519a37ecf552e838f6d4e3b41fa72e8ab91f5489ff8c326b4bc8748f`
(rebuildable from `index.js` + `module.json` in `kickassanime-search-v42/`).

## 4. Module icon (owner request: "make sure the PFP is correctly shown")

The catalogue entry shipped with **no `iconUrl`** and there was **no icon file** in the repo, so
users saw a blank tile for KickAssAnime. Added `assets/module-icons/kickassanime.png` (192x192,
built from the source's own favicon — yellow circle, white crown, transparent corners) and the
entry's `iconUrl` (cache-busted `?v=20261008-1`). Verified live: the URL answers **200 ·
image/png · 192x192**, byte-identical to the committed blob.

Note for a later pass: `Drama-Direct-0.1.0-beta.9.zip` is the only remaining entry without an icon.
