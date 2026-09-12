# MegaKino 1.1.1

Owner-approved promotion of 1.1.0-beta.3. Only manifest version, releaseTrack
and moduleStatus changed; JavaScript is byte-identical to the tested beta.
Official 1.0.3 and all historical packages remain immutable.

Repairs: current domain/session handling with old saved-link compatibility;
Featured and paginated category feeds; available servers and HLS quality choices;
GX checked media-playlist selection without discarding separate audio groups.

15 fixture tests pass. 30/30 short host video/audio samples and 30/30 poster
responses pass. The matrix used beta.2, with identical playback code to beta.3;
beta.3 adds the corrected View All declaration and received separate runtime and
supplemental checks. Nine returned server routes across five titles decoded with
explicit HLS parsing. Four Mutiny qualities and seeks at 10/600 seconds decoded.
A bounded saved clip decoded using file-only access; not full-app offline QA.

Final beta.3 S2 standard FAIL / LANGUAGE_CONTRADICTION: the entire sampled
transcript was [MUSIC], labelled English. Later Mutiny and Inception dialogue
samples detect German. Runtime and all three media probes pass; simulator video
advanced 120.5 seconds but reported audio-device failure/no sound. One Piece first
probe failed; later fresh episodes 1/5/8 decoded. Failures are not erased by retries.

This approval is not full certification. Physical-device sound, long playback,
app downloads/offline and all server/quality switches remain unverified. No external
captions were returned in the 30-case sample. Source labels are not a guarantee
that every title has verified German dialogue. No app/backend changes.
