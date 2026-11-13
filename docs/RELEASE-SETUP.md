# Android Release Setup

This repository builds a signed Android APK and publishes a GitHub Release when a version tag matching `v*.*.*` is pushed.

## One-time GitHub Actions secrets

In **Settings → Secrets and variables → Actions → New repository secret**, add:

- `ANDROID_KEYSTORE_BASE64`: the release keystore file encoded as one Base64 line
- `ANDROID_STORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: key alias inside the keystore
- `ANDROID_KEY_PASSWORD`: private-key password

Never commit the keystore, its Base64 contents, or any password to this repository. Do not paste them into Issues, Pull Requests, chat, or workflow logs.

## Back up the signing identity

Keep the original keystore file and its passwords in at least two secure, separate places (for example, an encrypted offline USB drive plus an encrypted password manager backup). Verify that the backup can be opened. If this signing key is lost, future APKs cannot update installations signed with it.

Do not create a replacement key after publishing the first signed release. Every future release must use the exact same keystore, key alias, and passwords.

## Publish a release

After all four Actions secrets are configured, create and push a version tag from the intended commit:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds `app-release.apk`, uploads it as a workflow artifact, and attaches it to a GitHub Release. Use a new, increasing semantic version for each release (for example, `v1.0.1`, then `v1.1.0`). The Android versionCode is generated from the GitHub Actions run number.

## Important first-install transition

The existing debug APK is signed with a debug certificate. The first APK signed with the permanent release key will have a different certificate and Android will not install it as an in-place update over the debug build. The user will need to uninstall the debug build and install the first release APK; app-local data may be lost. After that one-time transition, keep using the same release keystore for all updates.

## Scope

GitHub Releases provide downloadable APKs and a release/version history. This workflow does not silently install updates on Android. An in-app update checker and download/install screen require a separate app feature and Android's user-confirmed package installer flow.
