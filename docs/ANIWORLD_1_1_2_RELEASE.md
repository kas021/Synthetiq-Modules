# AniWorld 1.1.2 - 13 September 2026

Owner requested repair, testing and official publication. Baseline: official 1.1.1,
SHA-256 50b884d79c2216af7d12f887fcfc29fd73758f398b1cda9c2173a58c8eb02d28.

## Scope

- Collect `/filme/film-N` alongside numbered TV seasons; movies/specials use
  season 0 with source titles, stable URLs and actual Sub/Dub flags.
- Allow those movie URLs through the existing playback resolver.
- Remove indefinite module-runtime detail/episode caches. Reopening the handler
  fetches current lists. No changes to app-side caches or UI.
- Media validation and host resolver implementations unchanged; no app changes.
- Latest One Piece season has no German Dub listings. Sub remains available.
  Bleach groups Thousand-Year Blood War within season 17. Do not invent dubs.

## Verification

- Fixture checks: movie/episode identity, movie language flags, refreshed seasons,
  movie stream routing, unrelated-host rejection.
- Five live catalogue checks: Bleach 420 entries (6 movies/specials), One Piece
  1228 (51), Naruto 226 (6), Dragonball Z 311 (20), Jujutsu Kaisen 62 (3).
  No duplicate URLs. Counts describe listings, not full playback certification.
- Ten explicit playback requests: 9/9 available-language cases decoded five
  seconds of video and audio from 90 seconds. Naruto film 1 German Dub absent:
  returned no stream correctly; site exposes only subtitle language keys 2/3.
- Standard S2 PASS: `2026-09-12T23-49-53-726Z_s2_aniworld-v1_22490f0f`.
  Real Flutter import/search/details/episodes/movie resolution passed; first,
  middle and latest media checks passed; sampled audio detected Japanese.
  Simulator video advanced approximately 120 seconds and seek check passed.

## Limitations

S2's overall PASS does not mean every aspect is certified: simulator checkpoints
report an unavailable audio device (no audible simulator sound). Host samples
decoded audio separately. Physical iPhone/Android, full offline downloads and
full-length subtitle/audio accuracy remain unverified. Existing provider failures
documented in 1.1.1 are not claimed fixed by this catalogue update.

An initial expanded catalogue probe used an incorrect `dragon-ball-z` test URL;
verified search identified `dragonball-z`, and the corrected five-title run passed.

Local sources/tests/evidence are under
`dev_assets/modules/_development/aniworld-movies-1.1.2/` in the Player checkout.
