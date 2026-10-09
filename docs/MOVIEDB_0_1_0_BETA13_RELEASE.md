# MovieDB 0.1.0-beta.13 — release note (module-side fix)

## What this fixes (the report)

"This source could not provide a working video link. Try again or choose another source." — on titles
that play fine on moviedb.wiki in a browser. Reproduced with **The Mentalist** (S1E1) on the live
beta.12: search and details fine, episode list fine (151 episodes), stream resolve returned
**empty after ~15 s**.

## Cause

The resolver required every candidate route to be an **HLS playlist** (`#EXTM3U` check) and discarded
anything else. MovieDB's VidLove/moviebox CDN now serves many titles as **direct MP4 files** —
The Mentalist S1E1 is a 626 MB `video/mp4`, 1920×1080 H.264+AAC, Range-honouring. Every direct-file
route was thrown away → "no playable stream" while the site played the same provider fine.

## Change (format-agnostic acceptance — the standing rule)

- Route fetch is **Range-first** (`bytes=0-65535`): a direct media file is never dragged through the
  client, and the bridge's over-cap body drop can no longer eat the resolve deadline.
- Non-playlist routes are accepted when **byte-verified**: MP4 (`ftyp|styp|moof`) or TS (`0x47`)
  via a 4 KB range probe; when the bridge dropped an over-cap body, `video/*` on the response
  content-type is the fallback signal (empty text ≠ absent file).
- Same acceptance inside the variant walk; the inline-manifest check now rejects only obvious HTML
  error pages; `probeSegment` is byte-first (no suffix/content-type-only rejections — real media
  under a misleading label is accepted).
- `streamType` is emitted per route (`mp4` vs `hls`) on the top-level field and on each
  `servers[]` entry, so the app picks the right player path.

## Verification

- Resolve battery (4 titles): The Mentalist / Gladiator / Friends / Breaking Bad — **all RESOLVED**
  (540–6,813 ms; direct MP4 routes). Before: all rejected.
- House tester: PASS 30 / FAIL 0 / WARN 1 (Bleach 416 vs 366 — identical on live beta.12;
  pre-existing sampling behaviour, not this change).
- Release gate: **ALL_PASSED** — 3/3 streams segment-verified (`mp4_bytes`), attempts=1.
- Candidate sha256 stable across the whole battery (no harness run altered the bytes).

## Publish trail

- ZIP `modules/MovieDB-0.1.0-beta.13.zip` sha256
  `109180c8c90c74011780d796cec733dc68fb256742ef630064ea1ef36467325c` (byte-identical to the served
  release asset).
- Tag `pre-moviedb-b13-20261009`; commit `f3f842d`; bundle **144** sha256
  `dd900d979088d6773fe9bff7d26757933b7134c057b161d8762d0e097e513c88`.
- CI run `37962544581` success; signed index entry verified (version + sha256 + signature);
  fix phrases confirmed present in the shipped JS.
- Superseded ZIP kept: `modules/MovieDB-0.1.0-beta.12.zip`.

## Rollback

Point the catalogue entry back at `modules/MovieDB-0.1.0-beta.12.zip` and roll the bundle FORWARD
(145); or revert `f3f842d` alone.
