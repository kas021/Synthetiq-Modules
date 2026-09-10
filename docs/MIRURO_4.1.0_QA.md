# Miruro 4.1.0 release - 2026-09-10

Owner tested the beta and authorized release after a broader probe. Stable JS
is byte-identical to 4.1.0-beta.1. Only manifest version/track changed.
No app, backend or other module source changes.

## Probe results

Ten shows, episode 1, both SUB and DUB: 20/20 resolved and 20/20 primary routes
contained video and audio in ffprobe. Six focused module regressions also passed.
Titles: Attack on Titan, Death Note, Naruto, One Piece, Bleach, Jujutsu Kaisen,
Demon Slayer, Chainsaw Man, Fullmetal Alchemist Brotherhood, Hunter x Hunter 2011.
See MIRURO_4.1.0_PROBE.json for exact identities and per-case/provider evidence.

These are Node module-flow and media probes, NOT 20 native playback tests,
spoken-language verification, full downloads or full-episode caption checks.
The initial strict-extension ffprobe run rejected 19 routes. Repeating with the
existing S2 HLS demuxer flags passed 20/20. This does not repair platform players
that do not accept the provider's nonstandard HLS segment naming/content types.

No sampled route exposed selectable captions. Owner confirmed English burned-in
SUB captions, also visible in the previous AoT sample at 120 seconds. Missing DUB
captions are optional and are not treated as a failure.
Most cases returned one resolved stream option; One Piece SUB returned four.
The website advertised three servers per language but not all embed families
are supported by the current resolver. Do not claim every website server works.

## Earlier native/runtime evidence and limits

S2 standard: PARTIAL, run 2026-09-10T12-26-33-413Z_s2_miruro-v3_e3bcc526.
Runtime/media passed. Simulator video advanced 120 seconds but its audio-device
initialization failed. Spoken-language analysis produced no usable evidence.
Owner phone feedback is separate from simulator evidence.
Full offline playback, other devices, later episodes and fuzzy provider title
matching remain further QA areas. No full S2 PASS or universal reliability claimed.

Additional sources/DUB captions will be explored separately without changing
the approved release. Immutable old packages remain available for rollback.
