# KickAssAnime 4.1.0 release evidence

Owner approved beta.3 on phone, then authorized publication if the broader probe reached 80%. This release preserves beta.3 JavaScript bytes; only version/release track change. No app or backend changes.

## Probe result

30 distinct titles, one first/middle/latest episode per title (rotating), 20 fixed and 10 seeded catalogue selections. Random seed 20260910; pool is discovery browse pages 1-3, not the entire catalogue. Raw records are RELEASE_PROBE_30.json and RELEASE_PROBE_NAMES.json.

Original searches found 27 exact-name entries. Three were resolved through recorded live searches under the catalogue names Naruto Shippuden, Hunter x Hunter (2011), and Demon Slayer. Original search failures remain recorded; the supplemental file tests these identities without substituting different series. The original broad-query flow passed 23/30; after those naming corrections the media availability result is 25/30 (83.3%).

Across those 30 selected episodes: 25/30 Sub routes passed; nine of ten advertised Dub routes passed. Combined: 34/40 attempted routes (85%). Non-advertised Dub is not counted as a passing route or as a failure. No failed media route was retried into a pass.

Pass here means actual short FFmpeg video AND audio decode, with a retrievable English dialogue-caption file for Sub. These are not 30 native-device playback sessions, full-episode viewing or independent spoken-language verification. Dub probes do not prove the app selected English from a multi-audio master.

## Known failures

- Tomo-chan Is a Girl!, episode 7: no returned stream.
- Spy x Family, episode 12: no returned stream.
- Rowdy Sumo Wrestler Matsutaro!!, episode 24: no returned stream.
- Amanchu! Advance, episode 12: no returned stream.
- Naruto Shippuden, episode 1: both Sub/Dub returned a playlist without a decodable audio stream (explicit FFmpeg audio-map failure).

These are sampled failures, not claims that every episode of each title fails. Missing sources have not been repaired by the subtitle update. Site and network availability can change.

## Features and limits

Provider subtitle names now stay with their own URLs, including English, French, German, Italian, Spanish, Portuguese, Russian and Arabic on Bungo Stray Dogs 5. Unknown metadata is not guessed English. Usable server choices retain their own headers and captions. Bleach Sub exposed two choices in the probe; many titles expose one. BirdStream DASH is unsupported. External-audio masters remain Auto where selecting a video-only child would lose audio.

12 module regression tests passed. Exact stable S2 run 2026-09-10T18-20-33-189Z_s2_kickassanime-v3_7b495b6c reported FAIL/SIMULATOR_SUMMARY_MISSING: Xcode could not build because the Mac filesystem had no space left. Runtime and first/middle/latest media checks passed. This is an infrastructure blocker, not evidence of a new module playback failure. After receiving the probe results and this blocker, the owner explicitly authorized release on 2026-09-10 without repeating the simulator build. This is an owner-accepted release exception, not a passing simulator certification.

Beta.3 S2 was PARTIAL with runtime/media/subtitle checks passing and simulator audio-device initialization failing. Physical Android, full offline and all-title spoken-language certification are not claimed.
