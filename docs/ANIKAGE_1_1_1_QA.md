# AniKage 1.1.1 release evidence

Date: 2026-09-10

## Scope

The owner requested distribution of the existing module even if long-distance
seeking remains unresolved. This is the exact testing-repository ZIP, with its
beta releaseTrack retained. No app, player, proxy, or app-test code was changed.

ZIP SHA-256: `647a97fb91bd9325167a3f088543010a44906052afeebd986757017fefbd2ea1`

## Verified

- 13 packaged-module fixture tests pass: captions, markers, route metadata,
  request identity, language flags, invalid media rejection, and rate limits.
- 8 publication-guard tests pass, including anonymous download verification,
  persistent 404 rejection, and immutable asset integrity.
- All 26 existing bundle module ZIPs remain byte-identical. Bundle 106 adds only
  AniKage 1.1.1; this is not a refresh of unrelated modules.
- Prior S2 quick run `2026-09-10T01-19-42-810Z_s2_anikage-v1_85fb5339`
  was PARTIAL: real Flutter runtime passed; first and middle sampled episode
  media passed; latest sampled episode failed decoding. English subtitle
  detection passed. Spoken-audio language verification was skipped.

## Seeking comparison

Attack on Titan S1E1 SUB, episode `5xxCxNSHUK:ep:1`:

- Old 1.0.4 and 1.1.1 selected the same primary host, media pathname and headers.
  New resolution also checks backup routes, increasing initial lookup time.
- Fresh independent FFmpeg tests sought to 600 seconds and decoded two seconds
  of video and audio: StreamHG 4.628 seconds; Earnvids 5.524 seconds.
- Earlier primary tests varied from 4.329 to 9.556 seconds. These include
  process startup, stream opening and decoding; they are not native player
  seek measurements. They do not establish a consistently faster alternative.

No speculative server reorder or seek fix is included.

## Outstanding

- Long timeline drags can stall; downloads may remain slow.
- Some episodes/providers fail or rate-limit, including prior JoJo S1E1 tests.
- Full SUB/DUB spoken-language verification and a 30-title playback sweep
  have not been completed.
- Device playback, native long-distance seeking and switching mid-playback
  are not certified by HTTP probes or independent FFmpeg decoding.

## Standard release gate: FAIL; explicit owner override

Run: `2026-09-10T01-37-17-542Z_s2_anikage-v1_1b6d968d`.

- Real Flutter runtime passed.
- First sampled episode passed 120-second media analysis; middle passed metadata
  validation. Latest failed with `STREAM_DECODE_FAILED`.
- English subtitles passed detection; spoken-audio language verification skipped.
- Simulator timed out with no playback summary. This is missing native evidence,
  not proof of a native player defect or successful seeking.
- Overall S2 result: FAIL (`STREAM_DECODE_FAILED`, `SIMULATOR_TIMEOUT`,
  `SIMULATOR_SUMMARY_MISSING`). This is not a certified release.

After receiving the failed-check summary and confirming the exact package was
already in testing, the owner explicitly requested: "push module to main repo".
This publication follows that explicit override and does not change the failed
test result. Acceptance does not establish playback for the failing sample.
The package bytes and beta label remain unchanged.
