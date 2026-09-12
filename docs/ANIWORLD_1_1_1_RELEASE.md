# AniWorld 1.1.1 release QA

Date: 2026-09-12. Owner requested deeper probes after their phone check and authorized publication when results support release.

## Package

- Module: `aniworld-v1` / `SP-VID-050-ANIWORLD` / 50.
- Promotes tested `1.1.0-beta.6` without changing playback JavaScript.
- Stable ZIP SHA-256: `50b884d79c2216af7d12f887fcfc29fd73758f398b1cda9c2173a58c8eb02d28`.
- Packaged JavaScript SHA-256: `6744ffffdf9953adcbda5f09f39c65ab00bee0a66f71a2f6225aed7fe8077325`.
- Version advances to 1.1.1 for older updater ordering. Only manifest version and release status change.
- No app, backend, account, or other module code changes. Historical packages remain available.

## Frozen primary sample

Seed 2026091250: 30 fixed diverse titles, 10 seeded Home titles, and 10 distinct seeded A-Z titles. Early, middle and latest episodes across seasons; Sub and Dub checked separately.

| Check | Result |
| --- | --- |
| Short host audio/video decode | 221/231 (95.7%); 10 no-stream failures |
| Sub | 118/124 |
| Dub | 103/107 |
| Unavailable title-language cases | 1 Sub, 8 Dub; excluded from decode denominator |
| Unresolved strict search identities | 5/50; not counted as playback passes |
| Home details/episodes checks | 20/20 |
| Empty episode lists / duplicate episode IDs / handler exceptions in matched cases | 0 / 0 / 0 |

The five strict identities were Demon Slayer, Haikyuu!!, Code Geass, Monster and Air. A separate full-title follow-up for the first three decoded 13/18 samples; five Sub routes failed. Those follow-ups do not replace the frozen results. Monster and Air remain unresolved.

The combined distinct primary and alias episode-language checks therefore decoded 234/249 (94.0%). These are short host media decodes, not 249 native/full-episode playback passes.

## Other checks

- 19 alternate server/quality commands completed with exit 0; only 4/19 were warning-free. Fifteen logged H.264 reference-frame warnings. A three-route paired diagnostic was warning-free without explicit zero seek and reproduced warnings with it. Do not claim every alternative is clean.
- Ten later-position 15-second samples: nine warning-free; Violet Evergarden Dub completed but emitted PPS decoder warnings. This is not app scrubbing certification.
- Six sampled audio clips across One Piece, Naruto and Death Note were classified as Japanese Sub / German Dub. OCR found English captions for One Piece and German captions for Naruto and Death Note, matching source labels. No claim of every-episode spoken-language or full-caption certification.
- Catalogue and genre pagination returned 30 new items on page 2; finite popular/new rows correctly ended.
- 25 module regressions passed; exact beta ZIP Flutter runtime contract passed.
- Standard S2 retry advanced video 120,520 ms and passed pause/forward/back seek checks. Audit is PARTIAL because the simulator reported audio-device initialization failure. The first run failed simulator installation after unexpected device shutdown; it is not a media failure.

## Known failures

- Tokyo Ghoul Sub S2E12 and S4E12; independently reproduced.
- Made in Abyss Sub S1E1.
- A Sign of Affection Dub S1E6.
- Ahiru no Sora Sub S1E1.
- Alderamin on the Sky Sub S1E1 and S1E7; Dub S1E7.
- Alle meine Freunde Dub S1E26 and S1E52.
- Full-title follow-up: Demon Slayer Sub S2E6 and S4E8, and Haikyu!! Sub S1E1, S2E18 and S4E25 returned no stream; corresponding Dub checks passed. Code Geass follow-up passed 6/6.

Release is based on owner phone approval plus broad probe coverage above the agreed minimum, with these limitations retained. It is not universal availability or full native certification. Physical iPhone/Android sound, sustained playback, app download/offline and all-episode caption behavior remain unverified by this run.
