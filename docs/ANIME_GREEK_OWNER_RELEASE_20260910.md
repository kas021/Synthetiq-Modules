# Owner-approved Anime and Greek release

Published candidates: Synthetiq Anime 1.0.2 and An1me (Greek) 1.1.1, Bundle 112.

The owner explicitly requested public promotion after reviewing the reported
failures. This is a release authorization, not full certification or a claim
that those failures have been fixed. App code, backend services, accounts,
the other module packages and default module selections are unchanged.

## Package provenance

- Anime is repackaged from 1.0.1-beta.5, SHA-256
  `c1ba3525de261cc276b8c238bb304b2994d98c9c8ae66adc544a7c37d0a738ed`.
- Greek is repackaged from 1.1.0-beta.4, SHA-256
  `cce5c9d26a4da8ba823d752633c5419f173ac2cd3f884b9fb3e8e04e8d252a3f`.
- Both `index.js` files are byte-identical to their tested candidates. Only
  release versions, release metadata and icon presentation changed.
- Versions increment the patch component so the deployed Player comparator
  recognizes the stable release as newer than its beta, not as a downgrade.
- Anime uses the owner-supplied black-and-white artwork. The original PNG is
  preserved in `assets/module-icons/originals/synthetiq-anime.png`; the complete
  image is proportionally resized to 384 px for the catalogue icon, not cropped.

## Recorded evidence and limitations

| Candidate | Stream resolution | Short video/audio decode |
| --- | --- | --- |
| Anime Sub | 30/30 | 30/30 |
| Anime Dub | 30/30 | 29/30 |
| Greek available audio modes | 9/10 | 9/10 |

Anime: 30 titles (20 fixed, 10 seeded holdouts); all 242 returned subtitle files
loaded with cues and 23 declared language codes. Naruto episode 1 Dub produced
insufficient decoded output in one sample starting after a 90-second input seek.
The earlier independently observed Spy x Family episode 1 Dub returning Japanese
audio is unresolved; decoding other samples is not spoken-language proof.
The S2 quick Naruto candidate run passed:
`2026-09-10T22-30-32-714Z_s2_synthetiq-anime-v1_4abfb27e`.

Greek: 10 titles, nine episode lists, 10 attempted audio modes because One Piece
has two. Nine modes decoded from startup across eight titles. Pokemon XY Dub
returned no stream; Gintama season 4 returned no episode list. Only the default
route per audio mode was decoded, not every server. The Flutter S2 Death Note
stream check failed despite correct Sub-only flags:
`2026-09-10T22-29-45-446Z_s2_an1me-v1_4eb244c9`.
Standalone FFmpeg success does not override that runtime failure.

An early Greek probe incorrectly rejected real media with image-named HLS
segments. The corrected probe uses the existing S2 extension policy and still
requires actual decoded frames and audio. The early 3/10 result is not valid
module evidence. The corrected 9/10 result is the one reported here.

Neither candidate has full-episode, offline, all-server, all-language or
cross-device certification. Unavailable source coverage and runtime failures
remain visible; do not describe this promotion as fully fixed.

## Rollback and testing cleanup

All previous immutable public packages and bundles remain reachable. Withdraw
this catalogue entry or publish a newer corrected version for rollback; do not
overwrite published ZIP bytes. After signed public package verification, remove
both candidates from the active testing index while retaining their old URLs
and bundles for cached-index compatibility.
