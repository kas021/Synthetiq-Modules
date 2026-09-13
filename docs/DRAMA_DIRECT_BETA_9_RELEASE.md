# Drama Direct beta.9: owner-approved public availability

The owner requested publication after receiving the production-readiness report and its explicit failures. This is experimental public availability, not a claim that production certification passed. Existing DramaCool and default/recommended module selections remain unchanged.

The ZIP is byte-identical to the tested private candidate. It retains the display name `Drama Direct (Private Prototype)` and version `0.1.0-beta.9`; no executable, identity or manifest changes were made during publication.

- Identity: drama-direct-v1 / drama_direct_v1 / SP-VID-078-DRAMA-DIRECT / 78.
- ZIP SHA-256: 0374dcafd676e190fdcda6a05016510c8f3873e1b421bc049bc9eb8814e5b1ac.
- JavaScript SHA-256: ae4389b73ee1f867d30a828b6f9cdd51f45a489ff2243d65866fe572a967f670.
- Regression: 25/25 pass.
- Final 30-query plan selected 29 exact identities and probed 85 first/middle/latest episodes: 73 valid media candidates, 12 failures. One cut edition was not identified and was not silently replaced by its uncut edition.
- Failures: 11 provider responses without usable media, one repeated upstream HTTP 500. Availability can change.
- Goblin E1 native AVPlayer simulator: advanced 60 seconds and resumed after long seeks. GATE24 E7 failed in the app's local HLS proxy when writing Japanese audio names as non-UTF-8 text. The corresponding local HTTP 500 is not an upstream outage.
- A separate GATE24 media_kit simulator run stopped around 48 seconds with a TCP read error. Do not assume an encoding repair resolves that separate transport problem.
- Four short offline clips decoded with network protocols disabled; these are not complete-episode downloads or app-managed offline certification.
- Later speech samples classified Korean, Japanese and Chinese where expected/observed. Whole-episode audio, subtitle timing and physical-device behavior are not certified.
- Fresh beta.9 standard S2 returned PARTIAL: `2026-09-13T11-12-10-088Z_s2_drama-direct-v1_f1ce43a7`, Queen of Tears. Flutter runtime and first/middle/latest media checks passed. Simulator video advanced for 120 seconds with pause/seek checks, but its audio device failed initialization (no audible output). Some subtitle languages remain unknown to the classifier and the opening audio sample had no usable speech. This does not override earlier GATE24 and Goblin language/transport failures.

## Dependencies and limitations

The device uses MegaVid catalogue and episode APIs followed by fresh provider playback lookup. The recorded host/redirect sweep required no DramaCool, AniKoto or AniCrowd requests. MegaVid still proxies an opaque upstream; this is not origin-CDN independence or a guaranteed fallback network.

Home browsing is a finite curated feed. Original audio and available source subtitles are exposed, not invented English dub availability. Some episodes remain unplayable. No app or backend repair is included. This candidate must not be advertised as fully reliable or production-certified.
