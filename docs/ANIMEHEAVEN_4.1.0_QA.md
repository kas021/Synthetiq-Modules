# AnimeHeaven 4.1.0 release

Owner explicitly approved release after phone testing, including multiple visible servers.
Playback JavaScript is byte-identical to 4.1.0-beta.3; only stable version/track and missing icon metadata change.

Beta S2 standard: PARTIAL, run 2026-09-10T13-37-22-599Z_s2_animeheaven-v2-1_988ef626.
Exact stable package S2 standard: PARTIAL, run 2026-09-10T16-15-56-900Z_s2_animeheaven-v2-1_d0cffb5d; runtime and first/middle/latest media pass, no failure codes. Same simulator audio limitation remains.
Flutter runtime and first/middle/latest media pass. Simulator video advanced 120 seconds but audio-device initialization failed. Language analysis skipped. No claim of full device/language/offline certification.

Ten module regression tests pass. Five first-episode media probes resolved H.264/AAC. Dandadan/Death Note expose three working mirrors; Naruto backup mirrors returned 404 and were excluded. Sampled variants were 720p, not separate qualities. Burned-in subtitles unchanged.

Known limitations: incomplete long-running catalogues; no universal quality ladder or selectable subtitles; slow upstream requests may still delay resolution because the native bridge does not enforce the timeout hint. Full downloads and physical server-switching matrix remain incomplete.

The official catalogue already had a reachable PNG icon. Testing manifests lacked presentation.iconUrl, so direct/testing installs could show the connector placeholder. Stable package now carries the same verified icon URL as the official index.

Failed 4.1.0-beta.1 and beta.2 experiments were never published. Older immutable packages/bundles retained for rollback.
