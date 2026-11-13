# AnimeHeaven 4.1.1-beta.1 Live Phone Test

Owner explicitly approved publication for live phone testing on 13 November 2026 after the simulator limitation was disclosed. This is a live beta, not full device certification.

## Exact Package

- ID: animeheaven-v2-1; family: animeheaven_v2; identity: SP-VID-003-ANIMEHEAVEN; number: 3.
- Version: 4.1.1-beta.1; SHA-256: 48c550e4961f3c142c67c415924cc6cf13eefc281870645d9707c1d62ce53125.
- Old 4.1.0 SHA-256: 7a818d060c496a610afd92f7b57421c7285c9915b0c3683b2762e3a6def710cd.
- Bundle 164 changes only the AnimeHeaven inner ZIP from bundle 163; all other inner bytes are preserved.

## Repair And Evidence

The old parser selected a commented-out 3.712-second branding clip before the active episode player. The extracted frame matched the owner's screenshot. The candidate ignores comments, prefers the canonical active video, chooses the main poster instead of related artwork, and tightens episode tokens and caller wait limits. In-flight HTTP transport is not cancelled by those limits.

Exact-package checks: 16/16 offline regressions, 27/27 unique short A/V samples across ten titles, 10/10 poster responses and three additional repeat opens passed. Real Flutter module operations passed; download verification was a link probe, not a full offline download. Japanese audio detection passed.

Both standard S2 runs formally FAILED with SIMULATOR_TIMEOUT and SIMULATOR_SUMMARY_MISSING. First: 2026-11-12T23-45-40-849Z_s2_animeheaven-v2-1_d362d397. Same-byte retry: 2026-11-12T23-55-16-850Z_s2_animeheaven-v2-1_8a769547. The retry reached a black start screenshot but did not prove advancing native playback, seeking or pause/resume. Physical-phone acceptance remains pending. Neither failure is discarded or relabelled.

## Rollback

Keep modules/AnimeHeaven-4.1.0.zip, bundle 163 and their existing GitHub releases immutable and publicly available. Manual recovery can import the old ZIP. Installed clients may refuse an automatic version downgrade: for automatic rollback, repackage the old proven source under a NEW higher module version, preserve its identity, then publish a NEW higher bundle. Do not overwrite versioned assets or decrease bundle numbers. A blind Git revert alone is not a reliable client rollback.

## Phone Checklist

1. Check module updates and confirm AnimeHeaven 4.1.1-beta.1.
2. Open One Piece episode 1: verify an actual episode, not the logo card.
3. Seek, pause/resume, close and reopen the same episode.
4. Open another show; verify the correct poster and episode.
5. If an old download contains only the logo clip, download it again; this release does not delete or repair existing files.

No app code, backend or other module implementation changes. No Discord announcement included.
