# AniKage 1.1.0 - metadata repair and owner QA

Date: 2026-09-10. Module-only update; no app, backend or account changes.

## Scope

- Recover real HTTP caption URLs supplied in embed query metadata. Opaque
  provider tokens are no longer prefixed with a CDN hostname and advertised as
  playable/downloadable media or subtitles.
- Retain source-supplied caption languages and per-server tracks and headers.
  Multiple-language support does not invent languages missing upstream.
- Resolve the selected provider's embed alternatives with two workers and a
  22-second overall budget. Retain distinct checked routes for the app's server
  picker. Subsequent providers remain fallbacks when no checked route is found;
  this is not an eager scan of all seven providers for every playback request.
- Preserve primary URL/headers for existing clients. Explicitly reject wrong
  response identity/language and malformed episode references; do not fabricate
  explicit Dub availability when the episode metadata is unknown or false.
- Validate marker pairs, including zero starts; bound HLS recursion and reject
  HTML, JSON and image segment responses. Quality is honestly Auto, not a
  hardcoded 1080p promise. This update does not introduce a quality ladder.

The underlying fetch bridge cannot cancel every in-flight request. Timeout
guards prevent late candidates from being returned or starting further probes,
but a previously issued request can still finish after the resolver returns.

## Verification

- Ten fixture regression tests pass, including more than four servers,
  caption recovery, per-server metadata, identity/language rejection and the
  Flutter runtime's optional clearTimeout support. Tests run against the actual
  catalogue ZIP in GitHub CI alongside the eight publication-guard tests.
- S2 run `2026-09-10T00-08-42-541Z_s2_anikage-v1_226993fc`: real Flutter runtime
  passed; first/middle/latest media probes passed; English-caption language
  detection passed (confidence 0.911). Overall FAIL: simulator build timed out
  before any native playback test ran. This is not a native playback pass.
- Retry `2026-09-10T00-17-20-582Z_s2_anikage-v1_32642e55` again passed the
  runtime, three media probes and caption validation, but returned the same
  overall FAIL (SIMULATOR_TIMEOUT / SIMULATOR_SUMMARY_MISSING). Do not erase
  this failed release gate or reinterpret it as successful native playback.
- Targeted fresh checks: Attack on Titan S1 episodes 1, 13, 25, each requested
  as Sub and Dub. All six resolved with two or three checked server options;
  all six English caption GETs returned HTTP 200 and parsed cues (250-365).
- Resolution took approximately 5.6-6.2 seconds in that run. No claim of faster
  startup than the old first-server-only implementation.
- Three-second FFmpeg samples at 180 seconds passed on primary and backup for
  episode 1 Sub and episode 13 Dub. Other samples timed out or had interrupted
  transfers. Metadata fixes are not proof that every upstream video is reliable.
- A subsequent unchanged-1.0.4 comparison decoded episode 1 Dub and episode 13
  Sub successfully, while its captions still returned 403. A separate comparison
  confirmed both versions selected the same primary resource path and headers
  for episode 1 Dub. These observations do not establish the cause of the
  intermittent decoding/timeouts or prove a fix for them.
- Correct spoken audio language, the 30-title matrix, completed offline
  downloads and native-device repeated seeks remain unverified.

## Rollback and distribution

The previous 1.0.4 package remains immutable. Bundle 106 preserves all 26 ZIPs
from Bundle 105 byte-for-byte and adds AniKage 1.1.0; no other module package
is changed. Signed-index publication must pass public URL/size/SHA-256 checks.

The candidate was pushed only to `codex/anikage-1.1.0-metadata` for the owner's
explicit phone test request. No stable release asset, signed index, or main
branch was updated. Normal in-app update checks therefore still see 1.0.4.
The owner can download the branch ZIP and import it as a module ZIP (not as a
repository URL). Broad publication remains gated on native QA and approval.

Public candidate download verified anonymously: HTTP 200, 8518 bytes,
SHA-256 `8c043a4e7df8416dd5c996a2548bd782e88f5bf8cfc5c1850da9ae60e0b4e985`.
Test first: Attack on Titan S1E1 Sub and Dub, English captions, then each shown
server. Report the selected server and mode if either captions or playback fail.
