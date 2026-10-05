# X-Stream 1.3.2 — release note (2026-10-05)

Owner-approved fix for a playback report on app 8.6.7+148 (iOS): a title could report
"This source could not provide a working video link" **while a perfectly good route existed**.

## Root cause

`collectStreams` waited on `Promise.all` over all five provider legs, each with its own retry
budget. The module's fast providers are currently dead upstream (`dl.vidzee.wtf` v1 → HTTP 500
after 30 s, v2 → 403/`Blocked`; `api.speedracelight.com` → 502), so their retries held the resolve
open long after the healthy provider had returned a verified route.

Measured on the live 1.3.1 bytes, same title (Moana), same machine, same provider:

| build | cold resolve |
|---|---|
| 1.3.1 (published) | **15.6 s** |
| 1.3.2 (this release) | **3.3 s** |

On device that crossed the app's resolve budget, so a real route surfaced as a failure.

## Change (JavaScript only)

- `collectStreams` returns the **first verified route** instead of awaiting every provider's retry
  budget. The early exit fires only on a route that already survived the provider's own probe
  (`!segmentDead && segmentProbeOk !== false`), and in-flight legs are back-filled with their empty
  value so the downstream merge/dedupe/ranking path is untouched.
- Per-provider budgets retuned: the working provider (lookmovie) gets headroom, providers answering
  hard errors get shorter windows.

No identity, route, server-list or provider-behaviour change. `moduleVersion` 1.3.1 → 1.3.2; lineage
fields untouched.

## Certification on the published bytes

- Release gate (exact ZIP, sha256 `be4bdc7631ece38d8d70c5cd86211941d778c944e5ce3ff963eeea84f70ceb31`):
  **ALL_PASSED** — Package/Home/Search/Details PASS, Streams **2/2 `ts_media`** on `moana` (movie) and
  `breaking bad` (62 episodes).
- 12-title audit matrix (`module-reports/xstream-audit-2026-10-05/AUDIT-XSTREAM.md`): 11/12 titles
  resolve, median resolve 3.5 s.

## Known limits (unchanged, source-side)

- HD renditions on this source are **MKV remuxes** (2160p/1080p via vidzee v2) — not playable in the
  iOS player, so the module refuses them rather than exposing a broken quality.
- videasy (the multi-quality HLS provider) is behind DDoS-Guard with its seed API at 502.
- The source's own site `xstream.free.nf` has an expired certificate and `movie.php` returns 404;
  the module runs on TMDB + third-party providers.
- Long-series depth: One Piece ep 1 resolves, mid/late episodes currently return no route.
