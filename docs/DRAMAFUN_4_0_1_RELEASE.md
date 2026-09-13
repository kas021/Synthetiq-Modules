# DramaFun 4.0.1: owner-approved release with limitations

2026-09-13. User explicitly requested promotion after beta.6 QA caveats.
Playback JavaScript is byte-identical to tested 4.0.0-beta.6. Only manifest
version/track change; identity dramafun-v3 / SP-VID-035-DRAMAFUN / 35 retained.
4.0.1 sorts above beta numbering in older Player updaters. No app/backend edits.

- 38 regression tests pass; frozen 30-title run: 29 resolve, 28 short host
  decodes, 30 posters, 24 multiple-server results, 3/3 600-second seek samples.
- Al Fondo Hay Sitio S11E1 returned 403 during playback. Luz de Luna S2E71
  returned no verified route. Other failures may vary with source availability.
- Caption parser handles JSON keys, HTML tracks and declared extensionless
  endpoints. No usable external captions returned across 73 sampled servers.
- Current Player drops nested per-server quality lists after a server switch.
  This module supplies them but does not repair the app parser.
- S2 beta.6 run 2026-09-13T14-19-44-459Z_s2_dramafun-v3_a4d7adf5: machine PASS;
  manual screenshot shows advancing video AND an audio-device error. Overall
  PARTIAL. Physical-device sound, full WatchScreen switching and app offline
  are not certified. A host decode is not full phone playback.
- Still site-assisted: DramaFun maps episode identities to provider file IDs.

Original packages and bundles retained. Beta.6 retired from active testing after
public stable delivery is verified. Promotion is not a claim of full reliability.
