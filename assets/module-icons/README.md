# Module icons

These PNG files are presentation-only metadata for newer Synthetiq Player
builds. They are not included in module ZIP packages or bundles.

Each image is taken from the corresponding site's own logo, touch-icon, or
favicon asset. Search-engine-generated replacements are not used. Synthetiq
products use the canonical square-safe Synthetiq logo master.

Direct logo sources verified on 2026-08-12 include:

- AniKoto: `/AnikotoTheme/assets/images/favicon.png`
- Anime-Sama: the site's official `logo_icon.png`
- Atsu: `/favicon/apple-touch-icon.png`
- DramaFun: `/favicons/android-icon-192x192.png`
- Senshi: `/assets/favicon-3ErN9bbp.ico` converted losslessly to PNG
- STCine: `/icons/icon-192.png`
- ToonTales: `/wp-content/uploads/ToonTales.png`

Other entries use the corresponding site's verified first-party icon retained
from the previous audit because the origin currently blocks automated asset
downloads. X-Stream uses its module brand mark because it aggregates multiple
upstream sites and has no single source-site identity.

`scripts/build_repository.mjs` requires every catalogue `iconUrl` to use HTTPS
and point back to this directory in the official repository. Older app builds
ignore the optional field and continue using their existing generic icon.
