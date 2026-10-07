# AniPM 0.1.0-beta.4 — release note (module-side fix)

## What this fixes (two user reports, one cause)

1. *"Downloads have no audio available"* — downloading an episode produced a silent file
   (AniPM was the only module whose downloads worked at all).
2. *"Audio gets delayed at random times"* during playback.

## Cause

AniPM resolves up to two engines per episode: its own **AniPM engine (settlar)** and the
**MegaPlay** backup. The module listed settlar first — and the stream the app defaults to is
also the stream its **downloader** fetches. The app's downloader understands only
`STREAM-INF` variants: audio delivered as a separate `EXT-X-MEDIA` rendition is never
fetched, and the settlar media host rejects the app's non-NSURLSession clients — so a
settlar-default download had no audio path at all. The same demuxed route is the prime
suspect for the random A/V drift.

## Change

Default route order swapped: **MegaPlay first, settlar second** (settlar stays selectable as
the alternate server — nothing removed).

Verified on the live MegaPlay route before shipping:

- single variant, **muxed** AVC video + AAC audio (`CODECS="avc1.640028,mp4a.40.2"`)
- 321 segments across the full 24.6-minute episode; real PTS tracks the manifest within
  **±0.02 s** — no drift, no discontinuities
- fetchable by the app's own HTTP stack (same CDN AniKoto already serves)

## Verification

- House tester: **PASS 30 / FAIL 0 / WARN 0** (incl. One Piece 1180 eps, Bleach 366, Death Note 37)
- Release gate: **ALL_PASSED** (Home 6 sections / 148 items; both search queries; streams 2/2 segment-OK)
- Route-order unit check: `streams[0]` = `MegaPlay · Sub` with a stubbed settlar route present
- ZIP: `AniPM-0.1.0-beta.4.zip` sha256 `501ffce64440f18354246610d60883dc3d4c48a819cbc23a9186c0de2a28d126`

## Not verified from here

The settlar route itself cannot be inspected from this network (the site hard-blocks it).
If audio lag still appears **on the MegaPlay default**, it is not this route's doing — that
would need a playback report from the device.
