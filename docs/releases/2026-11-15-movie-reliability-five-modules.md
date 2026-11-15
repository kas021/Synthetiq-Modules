# Movie Reliability Update — Five Modules (Bundle 165)

Owner explicitly asked on 2026-11-15 to publish the movie-module reliability fixes to the main repository for all users. These are beta packages: exact-byte Flutter runtime checks passed, physical-device acceptance is not yet done.

## Packages

| Module | Old → New | SHA-256 |
|---|---|---|
| `xstream-v1` | 1.3.4 → 1.3.5-beta.1 | `d10a08fba1403a27a9ef24646b9ddbeffda43d151f4d8ca45afc43260fce07ac` |
| `moviedb-wiki-v1` | 0.1.0-beta.25 → 0.1.0-beta.26 | `0ff223883cbdf455544227a431d77886d4b00802a9e2692c0361a7bab53b4686` |
| `yflix-v1` | 1.1.2 → 1.1.3-beta.2 | `9054a75b9f2700f567468c8e50091638a048810d788b1df5d3444fa6cd02b683` |
| `streamingunity-v1` | 1.0.4 → 1.0.5-beta.3 | `a2e63ae3f05b2b76a5370f6514875de05577e321fecba20e140c1becd12b4863` |
| `megakino-v1` | 1.1.5 → 1.1.6-beta.2 | `e34aed6a9b9b212b553644f43f8ce45216d0f9ccef87831c1789c3d12130bbb6` |

Module ids, family ids, identities and identity numbers are unchanged.

Bundle 165 (`e12a574dd4fcbdc59a2a0c2c87f272b4610d15b9f69bb8cbc3e16515be723798`) replaces only these five inner ZIPs from bundle 164; the other 34 inner ZIPs are byte-identical.

## Reliability Evidence

Fixed 20-title set: 12 films plus the first episode of 8 series. A title counts only if search → episodes → stream succeeds and the HLS playlist plus its first media segment (or a ranged MP4 read) load. Measured from a UK connection.

| Module | Before | After |
|---|---|---|
| X-Stream | 5/20 | 20/20 |
| MovieDB | 6/20 | 20/20 |
| yFlix | 0/20 | 20/20 (final bytes) |
| StreamingUnity | 0/20 | 20/20 (final bytes) |
| MegaKino | 0/20 | 16/20 |

Each exact package also passed ZIP inspection and the real Flutter `flutter_js` runtime contract (home, search, details, episodes, stream, playability, download probe). yFlix and StreamingUnity passed for both a film and a series.

## What Changed

- **X-Stream, MovieDB:** when the provider's own route returns nothing playable, an isolated backup resolver is tried by TMDB id. It returns original audio only and is never used for Dub requests.
- **yFlix:** yflix.ws returns HTTP 451 in the UK. Search, details, episodes and Home fall back to TMDB; playback resolves by IMDb id. The dead Videasy route is disabled.
- **StreamingUnity:** the site and VixCloud host are blocked or offline. The catalogue uses TMDB; playback uses VixSrc and only returns Italian-audio streams, labelled Dub. The manifest description and language now say Italian.
- **MegaKino:** follows the move to megakino28 and probes the next numbered hosts. German dub is still never returned for a Sub request.

## Known Limits

- X-Stream, MovieDB and Movy now share one backup provider. An outage there affects all three at once.
- yFlix and StreamingUnity links saved from the old sites may not resolve where those sites are blocked.
- CimaClub (5/20) is not changed. The source no longer carries most tested titles and its MixDrop links are deleted; module code cannot fix that.

## Rollback

- Pre-release main: `a713a2e9cb7a72a3020d593f8f7a9f2e4db5ef82`; bundle 164 stays published.
- Previous ZIPs (`X-Stream-1.3.4`, `MovieDB-0.1.0-beta.25`, `YFlix-1.1.2`, `StreamingUnity-1.0.4`, `MegaKino-1.1.5`) and their release tags stay immutable and available.
- Clients may refuse a version downgrade. For an automatic rollback, repackage the old source under a new higher version and publish a higher bundle. A Git revert alone is not a reliable client rollback.

No app code, backend or other module changes. No Discord announcement included.
