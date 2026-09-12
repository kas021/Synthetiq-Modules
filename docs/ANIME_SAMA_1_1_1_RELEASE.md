# Anime Sama 1.1.1 and temporary AnimeKai withdrawal

Owner approved public release and AnimeKai withdrawal on 12 September 2026.
Bundle 117 promotes Anime Sama 1.1.0-beta.9 unchanged except manifest version,
release track and status. Version 1.1.1 sorts above beta.9 in older app updaters.

Catalogue filtering excludes scan-only entries, including the two reported
After the School Belle / After the Moonlight Falls titles. Anime adaptations
with mixed Anime/Scans types remain. Availability work has an 18-second handler
budget, at most four concurrent checks and three panels per title. Unknown or
timed-out cards can be temporarily omitted and are not negatively cached.

Evidence inherited from the byte-identical tested JavaScript:
- 30-title frozen matrix, seed 2026091209: 142/152 one-second host AV decodes.
- Sub: 84/85; Dub: 58/67. Ten failures, six unavailable Dub cases.
- Attack on Titan search identity unresolved; not counted as a playback pass.
- Home details and episode lists: 10/10 sampled titles.
- 25 regressions passed; static package inspection passed.
- No exact candidate native/Flutter rerun; no full phone/offline certification.
- Existing playback resolver unchanged. Only supported verified host routes
  are returned, not every host advertised by the source website.

Full candidate evidence:
https://github.com/kas021/Module-Testing-PL/blob/7014b973b8ec42cf7545d98a1f566906371a1f94/ANIME_SAMA_BETA9_QA.md

## AnimeKai: deferred to the end of the queue

Remove animekai-v2 4.0.0 from the active catalogue and new bundle only. Preserve
its immutable ZIP, existing release asset and old bundles for cached indexes
and rollback. This does not remove it from devices where already installed.

The private 4.1.0-beta.5 candidate failed: 8/137 short AV decode samples
(Sub 8/76, Dub 0/61). Sampled HLS referenced image payloads and One Piece runtime
resolution failed. Keep the candidate unpublished. Revisit provider media and
compatibility with shipped runtimes after the remaining module queue. Do not
infer a future release is fixed from old search/HTTP checks.

AniWorld 1.1.0-beta.6 remains an owner-testing candidate, not promoted here.
No app, backend, account or playback-engine code changes.
