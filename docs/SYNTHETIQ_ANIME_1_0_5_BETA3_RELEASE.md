# Synthetiq Anime 1.0.5-beta.3 — release note (search fix)

## What this fixes

Report: *searching a show name showed the show, but to reach its other seasons users had to
type the show name **with the season** ("Show Name Season 2"). Show name should return all
seasons and related entries.*

## Cause

The search asks AniList and AniList's `SEARCH_MATCH` ranking interleaves a series' seasons with
its movies, OVAs and specials. Measured on the live 1.0.5-beta.2:

- "my hero academia" → `[S1, FINAL SEASON, More, UA BATTLE HEROES, S4, Two Heroes, S2, S6, S7, S3, S5, …]`
  — **Season 2 was the 7th result and Season 3 the 10th**, so the first screenful on a phone
  showed no seasons at all and users concluded they had to search each season explicitly.
- "classroom of the elite" → `[S1, S3, 5th Season, S2, 4th Season]` — same misorder.

Every season was present in the data; the ordering hid them.

## Change

Season-aware ordering of search results (module-side, no extra network calls):

- Entries that are seasons/parts of the same series are grouped with their best-matching entry
  and sorted naturally: base show, Cour/Part, Season 2, Season 3, … and **then**
  movies/OVAs/specials. Unrelated results keep AniList's relevance order, so searching
  "naruto" still returns Naruto first.
- Result cards now carry the release year, so seasons are distinguishable at a glance.

Verified ordering after the fix:

| query | order |
|---|---|
| my hero academia | S1 (2016) → S2 → S3 → S4 → S5 → S6 → S7 → FINAL → extras |
| classroom of the elite | S1 (2017) → S2 (2022) → S3 (2024) → 4th → romaji 5th |
| spy x family | S1 → Cour 2 → S2 → S3 → movie |

## Verification

- House tester: **PASS 31 / FAIL 0 / WARN 0** (One Piece 1180 eps, Bleach 366, Death Note 37)
- Release gate: **ALL_PASSED** — search, details, streams 2/2 segment-OK
  ("my hero academia" 13 eps, "classroom of the elite" 12 eps)
- Relevance sanity after the change: "naruto" → Naruto first; "one piece" → ONE PIECE first
- ZIP: `Synthetiq-Anime-1.0.5-beta.3.zip` sha256
  `9f03899641ba3aab8f45eb069312ed9ead6a5d8b53dc01fb461d7a1064e4ebd7`

## Notes / limits

- Ordering only — the seasons were already in the results; no new entries are synthesised.
  If a series' season is genuinely absent from AniList's search response, this change does not
  invent it (not observed in testing; follow-up would be a relations query, at extra AniList cost).
- Streams/episodes/subtitles code paths are untouched (verified by diff: helpers + two call
  sites + card fields only).
