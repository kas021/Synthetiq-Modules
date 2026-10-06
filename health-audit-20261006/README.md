# Movie reliability release candidate

This directory contains tests, a frozen four-title regression sample, redacted
results, and an UNSENT Discord announcement draft. It is not proof of publication.
See `../docs/MOVIE_RELIABILITY_20261006.md` for release status and limitations.

## Regression tests

From the module repository root:

```sh
node --test health-audit-20261006/*.test.cjs scripts/public_release_guard.test.mjs scripts/anikage_module.test.cjs scripts/weebcentral_chapter_order.test.cjs
```

The cache/media tests are the MovieDB subset of the previous repair suite,
retargeted to the exact release source. Unrelated Alpha and DramaCool tests
remain in their original app checkout; they are not part of this release.

## Device acceptance checklist

Use MovieDB 0.1.0-beta.12 and X-Stream 1.3.3, without reinstalling or clearing data.

- Search The Mentalist and open S1E1. Check picture and audible sound.
- Close playback, reopen the same episode, and repeat three times.
- Leave the detail page for several minutes, return, then play again.
- If a link fails, use Fresh Retry and check whether playback recovers.
- Try a middle and final episode; confirm the correct episode, not just video.
- Try Inception and Fight Club, including pause/resume and forward/backward seek.
- Select another available quality/server. Verify that captions and audio still
  belong to that selected route. Missing provider qualities must not be invented.
- Try subtitles when offered and a title without subtitles. Missing subtitle
  metadata must not prevent the video starting.
- Repeat on iPhone and Android; simulator video is not physical audio acceptance.

Record module version, title, episode, device, and whether the attempt was a
fresh retry. Do not include signed stream URLs or authentication headers in
public bug reports.

## Publication gate

Re-fetch main, confirm the proposed bundle number is still unused, check exact
ZIP hashes against the tested artifacts, and review all S2 failures and caveats.
Only then use the existing signing/publication workflow. Verify public assets
and the signed index before sending the announcement. Never rewrite an existing
release ZIP; rollback uses a new higher version.
