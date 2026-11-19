# AnimeWorld 1.0.0-beta.1 (Bundle 169)

Owner approved publication to the main module repository on 2026-11-19 ("yes publish both").

## Package

- Module: `animeworld-v1` 1.0.0-beta.1.
- Identity: family `animeworld_v1`, `SP-VID-289-ANIMEWORLD`, number 289.
- ZIP: `modules/AnimeWorld-1.0.0-beta.1.zip`, SHA-256 `f3127253ac5e1060b98b683d50142806ff6479afbf51380d03cd53e0afd667c8`.
- Bundle 169 is bundle 168 plus this ZIP. All other inner ZIPs are byte-identical.
- Icon: the site's own `android-icon-192x192.png`.

## Behaviour

- **Catalogue and language pairing:** catalogue, search and episode lists come from animeworld.ac HTML pages. SUB ITA and ITA dub entries are paired by title, so one series offers both. A dub request only ever uses the dub entry, and the reverse also holds.
- **Search fallback:** when nothing matches by title, AniList is used to look up the romaji title.
- **Streams:** episode files come from `/api/episode/info` (`grabber`), as progressive MP4 on the site's own CDN. Each file is range-probed before it is returned.
- **Subtitles:** SUB ITA subtitles are burned in, so no external tracks are offered.

## Evidence

All testing was on the V9 freeze runtime `797804dd`, from a UK connection.

- **V9 runtime:** all stages passed for Frieren and One Piece (sub and dub), Attack on Titan (sub, found via the AniList fallback) and the final-build Frieren dub.
- **Wider sample:** 42/42 sub and dub episodes, first and middle, across 11 series. Each returned the matching SUB_ITA or ITA file.
- **Spoken language (Whisper):** SUB ITA was Japanese and ITA was Italian for One Piece, Demon Slayer and Spy x Family.
- **Simulator:** 2 minutes of continuous Frieren ITA playback in the V9 native player, with no buffering.
- **Download:** the full Frieren ITA episode downloaded (491,545,089 bytes, 25:57).

## Known Limits

- Some series exist only as a dub on the site (e.g. Dragon Ball Z), so they offer ITA only.
- Italy-only blocking was not tested.
- The separate AnimeUnity repair is unchanged.

No app code, backend or other module changes.
