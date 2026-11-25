# Optional Player V9 Live catalogue

Import this directory's signed `repository.json`, not a raw module ZIP.
The Settings repository flow requires Player 9.0.112 or later. There is no
automatic registration, default source switch or change to the root feed.
Package URLs are pinned to the release input commit. A raw ZIP has no
repository version gate and is not a supported distribution path for old apps.

| Source | Two-window end-to-end | With sustained and identity checks |
|---|---:|---:|
| DW Live beta.4 | 10/10 | 14/14 |
| Public TV beta.5 | 10/10 | 15/15 |
| Public Sports beta.5 | 8/10 | 14/16 |

Station identities were checked on all 12 channels. For FUEL TV, the default
FFmpeg HLS reader rejected extensionless segments twice; native macOS AVPlayer
subsequently produced frames for 60 seconds on the same package. No transport
restriction was relaxed. This is not iOS/Android device or regional coverage.
TVApp and DaddyLive are not included.

Previous gate: TEST main d307d9fb7986aa75962a6127b384fff5f98b9521, public
optional index SHA-256 9b9c3b83a8d1d8060a072db7c4a0c225c09f5ae2d8c3507f90b7affe28a12561.
Public V9 import was checked fresh and alongside the existing MAIN 170
installation. The same three exact package bytes are used here.

The existing protected publication job signs this separate index only after
anonymous downloads from the input commit match the recorded hashes. A normal
root catalogue release uses its original builder. If the scoped signing run
fails, do not replace it with a community index or the TEST credential.

For an operator-approved rollback, add **only** `v9/live/disable.json` in a
forward commit with `{"operation":"disable","expectedIndexSha256":"..."}`
using the digest of the currently served signed index. The same job verifies
the old official signatures, signs a disabled index, and preserves all immutable
assets and the root feed. Verify public bytes after the run. Do not force push,
delete releases or uninstall existing sources. Future active generations need
new immutable packages, individual certification and a reviewed version advance.
