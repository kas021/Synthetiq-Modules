# AniKoto 5.0.2 Release QA

Owner approved public distribution on 2026-09-11. This is a metadata-only promotion of 5.0.1-beta.3; playback JavaScript is unchanged. Version 5.0.2 ensures existing numeric-token updaters advance past the beta version.

- Candidate SHA-256: `85149352185162a0d4afac390d2e27d2b45137c4da65e6c444162550f0326739`
- Release SHA-256: `e6e652490231accab1f4c12cccad7143bee59dc55f205666058a11e95afea02a`
- Playback JavaScript SHA-256: `1a8b8e48e125ae9beee40171c5a93a9b738b3d68463678d5954754d38dcd894d`

## Recorded Candidate Evidence

30 titles, 60 Sub/Dub requests: all 52 available cases resolved; 51 decoded video/audio on the first short FFmpeg test. The remaining case decoded after fresh resolution. Eight unavailable Dub requests were correctly rejected. This is not 30 full native playback passes.

129 caption files parsed: 128 within the initial byte limit and one larger file on follow-up. This does not certify translation or full-episode synchronization. All 25 focused regression tests passed.

S2 quick Sub checks passed. The Dub quick check retained an automated Japanese opening-audio failure flag; a later dialogue sample detected English. That is not grounds to erase the flag or claim complete language certification. Flutter runtime checks passed for the recorded candidate cases.

Native iPhone/Android certification, full-episode playback and offline verification remain incomplete. Source availability can change. No app code changed; app-side retry/lifecycle problems are outside this module release.

Detailed candidate evidence remains in the testing repository's `ANIKOTO_RELIABILITY_QA.md` and `ANIKOTO_RELIABILITY_PROBE.json`.
