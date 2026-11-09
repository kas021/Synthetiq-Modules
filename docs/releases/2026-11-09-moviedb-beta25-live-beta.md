# MovieDB beta25 Live Beta

Owner explicitly approved publication as a live beta on 2026-11-09 after reviewing the incomplete certification caveat. This is not a fully certified player/device release. No other movie module changes.

## Packages

- Module: `moviedb-wiki-v1`, `0.1.0-beta.25`.
- ZIP: `modules/MovieDB-0.1.0-beta.25.zip`.
- SHA-256: `fccdb67f028429c9fd7f497cc90fda373efb9af7049a88577c29b869d3cc7e9a`.
- New bundle: `bundles/Synthetiq-Module-Bundle-161.zip`, containing the same 38 module identities as bundle160. All other inner ZIP bytes are unchanged.
- CI owns signing and publication of the versioned assets and index. Public download hashes and served index must be verified after the workflow finishes.

## Changes And Limits

The module uses the current player route, preserves captions arriving within the existing resolve deadline, refreshes captionless cache entries and protects explicit fresh retries from older requests. Title/season/episode checks and route-specific headers are retained.

Local short-decode and English-caption results allow at most three attempts per case: development39/42 video,38/42 captions; separate holdout9/10 for both. First-attempt captions were29/42 and5/10. Exact-byte V9 Flutter runtime passed; automatic-format FFmpeg/S2 and physical-device acceptance are not claimed passed. Results do not verify full-length playback, subtitle synchronization, all advertised languages or older public-app compatibility. Source availability can change.

## Rollback Record

- Pre-release live main: `816c816b97a1b792d0a36fd23c7fdb0c8d7958b2`.
- Previous module: `modules/MovieDB-0.1.0-beta.15.zip`.
- Previous module SHA-256: `78b3b4afdd3b372227ee6a4f2de3336b25a8f389593353aee8e6f315f05f0cbb`.
- Previous bundle160 SHA-256: `499334cc0a0059e0e3b885f1adfb920ed1436fc59bd969dcd76dd3a890a9d2b9`.
- Retain all prior ZIPs, release tags and bundle160. Do not overwrite immutable assets.
- If an automatic rollback is needed, repackage the prior source with a higher module version and publish a higher bundle version after owner approval. A Git revert alone may not be accepted by clients' downgrade guards.

No Discord announcement is part of this publication.
