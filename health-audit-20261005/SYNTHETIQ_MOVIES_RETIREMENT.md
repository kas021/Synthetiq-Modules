# Synthetiq Movies retirement

Owner explicitly requested retirement on 2026-10-05 because of playback reliability.

- Baseline: `5fe4c6f`, Bundle 131, 38 modules.
- Remove only `synthetiq-movies-v1` / SP-VID-059 from the active catalogue.
- Bundle 132 contains the other 37 existing, byte-identical packages.
- CimaClub 1.0.0 and StreamingUnity 1.0.4 remain unchanged and included.
- Old packages and bundles remain immutable for rollback. No release assets are deleted.
- This stops new repository/bundle installs. It does not remotely delete existing
  installations, user history, or downloaded media. The next V9 app separately
  hides this exact retired video-module identity using its existing health policy.
- Candidate MovieDB/X-Stream repairs are NOT part of this production publication.

Rollback: restore the one catalogue entry from `5fe4c6f`, then build a NEW bundle
with a version above the current published version. Never downgrade the bundle
or overwrite an existing ZIP. Signing/publication uses the normal repository CI.
