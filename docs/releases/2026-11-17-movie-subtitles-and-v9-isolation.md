# Movie Subtitles Fix and V9 Backup Isolation (Bundle 167)

On 2026-11-17 the owner asked for the subtitle fixes to be tested independently and then published to all users. Each package below passed an independent tester run plus the owner-side checks.

## Packages

| Module | Old → New | SHA-256 |
|---|---|---|
| `movy-v1` | 0.1.0-beta.4 → 0.1.0-beta.5 | `ce2117267331d270dc03661952533b11d6c314ba2614d34587a02c8401534473` |
| `moviedb-wiki-v1` | 0.1.0-beta.26 → 0.1.0-beta.27 | `f05fc55ccdf874a17bbd34b9f4e0f6c02e4075a2593a8c8f2ddb4500ab42e2d9` |
| `xstream-v1` | 1.3.5-beta.1 → 1.3.5-beta.2 | `627f5f2d648c9c76ae3928ff6906562d1171199337d596e492dd1b8757911d2f` |

Bundle 167 (`a2064fc4270ee3060256e3e8dc9e68f5e98c60ea81fd06bcd4a2dabe6784d4a6`) replaces only these three inner ZIPs from bundle 166. Module identities are unchanged.

## Root Causes

**1. Movy subtitles missing** (reported on Prison Break S1E1 "Pilot").
- Movy stops asking servers once two first-wave servers return video. Those servers (Miami, Boise, Atlanta, Phoenix) often carry no subtitles.
- The second-wave servers (Oakland, Vegas, Reno, Seattle) do have English, but they were never asked.
- When they were asked, their real WebVTT files are served from URLs named `video.m3u8`, and the module discarded every `.m3u8` subtitle URL.

**2. V9 handler takeover in X-Stream and MovieDB.**
- The embedded Movy backup relied on a shadowed `globalThis` for isolation. The V9 app's JS engine does not honour this.
- So Movy's six export lines replaced the host module's `searchResults`, `extractDetails`, `extractEpisodes` and discovery handlers.
- In V9 these modules showed movy.sx results, and episodes failed: "unrecognized episode reference".
- Node-based tests did not reproduce this.

**3. MovieDB site outage.** moviedb.wiki went down during testing (Cloudflare 520/521, then no answer). Each page request waited about 60 s before the existing TMDB fallback ran.

## Fixes

**Movy 0.1.0-beta.5**
- Subtitle URLs named `.m3u8` are fetched once per host per list. They are kept as VTT when the body is WebVTT, and excluded when it is an HLS playlist.
- When the playable servers give no working English track, the second-wave servers are asked for subtitles only, with no video checks. This is at most four small requests.
- Subtitle work is capped at 1.5 s per request and about 3.5 s in total.
- Dead default English tracks are dropped (up to 3 checks), then duplicate labels are merged.

**X-Stream 1.3.5-beta.2 and MovieDB 0.1.0-beta.27**
- The embedded backup is Movy 0.1.0-beta.5 with its `globalThis.` exports renamed to a private `__movyScope` object, so it cannot write host handlers on any engine.

**MovieDB 0.1.0-beta.27 only**
- Site page requests have a hard 12 s cap.
- A Cloudflare 520-526 or no answer marks the site down for 5 minutes, so search, details and home go straight to TMDB.

## Evidence

All testing was on the V9 freeze runtime `797804dd` (9.0.106+286), from a UK connection.

**Movy**
- V9 runtime passed all stages for Prison Break, Inception and Breaking Bad.
- 21-title check: 21/21 play.
- Working English subtitles: 20/21 (before: 6/21).
- Independent check: videos 15/15 and English 15/15. One reported miss was a false alarm: the Atlanta CDN serves real MPEG-TS labelled `text/html`. That behaviour is unchanged from before.
- Timing against Whisper transcripts: Prison Break at 0:25 and 19:56, Breaking Bad at 10:08, and Dune at 10:12 all matched the cues.

**X-Stream**
- V9 runtime passed for 3 titles, with xstream.free.nf search ids. The live 1.3.5-beta.1 shows movy.sx ids and fails playability on V9.
- Independent check: videos 15/15, English 14/15.

**MovieDB**
- V9 runtime passed for John Wick and Prison Break while the site was down, with moviedb.wiki or mdb ids. The live 0.1.0-beta.26 shows movy.sx ids and fails the stream on V9.
- 21-title check with the site down: 21/21 play.
- Working English subtitles: 13/21 (before: 5/21).

## Known Limits

- **Wednesday on Movy:** no working English anywhere on Movy's servers.
- **Shared subtitle quota:** X-Stream, Alpha Movies and the `one.synthetiq.uk` subtitle endpoint return sub.wyzie.io links. That service has a shared limit of 1,000 requests per day, reset at midnight UTC. When it is exhausted, those subtitles fail for all users. Not fixed here: it needs a paid key or a backend change, which is an owner decision.
- **MovieDB MoviesAPI route:** returns no subtitles.
- **Alpha Movies:** has no subtitles today. Its primary subtitle service, subtitles.shegu.st, is down (Cloudflare 1033/530), and its fallback is the quota-limited service above. Not changed in this release.
- **Start time:** when the first servers lack English, Movy start-up can take up to about 3.5 s longer.

## Rollback

- Previous ZIPs, bundle 166 and their release tags stay published.
- For automatic rollback, repackage the old source under a higher version and publish a higher bundle.
- Note that the previous X-Stream and MovieDB versions are broken on V9.

No app code, backend or other module changes. No Discord announcement included.
