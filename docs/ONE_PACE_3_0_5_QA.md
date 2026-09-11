# One Pace 3.0.5 owner-approved release

Owner explicitly approved public release after being informed of the unresolved crash and simulator failure. Version 3.0.5 promotes the tested 3.0.4-beta.1 with identical playback code. The version increment ensures beta testers can update. The historical hold below was superseded by that approval, not by new native playback evidence.

Tested the exact testing ZIP, 3.0.4-beta.1, SHA-256 `1766de33ac5adda215f44016b823faa2642041f23520a2758d3c70d100cf13e7`. No playback code or app code changed for this audit.

Catalogue observed: 485 episodes. Seed 20260912 selects one episode from each of 17 consecutive blocks of at most 30. Selected positions: 13, 39, 87, 91, 138, 172, 202, 216, 242, 284, 307, 356, 366, 420, 443, 476, 484. Additional positions: 390, 400, 410. Position 400 currently maps to Wano 07 at 720p.

Every returned quality was checked for each available Sub/Dub choice at these 20 positions:

- 42/42 routes returned MP4 headers: 28 Sub quality routes and 14 Dub quality routes.
- 12 episode/language slots had no Dub listed; no substitute was requested.
- 42/42 three-second FFmpeg video/audio decode samples at 90 seconds passed, each producing at least 72 video frames.
- 16/16 independent seek/decode samples passed around positions 390, 400, 410 and 420, using offsets 10, 300, 60 and 600 seconds.
- Five existing module regression tests passed again.

These independent FFmpeg processes do NOT exercise repeated seeks within a single app player/controller. They do not certify correct speech, subtitle synchronization, complete downloads, full-length playback or the reported iPhone crash. No failure was discarded in the final sampling run; JSON evidence is in `block-probe-results.json`.

Homepage artwork inspection: the module returns `/favicon.ico` for the title image. The server returns image/x-icon, not a poster. The watch page provides a PNG logo. No image change is included in this unchanged-candidate audit.

Native attempt: `2026-09-11T19-01-25-488Z_onepace400`, using the existing S2 media_kit harness on Wano 07. This harness is not the full production WatchScreen and does not reproduce rapid repeated button presses. See `native-400-result.json` for final outcome. Public release remains on hold while the reported whole-app crash is unresolved.

Final native result: FAIL (`SIMULATOR_TIMEOUT`, `SIMULATOR_SUMMARY_MISSING`). Log ends at `Running Xcode build... No tests ran.` Playback never began. This does not implicate or clear the media route; native crash verification remains blocked by the test build.
