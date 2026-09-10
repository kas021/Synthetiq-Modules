# YFlix 1.1.0 owner-approved release

Released at the owner's explicit request on 2026-09-10. JavaScript is byte-for-byte
identical to the approved 1.1.0-beta.1. Only manifest version/track changed.
No app, backend or other module source changes.

## 30-title check

20 movies and 10 TV titles, 20 fixed plus 10 selected randomly at execution from
documented pools. TV cases use later-season episodes when available.
Search -> exact normalized title/type match -> details -> episodes -> stream.
This uses a Node fetchv2 shim, not 30 Flutter/native playback tests.

- 28/30 returned stream URLs.
- 22/30 primary streams passed ffprobe with video and audio tracks.
- 13/30 returned subtitle tracks; fetching and synchronization were not tested for all tracks.
- Two search matches were absent: Severance and WALL-E.
- Six resolved primary routes failed media validation: Titanic, Parasite,
  Gladiator, Silo S2E2, The Office S2E2, Friends S2E2.
- Search matching does not disambiguate every remake/year; content identity and
  spoken language still need human checks. The Office selected the 14-episode catalogue.
- Server counts and quality labels are returned metadata, not proof that every
  alternate route/quality works. No full-download/offline certification claimed.

See YFLIX_1.1.0_QA_30.json for every case, timings, selections and results.

## Existing candidate evidence

7 focused module regression tests passed. S2 standard result PARTIAL:
2026-09-10T11-54-37-818Z_s2_yflix-v1_4f226e67.
Inception Flutter runtime and media checks passed. English subtitle language matched.
Simulator video advanced 120 seconds, but audio-device initialization failed;
audible native playback and spoken language were not verified by that run.

This release is owner-approved, not a claim of universal reliability or full S2 PASS.
Old immutable 1.0.0 package/bundles remain available for rollback.
