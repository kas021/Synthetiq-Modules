# STCine 1.1.1: owner-approved release

The owner approved promotion on 12 September 2026. JavaScript is byte-identical
to tested 1.1.0-beta.3; only version, release status and description changed.
Identity remains stcine-v1 / stcine_v1 / SP-VID-056-STCINE / 56.

Repairs include paginated discovery, full season mapping, bounded provider
resolution, explicit server/quality choices and source-specific captions/headers.

## Evidence and limitations

- 14/14 focused regression tests passed.
- Frozen 20+10 sample: 28/30 short host audio/video decodes, not native phone tests.
- No stream: Tomorrow Is Ours S1E1 and House Rules S1E1.
- 45/45 sampled English/Arabic subtitle files contained timing cues.
- Initial seek checks: 2/3; Interstellar timed out. Separate fresh retries
  decoded at 90 seconds on Videasy and LookMovie. Original failure retained.
- S2 standard PARTIAL: runtime/media passed and simulator video advanced about
  120 seconds, but audio-device initialization failed. Spoken language was not
  certified. Run: 2026-09-12T20-29-18-196Z_s2_stcine-v1_220cfbfd.
- Physical-device sound, full offline playback, subtitle synchronization and
  all server/quality transitions remain unverified. The app may not transfer
  subtitle metadata correctly when changing quality across providers.

This release does not claim universal availability or complete certification.
No app or backend code changed. Original stable and beta packages are preserved.
