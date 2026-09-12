# Shahiid 2.1.1 - owner-approved release

Owner explicitly approved promotion of 2.1.0-beta.5 after its partial QA report.
JavaScript is byte-identical to that candidate. Only moduleVersion, releaseTrack
and moduleStatus changed. Version 2.1.1 also sorts above beta.5 in older clients.
Identity remains shahiid-v1 / SP-VID-055-SHAHIID / 55. No app changes.

Fixes: Home catalogue links rather than individual episodes; epp pagination;
stable episode href deduplication; special numbering; poster parsing; explicit
server entries; truthful unknown quality; 60-second bounded search-result cache.

## Evidence and limitations

- 15 module regression tests passed on the candidate.
- 48/51 Home entries returned episode lists; three titles explicitly have no
  episodes on their source season pages. This is NOT 48 playback passes.
- Hunter x Hunter Dub returned 148 episodes; Flutter Boruto returned 288.
- Regular One Piece episodes 1 and 251 passed short video/audio decode checks.
- The reported One Piece special's Google Drive file is removed upstream.
- Boruto E150 failed Share4max HTTP 404; first/latest resolved and decoded.
- S2 automated PASS omitted that failed middle resolution. Manual verdict PARTIAL.
- Simulator video advanced for 120 seconds with seek/pause, but audio-device
  initialization failed. Audible simulator output is unverified.
- Some backup servers still fail decoding despite successful HTTP probes.
- First searches may take 6-7 seconds; cache only speeds repeated queries.
- Existing bounds: 25 pages per season, 15 seasons, 800 total episodes. The
  tested One Piece season stops at 500, not the complete catalogue.
- Physical devices, Arabic speech/caption identity and full downloads/offline
  remain unverified. Approval does not turn these limits into passing tests.

Candidate S2: 2026-09-12T01-46-27-128Z_s2_shahiid-v1_5b52a5eb.
Candidate SHA-256: 7748ea01a4cbdfe574577d1d795695ac1555882d7292d18c1d518fa3b80bbb55.
Original ZIPs and bundles remain immutable and reachable for old indexes.
