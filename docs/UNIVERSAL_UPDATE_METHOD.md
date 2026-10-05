# LifeLedger Universal Update Method

Status: PREPARED — GitHub repository not yet connected

## Purpose

Use GitHub as the canonical source and release store so every authorized computer receives the same tested LifeLedger build. Do not copy project folders from one computer to another as the normal update mechanism.

## Authority model

1. The GitHub repository is the canonical application source.
2. Local user financial data is NOT repository data. It stays in each device's local storage.
3. A Git commit is source history; a tagged GitHub Release is the distributable application version.
4. Only a tested release tag is eligible for universal distribution.

## Release flow

```text
Developer/Founder machine
        ↓
source changes in src/
        ↓
npm test
        ↓
node build.mjs --all
        ↓
desktop installer build + artifact checks
        ↓
git commit
        ↓
git tag v1.x.y
        ↓
GitHub Actions
        ↓
GitHub Release assets + SHA-256 checksums
        ↓
Windows / Web-PWA / Android authorized devices
        ↓
update + verify version
```

## Artifact rule

Every release should publish:

- Windows NSIS installer
- Windows portable executable
- web single-file build
- PWA bundle
- Android APK when the native Capacitor project is present
- SHA-256 checksum manifest

Artifact names should contain the exact semantic version, for example `LifeLedger Setup 1.3.0.exe`.

## Windows update method

Each Windows computer should eventually have one small update script or app menu action that:

1. Reads the current installed LifeLedger version.
2. Queries the GitHub repository's latest stable Release.
3. Compares versions; never downgrades unless explicitly requested.
4. Downloads the matching Windows installer.
5. Verifies the published SHA-256 checksum.
6. Launches the installer.
7. Verifies the installed executable/version after installation.

LifeLedger's persistent Electron storage remains outside the packaged application. The NSIS configuration also keeps application data when uninstalling, so application updates should not be treated as financial-data migrations.

## Web/PWA update method

Publish the generated `dist-pwa/` bundle from the tagged release to the chosen static host. The existing service-worker fingerprinting changes the cache tag whenever application content changes, which forces the installed PWA to recognize the new build.

## Android update method

Build the APK from the same release tag. The APK is a release artifact, not a separately edited application tree. Android application data remains on the device; application upgrades must not overwrite exported financial backups.

## Data safety rule

Never commit `localStorage` data, backup JSON files, credentials, `.env` files, or machine-specific configuration to GitHub.

Before a major application upgrade, a user should be able to export `lifeledger-backup.json`. Schema migrations remain in the application startup path so older backups can be imported into newer releases.

## Rollback

Rollback means selecting a previous GitHub Release/tag and installing that exact version. The update mechanism must never silently modify user financial data while changing application code.

## Security progression

Initial implementation can use GitHub Releases + SHA-256 verification. The mature version should add code signing for Windows/macOS/Android artifacts and require the update client to reject unsigned or checksum-mismatched artifacts.

## Repository setup — one time

From the LifeLedger root, after choosing the GitHub repository name:

```powershell
git init
git branch -M main
git add .
git commit -m "LifeLedger 1.3.0 baseline"
git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
git push -u origin main
```

Then create the first release tag:

```powershell
git tag v1.3.0
git push origin v1.3.0
```

Do not put the local `release/` installers or personal backup files under source control; use GitHub Release assets for distributables.

## Universal-update principle

GitHub becomes the **application distribution authority**, while each computer remains the **data authority** for its own Life Ledger records.

That separation is the important design rule: one application source, many independent local datasets.