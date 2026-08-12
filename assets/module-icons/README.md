# Module icons

These small PNG files are presentation-only metadata for newer Synthetiq
Player builds. They are not included in module ZIP packages or bundles.

- `synthetiq.png` is exported from the canonical Synthetiq favicon asset.
- Other files are cached copies of the corresponding public site's favicon,
  used only to identify that source in the source picker.

`scripts/build_repository.mjs` requires every catalogue `iconUrl` to use HTTPS
and point back to this directory in the official repository. Older app builds
ignore the optional field and continue using their existing generic icon.
