# X-Stream 1.3.1

Owner-approved release on 2026-09-12. Executable JavaScript is identical to
1.3.0-beta.4. Only version, release-track/status and description metadata changed.
Version 1.3.1 also advances older numeric version comparators beyond beta.4.

SHA-256: bfe8ea7c95bc3489f0fdb9913ae4bbc5e444d1b64134f65782596c5cab628381

## Changes

- Correct singleton-provider result handling, avoiding unnecessary retries.
- Expire verified video-link cache after 60 seconds, with bounded session storage.
- Reuse complete media-probe evidence within the same resolution.
- Explicit provider server grouping and separate actual quality options.
- Keep source-specific captions and request headers together.
- Request fallback captions only when absent; preserve language validation.

## Evidence and limitations

Eight focused regressions plus the previous contract suite passed.
The resolver study used 20 fixed cases and 10 seeded Home cases: 27/30 short
host audio/video decodes, plus 3/3 decodes at a 90-second seek offset. This study
ran beta.1 resolver code; later candidates corrected timer compatibility and
server/caption grouping. It is not a 30-title native playback certification.

Final beta.4 S2 quick: PARTIAL, run
2026-09-12T15-41-12-522Z_s2_xstream-v1_66cc959c. Flutter runtime and media probes
passed; sampled English captions matched. Spoken-language transcription was
unavailable. Earlier beta.2/beta.3 simulator video advanced for 120 seconds, but
audio-device initialization errors mean audible simulator sound was not verified.

No stream was found for Paradise Hotel S1E1, Mushi-Shi S1E1 or El conquistador
S1E1. Catalogue entries do not guarantee provider coverage. Physical phone sound,
server switching, complete downloads/offline and full subtitle timing still need
testing. Owner approval does not change these results into full certification.

No application or backend code changed. Older immutable package URLs remain.
