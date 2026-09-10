# Synthetiq Movies 1.2.5

Owner explicitly approved release after phone testing on 2026-09-10 and asked
for no further code changes. JavaScript bytes are identical to testing
1.2.4-beta.5. Only version/release metadata differs. No app code changed.

Evidence: 20 regression tests passed. Real Flutter runtime parsed 43 subtitle
tracks for Silo S1E1, including Arabic. Arabic file HTTP/text check passed.
Standard S2 run 2026-09-10T11-18-16-357Z_s2_synthetiq-movies-v1_16827fea
passed runtime, first/middle/latest media checks and simulator playback.

Important: the overall automated grade was FAIL / LANGUAGE_CONTRADICTION for
several other subtitle languages. English and Arabic subtitle checks passed.
The detector has limited language coverage; flagged tracks need further review.
This is an owner-approved release, NOT a claim of full S2 certification or
all-language timing accuracy. The audio transcription was too short to count
as strong independent English-audio evidence.

No background cross-provider 4K enhancement is included. That remains separate
work requiring an app-supported enrichment flow and per-quality subtitle state.
Keep the previous immutable release for rollback through a new version.
