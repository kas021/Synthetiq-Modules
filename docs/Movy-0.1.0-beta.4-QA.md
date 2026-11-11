# Movy 0.1.0-beta.4

Owner-authorized beta release, 2026-11-11. Not a claim of universal playback.

## Package

- ID: movy-v1; identity: SP-VID-076-MOVY.
- SHA-256: 9c2efa132f5577520492f1f20c27fd11e2d686194134e0638a5065724c1234c3.
- Bundle 163 adds Movy to the existing 38 packages. Those packages, defaults and repository minimum version are unchanged.
- Module-only work: no app, backend or tester changes in this release.

## Changes

Caption language/format handling and per-track headers; homogeneous quality groups; actual TV season/episode IDs; bounded catalogue requests; provider Retry-After handling; four-transport ceiling; accurate timeout diagnostics. Already-started fetchv2 transports cannot be aborted by this module.

## Evidence

| Check | Result |
| --- | --- |
| Broad live movie/episode cases, exact final source | 25/25 resolved; 18/25 completed the A/V sample (72%) |
| First two advertised caption tracks, where present | 14/16 timed-cue probes passed; two Dark Matter track timeouts |
| Offline catalogue, risk and caption/identity/quality fixture groups | 21 passed |
| Timeout classification repeated offline | 10/10 passed |
| Real V9 Flutter runtime: Alone (2020), TMDB 661950 | PASS: home/search/details/episodes/stream/playability/download-link probe |
| Real V9 Flutter runtime: The Mentalist S7E13 | PASS: same stages |
| Standard S2: exact final ZIP, Alone | PASS, run 2026-11-11T23-01-25-952Z_s2_movy-v1_cbbf8862 |
| S2 simulator | Playback progression, pause/resume and seek passed; post-seek film frame inspected |
| Repository regression checks | 27 passed |

The seven broad sample failures were 30-second FFmpeg wall timeouts: Inception, Breaking Bad S1E1 and S3E7, Silo S1E1, Game of Thrones S1E1, Stranger Things S1E1 and Severance S1E2. Their causes remain unproven. A separate replay of the saved Silo Auto and 1080p routes passed; it does not replace the first-pass failure.

The broad samples decode three seconds at 60 seconds, not full episodes. Provider captions vary and were absent on the tested Alone and Mentalist routes. Caption probes do not certify translation or synchronization. The S2 opening audio transcript contained only music, so its English language label is not independent spoken-language proof. The simulator reported an audio-device initialization issue: audible simulator output remains unverified despite separate media audio decoding.

Earlier beta.3 achieved 22/25 samples after correcting three inherited corpus IDs; it is not the final beta.4 score. Beta.3 also passed three consecutive same-context Alone A/V samples after correcting decoder HLS-extension handling. An earlier failed decoder run and a provider 502 remain recorded privately. No physical iPhone, Android, full-film, complete offline-download, or released-8.6.7 acceptance is claimed.

## Rollback

Bundle 162 and all historical packages remain immutable and available. Removing this catalogue entry does not downgrade installed clients. A source rollback for installed Movy requires a newly approved higher version carrying restored source and a higher bundle version; never overwrite the beta.4 release asset.
