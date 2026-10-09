# MovieDB 0.1.0-beta.14 — release note

## What this fixes (the report)

Owner: *"for the mental episode one is showing the quality as auto... what is auto? It probably knows
what the number is, but it's not showing it."*

## Cause

The Mentalist S1E1 is served as a single fixed-resolution MP4 — there is no adaptive ladder to
choose from, so the quality menu showed one generic entry labelled **"Auto"**. The module had
accepted the route but never read its pixel size, so `qualityLabel(0,0)` produced "Auto". The real
resolution (1920×1080) lives in the file's own header (the `moov`/`tkhd` box) — inside the exact
64 KB `Range: bytes=0-65535` the module already fetches while validating the route. The information
was one parse away; nothing extra to download.

## Change

- New `mp4VideoDims()`: reads the video track's height (16.16 fixed-point) from the `tkhd` box at
  the canonical v0/v1 offsets, with a ±16-byte window to absorb the fact that the bridge decodes
  bytes as UTF-8 (height bytes like 0x0438 always survive; the plausibility gate rejects matrix
  noise). Height-only by design — widths can contain 0x80 bytes that do not.
- Wired into BOTH direct-media acceptance sites (primary non-playlist branch + the variant that
  answers with direct media). Zero extra requests; when dims cannot be read the label falls back to
  "Auto" exactly as before.

## Verification

- Live: The Mentalist S1E1 → `quality: "1080p"`, `qualities: [{label:"1080p", height:1080}]`,
  `streams: ["1080p", url]`; resolve ≈1.4–2 s; download probe 206 `video/mp4`.
- Gladiator → **"816p"** (its true letterboxed height), cross-checked against the raw file bytes
  (`tkhd` = 816). Reader accuracy proven on two real files plus synthetic v0/v1/multi-track/negative
  cases.
- House tester: **PASS 31 / FAIL 0 / WARN 1**.
- Release gate: 2/3 first attempt — mentalist `mp4_bytes` attempts=1, friends OK; gladiator failed a
  provider window and re-probed OK minutes later.
- App runtime: **ALL PASS on both lines** (8.5.33 + 9.0.71+250), mentalist, download probe 206.
- S2 quick: Flutter runtime PASS, media decode PASS; frame-capture/continuity codes on one large-MP4
  sample (HLS-oriented legs) while S2's own ffprobe read the same file (2709 s, `mov,mp4`) — not a
  module defect.
- Context note: subtitle counts for this title swung 102→73→64→0 provider-side across the evening
  (0 at the certification instant — the NODE instrument returned 0 identically). Unrelated to this
  change; the module reports what the source serves.

## Publish trail

- ZIP `modules/MovieDB-0.1.0-beta.14.zip` sha256
  `e1187d6bc571dcb24c1c8340378bf1f191f8cdd7bef8b8d553258e818ba9f3d6` — byte-identical to the served
  release asset; `mp4VideoDims` confirmed present in the shipped JS.
- Tag `pre-moviedb-b14-20261009`; commits `d6aa139` (module) + `6a1cf50` (bundle 146); CI run
  `37997858009` success; signed index entry verified (version + sha256 + signature).
- Bundle **146** sha256 `c262387fd5f87f7e8a6f4415332319bfdd3848c1005615aca926d2ea541e3916`.
- Superseded ZIP kept: `modules/MovieDB-0.1.0-beta.13.zip`.

## Rollback

Point the catalogue entry back at `modules/MovieDB-0.1.0-beta.13.zip` and roll the bundle FORWARD
(147 — downgrades are rejected); or revert `d6aa139` alone (bundle rebuilt forward in the same pass).
