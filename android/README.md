# RepX on Google Play

RepX ships to Play as a **Trusted Web Activity** (TWA): a thin Android shell that
runs the already-deployed PWA full-screen in Chrome, with no browser chrome and
no separate codebase. One frontend, two distribution channels.

The deployment walkthrough — including Play Console forms and Data Safety
answers — is in [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md#google-play-trusted-web-activity).
This file is the mechanical build reference.

## Why TWA and not Capacitor / React Native

| | TWA | Capacitor |
|---|---|---|
| Codebase | The existing PWA, unchanged | The existing PWA + a native project to maintain |
| Camera / `getUserMedia` | Chrome handles it, real Chrome permission prompt | WebView, needs native permission plumbing |
| Pose model performance | Full Chrome, current V8 + WASM SIMD | Android System WebView, usually a release or two behind |
| Ships a fix | Deploy the website — instantly live in the app | Rebuild, re-upload, wait for review |
| Push notifications, IAP | Not available without extra work | Native APIs available |

RepX's whole product is a camera and a WASM pose model at 30fps, so running in
real Chrome rather than a WebView is worth more here than in most apps. Move to
Capacitor only when you need Play Billing or native push — see
[When to outgrow the TWA](../docs/DEPLOYMENT.md#when-to-outgrow-the-twa).

## Prerequisites

- **Node 20+** and the Bubblewrap CLI: `npm i -g @bubblewrap/cli`
- **JDK 17** and the Android SDK — `bubblewrap doctor` installs and checks both
- The PWA **already deployed to HTTPS** at the host in `twa-manifest.json`.
  Bubblewrap reads the live `manifest.webmanifest`; it cannot build against
  localhost.

## Build

```bash
cd android

# First time only — generates the Android project from twa-manifest.json.
# It will offer to create a signing keystore. Say yes, and then read the
# "Keystore" warning below before you do anything else.
bubblewrap init --manifest https://repx.app/manifest.webmanifest

# Every build after that
bubblewrap build          # produces app-release-bundle.aab + app-release-signed.apk
```

Upload `app-release-bundle.aab` to Play Console. The `.apk` is for sideloading
onto a real device to test before you release.

## Keystore — the one irreversible step

`bubblewrap init` writes `android.keystore`. **If you lose that file or its
password, you can never update this app again** — Play identifies an app by its
signing key, and there is no recovery path. A new key means a new listing and
zero installs.

- Back it up somewhere that is not this repository and not this laptop.
- It is already covered by `.gitignore` (`*.keystore`). Keep it that way.
- Enrol in **Play App Signing** when you create the app in Play Console. Google
  then holds the distribution key and your local key becomes an upload key,
  which *is* recoverable if lost.

## Digital Asset Links — the one that always goes wrong

The TWA only hides the browser URL bar if the website proves it trusts the app.
That proof is [`frontend/public/.well-known/assetlinks.json`](../frontend/public/.well-known/assetlinks.json),
which must be live at `https://repx.app/.well-known/assetlinks.json`.

The fingerprint in that file must be the **App signing key** SHA-256 from
**Play Console → Release → Setup → App signing** — *not* the fingerprint
Bubblewrap prints for your local keystore. With Play App Signing enabled Google
re-signs your upload, so the certificate that reaches devices is Google's, not
yours. Using the local one is the single most common cause of "my TWA still
shows a URL bar".

To read it back at any time:

```bash
bubblewrap fingerprint list
```

Verify the live file once deployed:

```bash
curl https://repx.app/.well-known/assetlinks.json
```

It must return `Content-Type: application/json`, no redirect, no HTML fallback.
An SPA host that rewrites unknown paths to `index.html` will silently serve the
app shell here and break verification — see
[Frontend deployment](../docs/DEPLOYMENT.md#frontend-deployment).

## Releasing an update

The website updates itself. You only need a new Play release when the *shell*
changes — a new icon, name, orientation, or target SDK bump Play demands.

```bash
# bump both, then rebuild
#   "appVersionCode": 2      <- must strictly increase, Play rejects reuse
#   "appVersionName": "1.0.1"
bubblewrap build
```

## Files here

| File | What it is | Committed |
|---|---|---|
| `twa-manifest.json` | Bubblewrap's source of truth for the shell | yes |
| `android.keystore` | Your signing key | **no** — gitignored, back it up |
| `app-release-bundle.aab` | Build output, uploaded to Play | no |
| `/`, `app/`, `gradle*` | Generated Android project | no |
