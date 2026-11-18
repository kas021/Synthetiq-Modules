# Documentary Area 1.0.0-beta.1 (Bundle 168)

On 2026-11-18 the owner asked for the working documentary sources to be checked and released. Of the three sites reviewed, only documentaryarea.com passed:
- ihavenotv.com plays through an obfuscated third-party player.
- rocumentaries.com is a directory of YouTube and Vimeo links.

## Package

- Module: `documentaryarea-v1` 1.0.0-beta.1.
- Identity: family `documentaryarea_v1`, `SP-VID-288-DOCUMENTARYAREA`, number 288.
- ZIP: `modules/DocumentaryArea-1.0.0-beta.1.zip`, SHA-256 `db4657bc3537e55832cedf51c796cd2b952f32c1e0c66dd2a2a1ad008edf2c49`.
- Bundle 168: SHA-256 `95c24a3b4b3d66838731b160ba1ce799f4b5b11ade60bf0ddf3f4918a844f202`. It is bundle 167 plus this ZIP; the other 40 inner ZIPs are byte-identical.
- Icon: `assets/module-icons/documentaryarea.png`, the site's own `/Favicons/apple-icon-180x180.png`.

## Behaviour

- **Catalogue:**
  - Home sections: recently added, most viewed, and genres (History, War, Nature, Wildlife, Space, Science, Biographies, Ancient).
  - Pagination is 0-based, as on the site.
  - Search uses the site's search, with title matches ranked first.
- **Session:**
  - Each play token belongs to a PHP session.
  - The module picks its own session id and sends it on every request, so the site never sets a cookie in the app's shared store.
  - The site uses the first `PHPSESSID` when several are sent, which is why this matters.
  - The same id is returned as a `Cookie` stream header, and in `cookies`, for playback and downloads.
- **Files:**
  - Every file the page lists for an anonymous visitor (SD, HD or both) is range-probed with that session.
  - Only files that serve video are offered, HD first when available.
  - A file locked to subscribers would fail this check and be left out.
- **Subtitles:** the site's own SRT tracks, labelled by language, English first.

## Evidence

- **V9 runtime.** All stages passed on the V9 freeze runtime `797804dd` with the app's real cookie store:
  - Tickled, Musk and Planet Earth III (SD);
  - Dawn of Civilisations (HD-only);
  - a final-build re-run of Tickled.
- **15-title check:** 15/15 sampled documentaries served real MP4 bytes and working English subtitles. The sample covered recent, popular, history, war, nature, space, biographies and search.
- **Simulator:** V9 native player on a fresh iOS Simulator. Planet Earth III streamed for 2 minutes (6.3 s → 126.9 s) with no buffering and the full duration detected.
- **Download:** Tickled downloaded completely with the module's headers: 595,541,922 bytes, 1:29:15.
- **Subtitle timing:** at 10:00, the Whisper transcript matched the SRT cues at 10:01–10:06.

## Known Limits

- **Offline-in-simulator playback was not re-run.** Two attempts timed out in the Xcode build before the test started. The downloaded file was instead decoded in full. Offline playback of a local file in the V9 player was proven earlier for FRAnime.
- **Free-tier limits:** any daily or rate limit on the free tier is unknown.
- **Series:** episodes are listed as separate titles, as on the site.

## Rollback

Removing the catalogue entry in a higher bundle stops new installs. Do not overwrite versioned assets.

No app code, backend or other module changes. No Discord announcement included.
