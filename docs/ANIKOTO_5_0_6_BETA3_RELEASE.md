# AniKoto 5.0.6-beta.3 Live Beta

Owner approved publication on 2026-11-10 after reviewing the private repair results and retained certification limits. This is a live beta, not full S2 or physical-device certification. No Discord announcement is part of this release.

- Package SHA-256: `58c85822abc9bb59430ff8c9f8e6d2580973f43628a2828b50822fcc0ce72d4e`.
- Identity unchanged: `anikoto-v4`, family `anikoto-v3`, `SP-VID-036-ANIKOTO` / 36.
- Four scoped fixes: no URL-ID guessing; endpoint/verified-ID/mode/header-scoped payload caching; contradictory fallback-language rejection; retention of external-rendition HLS masters.
- Successful-cache/probe reuse remains, with invalid-payload recovery, original-expiry semantics and late-response ownership checks.
- Targeted safety/master/cache checks: 19 passed. The inherited primary-flag-false backup-only-Dub fixture still fails on this candidate and the prior live build; it is not counted green.
- Real downstream outage checks on three episode-one Sub cases: all tracked embed pages unavailable returns honest errors; only first embed page unavailable recovers correct sampled content in all three. The triggering read failures are injected; provider media is real. No natural incident-rate claim.
- Ten-query broad comparison: 31 cases per language per build, 124 total attempts. Short decodes: Sub 30/31; advertised Dub 30/30, matching live beta.7. Not full-episode or population reliability certification. The Sub failure is the selected Sibling's Bond film; One Piece 1180 correctly has no advertised Dub.
- Observed median lookup times in the paced local comparison: Sub 2380.5 -> 1496 ms; Dub 3422.5 -> 1900 ms. Not a native startup guarantee.
- Six reopen checks, including after more than ten real minutes, pass sampled segment/frame consistency.
- S2 quick formal grade remains FAIL on the same opening-language flag as the live control. Runtime and media probes pass; later speech samples confirm Japanese Sub and English Dub. Native V9/phone acceptance remains unverified. No tester/app source was edited to alter grades.

## Publication Scope

Only the AniKoto catalogue package changes; bundle 162 contains the same other 37 exact module payloads. Default selections remain unchanged. The existing workflow signs and publishes immutable assets and the repository index; no signing configuration changes are needed.

## Rollback

Prior signed main: `5d4b3e110e49e6cdba36f7dc596a97d8eb90aa5e`, bundle 161. Prior AniKoto beta.7 SHA-256: `b7715c9dd4470a32f33f385a67ae9f71d5fce57ae1db94d080392ffd488a9bd7`.

Retain old ZIP, release tag and bundle unchanged for manual recovery. For installed beta.3 users, issue the prior source with a new higher semantic version and a new bundle; do not overwrite published assets, rewrite tags or assume a catalogue revert forces an app downgrade. Revalidate and obtain owner authorization before executing a rollback.
