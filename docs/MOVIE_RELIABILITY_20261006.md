# Movie reliability update - 2026-10-06

## Follow-up preparation

Current proposed packages: MovieDB 0.1.0-beta.12 and X-Stream 1.3.3.
Beta.10 and beta.11 are superseded local candidates, not published versions.

**Current decision: prepared and held, NOT approved for live publication.**
MovieDB final S2 run 2026-10-06T15-33-31-677Z_s2_moviedb-wiki-v1_502f4a35
passed runtime, all three media checks, and simulator playback/pause/seek
(120412 ms observed progress). Its aggregate grade is FAIL because subtitle
language checks reported contradictions. X-Stream is PARTIAL as detailed below.

Review of subtitle evidence found that the detector supports only nine
languages, misclassifies several unsupported languages using shared short
words or embedded English promotional text, and treats `und` as a contradictory
language rather than unknown. The module also lacks aliases for Brazilian and
Arabic HI labels, and one upstream Chinese sample contains mojibake. These are
separate issues; neither dropping tracks nor relabelling them to satisfy the
detector is an acceptable release fix. Preserve the raw FAIL and resolve the
metadata/encoding and verifier coverage questions before publishing MovieDB.
No live push or Discord announcement has occurred. App code is untouched.

Lead compared three independent Luna reviews against the implementation and
native evidence. Chosen change: race the three existing initial providers,
collect verified alternates for at most 350 ms, bound waiting by the existing
15-second budget, and snapshot results so late completion cannot mutate them.
No provider validation was weakened. A subsequent review found an optional
subtitle retry on the critical path; beta.12 bounds it to 250 ms or the remaining
budget. Native flutter_js 0.8.7 has no clearTimeout, so cleanup is guarded.
No player/runtime code was changed and no new provider was introduced.

Underlying fetchv2 requests cannot be cancelled by this module. Late callbacks
are fenced, but outstanding transport work remains subject to native limits.
This is a bounded result wait, not a claim of network-request cancellation.

72 scoped regression/repository tests pass. Beta.12 and X-Stream 1.3.3 each
passed 24/24 short decoder attempts across eight sampled episodes from four
titles, including cold contexts and fresh retries. The earlier beta.11 run
also passed, and remains separately recorded; it is not reused as beta.12 evidence.

X-Stream S2 standard run 2026-10-06T15-27-33-336Z_s2_xstream-v1_6f1754fd
returned PARTIAL with no failure codes: native runtime, first/middle/latest
media checks, 126836 ms observed simulator progress, pause/resume and seeking
passed. Screenshot review confirmed a rendered video frame. Subtitle language
checks were skipped; the simulator reported no audio device, so this does not
certify audible physical-device playback. Host audio-language detection was English.

Beta.11 Flutter runtime passed The Mentalist (1584 ms resolve). Its S2 media
gate rejected extensionless HLS segment URLs; supplementary HTTP-only FFmpeg
checks decoded all three returned routes (720p/1080p). The original S2 FAIL
is retained. A later simulator open failed and the same URL subsequently
returned provider 5xx; this is not a native playback pass or proof of expiry.
Run IDs: 2026-10-06T15-21-52-043Z_s2_moviedb-wiki-v1_ef3bb46c and
2026-10-06T15-23-44-082Z_moviedb-beta11-simulator.

The first beta.11 iteration failed because unguarded timer cleanup threw in the
native runtime; guarded cleanup and a missing/throwing cancellation regression
test fixed it. That failed run remains 2026-10-06T15-18-38-923Z_s2_moviedb-wiki-v1_b60cc3c2.

## Historical hold evidence - not published

These packages and catalogue changes are a local release proposal only. No
production update or Discord announcement was sent. Do not merge or publish
this proposal until the failures below are resolved and verification repeated.

- MovieDB beta.10: two fresh The Mentalist standard runs failed with
  `resolve budget exceeded` before media verification. Run IDs:
  `2026-10-06T14-04-39-848Z_s2_moviedb-wiki-v1_108cec92` and
  `2026-10-06T14-06-10-427Z_s2_moviedb-wiki-v1_68096667`.
- A consecutive same-episode comparison returned two candidates on beta.9,
  but beta.10 timed out. The beta.9 candidates were not decoded in that
  comparison, so this is not proof that the older package plays successfully.
- X-Stream 1.3.3 passed runtime and media checks, but its simulator observation
  timed out after a lengthy build. A second run could not acquire the simulator
  lock. Neither run certifies physical-device playback.
- Final MovieDB beta.10 passed Inception runtime/media checks, but its simulator
  build timed out. This does not resolve the television-episode failures.

Investigate MovieDB's pre-existing primary-provider deadline path: it can throw
before consuming already-started backup results. Verify whether a backup is
actually usable; do not weaken media validation to improve the reported rate.
Run simulator certification serially with adequate build time, retaining the
original failed reports. Re-fetch production before preparing a new bundle;
bundle 135 is not reserved by this local proposal.

`health-audit-20261006/announcement.txt` is an unsent draft, not release evidence.

Owner explicitly requested public distribution of both modules and an @everyone
announcement after verification. This is not a claim of complete certification.

## Release scope

- MovieDB 0.1.0-beta.9 -> 0.1.0-beta.12, fresh-retry/cache/media changes plus
  bounded provider racing and optional subtitle waits. The inherited manifest
  description was corrected to avoid claiming every route is byte-certified.
- X-Stream 1.3.2 -> 1.3.3: candidate retry/identity fixes merged with production's
  first-verified-route early return and original 1.3.2 provider timeouts.
- Bundle 134 -> 135, 37 modules. Other 35 module packages and defaults unchanged.
- Previous immutable ZIPs/releases remain available; no user data is removed.

## Changes and evidence

MovieDB avoids stale/negative cached retry results and obsolete inflight writes,
rejects more invalid media responses, and keeps quality routes with their own
headers and subtitles. MovieDB's probe is still heuristic because the bridge
exposes binary data as text; do not claim every quality is byte-certified.

X-Stream permits one explicit recovery probe after local provider quarantine,
respects Retry-After, reduces nested retries, and prevents stale seed/cache writes.
Matching requires exact IMDb identity or unique full title/year; episode lookup
does not substitute another season when a key is absent.

The earlier frozen 40-title comparison returned 61/80 links for MovieDB and
56/80 for X-Stream beta.3. Holdout returned 14/20 and 12/20, respectively. Returned
holdout streams passed short decoder checks; unavailable entries remain failures.
Those figures describe earlier candidate snapshots, not this merged 1.3.3 package.
Five X-Stream lost results remain unexplained. No universal coverage claim is made.

Both earlier packages passed Flutter contract checks and 12 repeat-open decoder
checks each. The earlier MovieDB beta.10 also decoded two paced 120-second samples.
The new merged X-Stream plus repository guard tests passed 53/53, including
early return, no late pack mutation, cache fencing, identity and cooldown cases.
Final-package S2 standard results are recorded separately before publication.

Physical iPhone/Pixel acceptance and full language/episode-content verification
remain incomplete. Availability and resolution depend on upstream providers.

## Publication and rollback

Use existing GitHub Actions signing/publication workflow. It verifies immutable
assets anonymously before pushing the signed index. Announce only after the
workflow succeeds and public module/bundle hashes match the signed catalogue.

Rollback is a new higher-version package/bundle restoring previous behavior,
not modification of an existing release asset or a version downgrade. Previous
baseline commit: 408c0aa. Previous packages: X-Stream-1.3.2.zip and
MovieDB-0.1.0-beta.9.zip. No other module should change during rollback.
