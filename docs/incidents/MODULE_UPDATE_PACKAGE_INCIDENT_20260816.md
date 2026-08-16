# Module Update Package Incident Report

Date: 2026-08-16

## Summary

Users checking for source updates received a `Source update issue` dialog.
The dialog combined two different conditions:

1. Kartoons 1.1.5 was a genuinely invalid install package.
2. Miruro 4.0.0, Anime-Sama 1.0.8, and AnimeAV1 1.2.3 were already
   installed at the current catalogue version, but the Player displayed that
   harmless no-op as a failed update.

These conditions must not be diagnosed or repaired as if they were the same
problem.

## User-visible symptoms

Kartoons reported:

```text
Update failed during verify_package:
Module update stage "package_inspect" failed:
FormatException: V2 module zip must contain exactly 1 JSON file.
```

The other modules reported:

```text
Update failed during eligibility:
Bad state: Installed module is already up to date.
```

## Root causes

### Kartoons package failure

The published Kartoons 1.1.5 ZIP contained four files:

```text
module.json
index.js
RELIABILITY_REPORT.json
RELIABILITY_REPORT_CLEAN.json
```

The two reliability reports were development evidence, not runtime module
files. Their `.json` extension caused the Player's strict V2 package inspector
to find three JSON files instead of one manifest and reject the update.

The publishing pipeline found a valid manifest, but it did not enforce the
same exact JSON-file count as the Player. This validation mismatch allowed the
bad package to reach the live catalogue.

### False failures for current modules

Miruro, Anime-Sama, and AnimeAV1 were already installed at the versions in the
signed catalogue. A stale update notice could survive long enough to reach the
batch installer. The installer correctly detected that no newer package was
eligible, but represented that result as an exception. The batch UI then
presented the exception as a source failure.

Their installed packages were not corrupt and did not require replacement.

## Remediation

### Live module repair

Kartoons 1.1.6 was published as a package-only correction:

- Module identity is unchanged: `kartoons-v1`.
- Runtime JavaScript is byte-for-byte identical to 1.1.5.
- The install ZIP contains only `module.json` and `index.js`.
- Development reports remain outside the install ZIP.
- SHA-256:
  `51cf4eb68cc674c6d4fc334329c18b22a5074004607fb0f2a125f951e56463e3`
- Module commit: `5342bc3`.
- Signed catalogue commit: `a8e3dcf`.

The immutable GitHub release asset was downloaded again after publication and
verified to contain exactly one JSON file and one JavaScript file.

### Player behavior repair

An isolated Player patch now treats an already-current module as a successful
no-op. It clears the stale notice, repairs stale repository binding metadata,
and does not download or replace the installed module.

- Branch: `codex/module-update-noop-fix-20260816`
- Commit: `03143fc3`
- Status: isolated and not merged into the released app

This app patch improves future update UX. It is not required for users to
install Kartoons 1.1.6.

## Verification

- Audited all 20 current catalogue ZIPs: no remaining package-structure
  errors.
- Kartoons 1.1.6 live release ZIP: one JSON, one JavaScript file.
- Live ZIP hash matches signed repository metadata.
- GitHub catalogue validation and publication workflow passed.
- Kartoons runtime extraction and first, middle, and latest media samples
  passed S2 checks.
- Full simulator certification was not claimed because simulator telemetry was
  unavailable during the standard profile run.
- Focused Player repository-install tests passed.
- Changed Player files pass `flutter analyze` and `git diff --check`.

## Mandatory packaging rules for agents

For the current V2 client-module format, the distributable ZIP must contain:

```text
module.json
index.js
```

Unless the current module contract explicitly requires another runtime asset,
do not place anything else in the install ZIP.

Never include any of the following in a distributable module ZIP:

- Test reports
- Reliability reports
- Certification JSON
- Fixtures
- Screenshots
- Logs
- Source maps
- Notes or handoff documents
- Previous module ZIPs
- macOS metadata such as `__MACOSX` or `.DS_Store`

Reports belong under `docs/`, a test-output directory, or an external
certification artifact location. They must not be packaged with runtime files.

Before publishing, an agent must:

1. Preserve the existing module ID, family ID, identity, and identity number.
2. Bump the module version for a new immutable package.
3. List every ZIP entry with `unzip -Z1`.
4. Confirm exactly one `.json` file and exactly one `.js` file.
5. Parse `module.json` and confirm its ID and version match the catalogue.
6. Run the app-compatible package inspector or equivalent contract test.
7. Run module runtime and media validation separately.
8. Add the new versioned ZIP without changing an older immutable ZIP.
9. Update `catalogue.json` to point to the new file.
10. Run the repository publication workflow and verify the live release asset,
    signed hash, and ZIP contents after publication.

An HTTP 200 response, a successful scrape, or a passing Node test does not
prove that the package can be installed by the Player.

## User recovery

Users should close the previous error dialog and run:

```text
Settings -> Modules -> Advanced -> Check for updates
```

Kartoons should update to 1.1.6. Miruro, Anime-Sama, and AnimeAV1 need no
repair if the app says they are already up to date.
