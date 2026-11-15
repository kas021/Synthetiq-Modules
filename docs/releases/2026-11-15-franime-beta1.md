# FRAnime 1.1.0-beta.1 (Bundle 166)

Owner approved publication to the main module repository on 2026-11-15, after reviewing the test summary. This is a beta release.

## Package

- Module: `franime-v1` 1.1.0-beta.1.
- Identity: family `franime_v1`, `SP-VID-054-FRANIME`, number 54.
- Identity source: kept from the unpublished 1.0.0 build.
- ZIP: `modules/FRAnime-1.1.0-beta.1.zip`.
- SHA-256: `cc03bdf0d4a482412ed95abb60a12b3ff26be44329c6c60aafcb9795220d888e`.
- Bundle 166: SHA-256 `741ab70b989a8974e9a47e35c83b7658d8af1c57cd8346c5fd24880446474cfc`. It is bundle 165 plus this ZIP; the other 39 inner ZIPs are byte-identical.
- Icon: `assets/module-icons/franime.png`, the site's own `/logos/apple-touch-icon.png`.

## Behaviour

Catalogue, details and episode lists come from the site's public JSON API.

**Languages.** VOSTFR maps to `sub` (Japanese audio, French subtitles). VF maps to `dub` (French audio).
- A request only tries players for that language; the module never substitutes one language for the other.
- When no player exists for the requested language, it returns an empty result.

**Player links.** Each link is decoded from the API response. The module never loads the challenge-protected `watch2` page.
- Host order: vidmoly HLS (including the ansembed mirror), then sendvid MP4, then sibnet MP4.
- Each candidate is checked before it is returned: the playlist and first segment for HLS, or a ranged read for MP4.
- Exactly one validated route is returned.

**Hosts not offered.**
- uqload: its stream servers present an expired TLS certificate.
- filemoon: adds under 0.1% coverage.

**Numbering.** Episodes keep the site's own numbering when it is whole and strictly increasing, for example One Piece 1-1180 across its arcs. Half-episodes such as 1004.5 go in a "Spéciaux" season.

## Evidence

All testing was from a UK connection.

V9 freeze `797804dd` (9.0.106+286), real Flutter runtime:
- All stages passed for Frieren (sub/dub) and Jujutsu Kaisen (sub/dub): install, home, search, details, episodes, stream, playability and download probe.
- One Piece East Blue E1 sub also passed.
- 2,554 catalogue titles loaded in about 1.3 s.

20 series, first and middle episode, sub and dub:
- 78/80 resolved and passed the media check.
- The two failures were source-side: a deleted host video, and a sibnet-only route that is blocked from the UK.

Spoken language, Whisper on decoded audio:
- 6/6 matched the label.
- VOSTFR was Japanese and VF was French for Frieren, Jujutsu Kaisen and Dragon Ball Z.

V9 native player (media_kit) on the iOS Simulator:
- 2-minute playback of Frieren VOSTFR and VF.
- Position advanced at all 24 checkpoints with no buffering.
- The simulator has no audio device, so audio was verified separately.

Downloads and offline playback:
- Full-episode downloads with the module's URL and headers: Jujutsu Kaisen VOSTFR (23:52) and Frieren VF (26:00), both 720p and complete.
- The downloaded Frieren VF played offline from local disk in the V9 player for 60 s.
- This was a stream-level download, not the app's download manager UI.

## Known Limits

- **sendvid playback.** sendvid caps delivery at about 240 KB/s, below an episode's 2.3 Mbit/s bitrate. Episodes served only by sendvid (about 6%) will buffer while streaming; downloading first works.
- **vidmoly hiccups.** vidmoly occasionally resets a connection. A 4-minute real-time test lost about 12 s overall.
- **sibnet.** Blocked from the UK test connection (403), so it is unverified.
- **Missing episodes.** Some episodes are unavailable where the site's own video was deleted.
- **One Piece live action.** The source lists the 2023 One Piece live action as its first season.
- **Registry.** The `module_registry.json` entry in the Player repo still needs adding. That file had another session's uncommitted edits, so it was left untouched.

## Rollback

- FRAnime is a new module in the catalogue. Removing its catalogue entry in a higher bundle stops new installs.
- Do not overwrite versioned assets or reuse bundle numbers.

No app code, backend or other module changes.
