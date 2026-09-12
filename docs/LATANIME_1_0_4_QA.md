# Latanime 1.0.4 - owner-approved limited release

Approved 2026-09-12 after disclosure of 23/30 successful short AV decodes.
This is not a fully certified catalogue. Official 1.0.3 package remains immutable.

SHA-256: a9411a599d85d080cfba6dc467826bfda944386b6ceace77265ce5667e2ffa4e

Changes: fix current details-poster markup and lazy episode images; expose
resolved server alternatives with per-route headers. Legacy fields remain.
No app code or new extractor changes.

Six fixture tests pass. Thirty cases cover 29 unique titles: 25 resolve and 23
decode short video/audio samples. The baseline also decoded 23/30. Five cases
had no HTTP-resolved stream; two CDN media reads timed out. Host tests cannot
exercise the browser-assisted fallback, so these do not prove all device routes
fail. Language and identity were not verified across all thirty cases.

S2 standard run 2026-09-12T00-58-25-939Z_s2_latanime-v1_6ba5870b:
Boruto simulator playback, seek/pause and Spanish audio evidence passed. First
and middle media samples passed; latest media sample failed STREAM_DECODE_FAILED.
Do not interpret the tool's top-level PASS as all-samples success.

Failed matrix cases: Dr. Stone S4 Castellano E37 (timeout), Overlord: El Reino
Sagrado Castellano E1, Gintama: Yoshiwara en llamas Castellano E1, Dragon Ball Z
Kai: The Final Chapters Latino E69, Sailor Moon Cosmos Castellano E1, InuYasha:
El Acto Final Castellano E14 (no HTTP routes), Gurren-Lagann Castellano E7
(timeout). Existing 1.0.3 remains available for rollback.

Physical iPhone/Android, full download/offline, broad sustained playback,
browser-only hosts and in-app server switching remain unverified.
