# WeebCentral 4.1.13 chapter-order repair

## Cause and change

WeebCentral's full chapter list is newest-first. Version 4.1.12 re-sorted it
after extraction, but its numeric parser recognized only Chapter/Chap/Ch/Act.
Labels such as `# 201` had no numeric value and fell through to lexical title
sorting. To Your Eternity consequently showed `# 1`, `# 10`, `# 100` instead of
the source's `# 201`, `# 200.4`, `# 200.3` sequence. The same risk applied to
Episode/Collar labels and mixed Special/Chapter lists.

Version 4.1.13 preserves the source order and still records numeric metadata
for Chapter, Chap, Ch, Act, Episode, Ep, Collar, and `#` labels, including
decimal and zero values. It does not relabel Special or Volume entries. Module
ID, image content type, family, identity number, and all URL/image extraction
paths are unchanged. Older immutable ZIPs remain untouched.

## Verification before release

- Node fixture tests: packaged bytes match the tested source; `#` labels,
  decimals, zero, Chapter/Act, Episode/Collar, equal numbers, Special and
  Volume cases passed.
- App-like module harness: To Your Eternity returned 209 unique chapters in
  source order, first `# 201`, `# 200.4`, `# 200.3`, `# 200.2`, `# 200.1`;
  last `# 4`, `# 3`, `# 2`, `# 1`.
- Further chapter-list samples passed: Yotsuba (113), A Silent Voice (63),
  Nononono (142), Sundome (76), The Beginning After the End (254), Look Back
  (1), The Law of Ueki (157), and I Failed to Oust the Villain (150). The last
  now begins with `Special 41` and ends with `Chapter 1`, as the source does.
- Real Flutter image runtime: candidate ZIP imported and loaded; To Your
  Eternity search, details, 209 chapters, 24 images on the first chapter,
  first-image HTTP/content check and download probe passed.
- Independent real Flutter QA passed search, details, chapters, and reachable
  first images for To Your Eternity, Berserk (403 chapters), One Piece (1,194),
  and Dandadan (248). The v4.1.12 control reproduced the lexical-order defect.
- Bundle 129 contains the 41 catalogue-named packages and the new WeebCentral
  ZIP has exactly `module.json` and `index.js` at its root.

This is a chapter-order repair, not certification of every source title or
every image page. Upstream removals and network blocks can still affect
individual series. Public signed-index, release-asset and downloadable-bundle
verification must be completed after the publication workflow succeeds.
