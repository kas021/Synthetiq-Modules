# Module Quality Checklist — the definition of "finished"

Owner directive (2026-10-09): this checklist is the **scope for every future module** — new builds and
repairs alike. It is distilled from the day's work (Alpha Movies 0.2.0-beta.3, MovieDB 0.1.0-beta.14)
plus the established engineering rules. A module is not done until every relevant box is ticked.

Owner's own example: *"if a module returns something like a quality or video, it should basically tell
us the actual quality rather than just saying auto."*

---

## 1. Output quality — what the user actually sees

1. **Real quality labels — never a bare "Auto" when the truth is knowable.** A single-file route must
   show its real resolution (read from the media itself — MP4 `tkhd` height for direct files, HLS
   variant heights for ladders), e.g. "1080p", "816p". "Auto" is reserved for genuinely adaptive
   streams (or dimensions that cannot be read), and even then it sits beside real options, never
   instead of them. *(The Mentalist showed "Auto" while being 1920×1080 — fixed by parsing the bytes
   the module already fetched.)*
2. **Every format the source serves must play** — HLS, direct MP4/TS, anything — classified from
   **bytes**, never by suffix or content-type. Site parity is the bar: if it plays on the source's
   own site, it must play in the module.
3. **Subtitles: English first, then every language the source actually serves.** Prefer the captions
   embedded in the stream (in-manifest renditions) when present — they survive external caption
   services going down. Never fabricate, never mislabel, never silently substitute.
4. **Artwork must load.** Every card the source can illustrate gets its image — with fallback chains
   for bot-walled/dead artwork sources (a wrong image is worse than none; a blank tile is worse than
   a fallback). Proxy/cache when the source's image CDN throttles bursts.
5. **Catalogue truth:** real episode counts and ranges (verified, not assumed); real server and
   quality names (never invented); every season of a series discoverable from search, grouped and
   ordered; search results open onto playable surfaces.
6. **Honest failures.** When it can't play, say why in plain words (source empty / blocked / network)
   — never a masked, generic or empty failure.
7. **Fresh content behaves like classics** — newest episodes/titles resolve the same way; genuine
   coverage gaps are reported as source-side truth, not hidden.

## 2. Engineering guarantees (how it must behave)

1. **Payload budget:** every response stays well under the app bridge's hard **2 MiB silent
   truncation** — heavy payloads (caption bodies) budgeted with graded degradation (English kept,
   tail languages dropped first), no heavy content duplicated across server entries.
2. **Failure shapes:** failure snapshots expose **no bare top-level scalar strings** (naive pickers
   treat any string as a URL); structured error objects only.
3. **Performance:** resolves typically ≤8 s; every internal deadline <20 s; home/discovery batched
   (parallel, not sequential); caches shared and reused; rate limits parked politely; retries bounded.
4. **Identity:** titles resolve via keyless, stable sources (Wikidata etc.) — never dependent on
   scraping bot-walled pages; graceful fallbacks when a source is unreachable.
5. **Multi-provider resilience:** several independent routes per play; one dead provider must never
   dead-end playback; backups labelled honestly; alternate-language routes visible but ranked after
   English.
6. **Hygiene:** no secrets, signed URLs or tokens in logs, fixtures or reports; nothing outside the
   module's own files is touched.

## 3. Verification battery (before ANY publish — on frozen bytes)

1. Unit suites green.
2. House tester run — with known tool artifacts documented (the extension-less master classifier is
   not a module defect); **never modify a harness to make a candidate pass**.
3. Release gate: ≥3 titles (include an owner-reported one), segment-verified; first-attempt passes
   expected.
4. **Real Flutter app-runtime on BOTH app lines** (older + current) — home / search / details /
   stream / playability / download / subtitles through the genuine bridge.
5. S2 quick — read its codes; know the analyzer artifacts (frame-capture on huge direct MP4s) versus
   real signals.
6. **A sampled failure is never a defect until hand-verified on BOTH the candidate AND the current
   live version** — provider windows rotate; a coverage matrix percentage is one instant, not a
   verdict.
7. SHA before and after every run — certify exactly the bytes that ship.
8. Check the **user-visible bits in the app leg**: quality labels, subtitle menu, artwork — not just
   "resolve ok".

## 4. Publishing (production = all users)

1. Explicit owner approval for the exact bytes (or an explicit batch/conditional delegation).
2. Full rails: pre-publish tag → **one commit per module** (+ split bundle commit) → CI success →
   signed index verified (version + sha + signature) → **release asset byte-identical to certified**
   → bundle contains the ZIP (inner-sha) → published-URL repo gate → icon live → raw CDN flipped.
3. Rollback rail: superseded ZIP kept in `modules/`; rollback-ledger entry (old→new, commits, tag,
   recipe); **rollbacks roll FORWARD** (never a bundle downgrade).
4. Testing side: candidates superseded by a production publish are retired by the testing mirror's
   policy — coordinate, never clobber the mirror maintainer's work.
5. Owner report in plain words: **what was broken → why → what changed → verification → what's
   needed from you.**

## 5. Process rules (standing)

- **One module at a time**; fixes are **module-side only** — app-side needs get a thorough write-up
  (problem → evidence → exact proposed change → impact → risk) and the owner decides; app code is
  never edited here.
- Verify "which version is live" from the signed index before debugging anything.
- Provider flakes are not defects: re-probe at another moment before changing code.
- Every fix ships with an updated QUEUE entry, a ledger entry, and a release note.
- After publish, verify the **served** bytes — not the local copies.

---

*Canonical copies: this file (repo) and `references/module-quality-checklist.md` in the
synthetiq-module-engineering skill (operational copy for agents).*
