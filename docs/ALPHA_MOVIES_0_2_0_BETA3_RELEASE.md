# Alpha Movies 0.2.0-beta.3 — release note

## What this delivers (owner ask: "finish this module")

Six fixes on top of the beta.2 public beta. The two that matter to users immediately:

**Embedded subtitles — captions now survive the external chain being down.** vixcloud masters carry
subtitle renditions (`EXT-X-MEDIA TYPE=SUBTITLES`); the module now fetches, timing-validates and
merges them English-first from any accepted route. Live proof on a day the external chain was
quota-parked: Breaking Bad S1E1 → **6 languages** (en, de, el, fr, it, ro); Inception → **8 languages**.
Multi-segment tracks with `X-TIMESTAMP-MAP` stay skipped (unmergeable — a wrong timing is worse than
no track).

**Titles that failed to resolve now resolve.** Title/year identity came from scraping TMDB's page,
which intermittently bot-walls script clients → videasy + Stream Unity (title-keyed) went dark,
Breaking Bad dead-ended on live beta.2. Identity now resolves via Wikidata (keyless). Hand-measured
the same episode refs on both builds: One Piece S1999E1 and The Batman S1E1 each return **0 candidates
on live beta.2** and **2 accepted servers on 0.2.0-beta.3** — strictly wider coverage.

Also in this build: home-screen poster fallback (TVMaze artwork — 0 missing across all 32 cards, was
6), a caption-timestamp parser fix (`MM:SS.mmm` was read as `HH:MM`, rejecting any track past ~4 min),
a size budget for the app bridge's 2 MiB result cap (Inception 3.44 MB → 1.72 MB; tail languages drop
first, never English), and failure snapshots that report the honest reason to every tool.

## Verification (certified bytes)

- Unit suites: **91/91** (12 suites; was 72).
- Release gate: **ALL_PASSED** — inception / breaking bad / severance, all segment-verified on the
  FIRST attempt (`media_bytes` / `media_bytes` / `ts_media`).
- App runtime through the real Flutter bridge: **ALL PASS on both app lines** (8.5.33 + 9.0.71+250),
  Breaking Bad with 6 subtitles, download probe 200 (`playlistDepth 1`).
- S2 quick (run twice, unchanged logic): runtime PASS both; media decode PASS / 2-of-3 samples on the
  second (one sample's probe flaked upstream; the same route class decoded in run A and both
  app-runtime legs). No module-side failure codes.
- House tester: PASS 30 / FAIL 1 — the 1 FAIL is the documented extension-less-master classifier
  artifact (production parity; gate + app-runtime + ffprobe walk the route).
- Coverage matrix instant: HOME 3 sections / 32 items in 1.97 s; episodes **5/13 (38%)** sampled. The
  two 0/4 titles were **hand-verified the other way**: both resolve on these bytes and fail on the
  live predecessor — the percentage is an aggregator-mirror instant, not a coverage regression.

## Publish trail

- ZIP `modules/Alpha-Movies-0.2.0-beta.3.zip` sha256
  `169a207b996f135ec2b5d2aa8d81ca5d32904454e75dc74b2c42cb7356580e7c` — byte-identical to the served
  release asset.
- Tag `pre-alphamovies-b03-20261009`; commit `694c01d` (module) + `56a2be5` (bundle 145); CI run
  `37988975679` success; signed index entry verified (version + sha256 + signature); fix phrases
  confirmed present in the shipped JS.
- Bundle **145** sha256 `70d3aac8d21c480dfdbd1104c669e02938ec9ac4e08caad915ad460021450907`.
- Superseded ZIP kept: `modules/Alpha-Movies-0.2.0-beta.2.zip`.

## Rollback

Point the catalogue entry back at `modules/Alpha-Movies-0.2.0-beta.2.zip` and roll the bundle FORWARD
(146 — downgrades are rejected); or revert `694c01d` alone (the bundle is rebuilt forward in the same
pass).
