# Shahiid 2.1.2 — release notes

Owner-approved release. Module-side change only; identity `SP-VID-055-SHAHIID`, contract 4, Arabic
sub/dub isolation and the player chain are unchanged.

Certified bytes: `242d17684dd2576d6407fa5e09304a0c53f8607f64b82a92996dc998f0971688`
(`modules/Shahiid-2.1.2.zip`). Bundle 137.

## What was wrong in 2.1.1

1. **`extractEpisodes` threw on film/landing pages.** Some entries live under `/seasons/` but are a
   single film or a bare landing page — an `<h1>` and a rating widget, no player, no episode list.
   The module raised "no episodes found", which surfaces as a broken screen. Reproduced on
   `naruto-shippuuden-movie-1`, which the release gate failed on (Details FAIL, eps=0).
2. **Silent truncation at 500 episodes.** The season paginator is a rolling window (page 1 links only
   to pages 2-4), so pages were discovered one at a time and the walk stopped at 25 pages x 20 = 500.
   The season URL accepts `?epp=N` directly — verified to N=61, which puts One Piece at ~1180 episodes
   upstream. Roughly 680 episodes were unreachable, and even the partial list took 35 s to build.
3. **Search surfaced a one-episode special first.** For "one piece" the first card was
   `One Piece: Heroines` (a single special) rather than the show.

## What changed

- Episode-less pages return `[]` with a log line instead of throwing.
- Episode pages are walked directly (`?epp=N`), six at a time, `MAX_PAGES` 62, `MAX_EPISODES` 1240,
  bounded by a **call-wide 12 s budget** shared by the season walk and the multi-season loop. Declared
  `maxConcurrentRequests` 4 -> 6 to match the batching (precedent: Miruro, Synthetiq-Movies).
- Search demotes single specials, films and OVA reels below real seasons.

## Verified

| probe | 2.1.1 | 2.1.2 |
|---|---|---|
| One Piece main series | 530 eps in 35.2 s | **860 eps in 13.3 s** |
| One Piece, unbounded walk | — | 1203 eps in 20.7 s |
| Death Note | ok | 37 eps, 1 -> 37, 8.3 s |
| `naruto` film-shaped page | threw | `[]`, no exception |
| episode 1180 | — | 2 streams in 10.4 s |
| release gate | Details FAIL | **ALL_PASSED** (Streams 3/3; `naruto` 0 -> 288 eps) |
| house tester | PASS 28 / WARN 2 | **PASS 28 / FAIL 0** / WARN 2 |

The two remaining tester WARNs compare the card the harness picks against Wikipedia totals
(One Piece 29 vs 1156, Bleach 8 vs 366); they are harness expectations about which card is sampled, not
module failures. The source itself carries ~1180 One Piece episodes, verified directly.

## Why the budget is 12 s

An experimental variant that ranked the `/series/` aggregate above single seasons **timed out at
20000 ms** in the harness, which is the runtime's per-call ceiling showing itself. The walk is
therefore budgeted below it: on a fast connection a long series returns most of its list, on a slow one
it returns a partial list rather than failing the whole call.

## Rollback

Re-point the catalogue entry at `modules/Shahiid-2.1.1.zip` and roll the bundle FORWARD (138). Do not
rebuild an existing bundle number.
