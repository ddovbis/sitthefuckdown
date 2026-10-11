# STFD — Sit the Fuck Down

A tiny, multilingual bathroom manifesto encouraging visitors to sit down to pee.
Built with plain HTML, CSS and JavaScript: no framework, backend, runtime packages,
external fonts, analytics, or build step.

- **Repository:** https://github.com/ddovbis/stfd (public)
- **Website:** https://ddovbis.github.io/stfd/
- **Server preview:** http://168.119.226.28:8123/
- **Windows checkout:** `C:\Users\ddovbis\projects\web\stfd`
- **VPS checkout:** `/home/ddovbis/projects/web/stfd`
- **Languages:** English, Romanian, Russian and Hungarian

## Features

- Responsive layout, including narrow 320px screens.
- Language picker with saved preference and `?lang=en|ro|ru|hu` overrides.
- Interactive pledge button and rotating localized slogans.
- Downloadable PNG and SVG QR assets pointing to the permanent GitHub Pages URL.
- CSS reduced-motion support; native emoji appearance depends on the device.
- Language switching still works when browser storage is blocked (without persistence).

## Structure

```text
public/                 Entire deployable website
  index.html
  styles.css
  script.js
  favicon.svg           Toilet emoji favicon
  stfd-qr.png
  stfd-qr.svg
scripts/generate-qr.mjs  Regenerate both QR assets
scripts/size.mjs         Report deployment and estimated gzip sizes
scripts/serve.mjs        Node static preview, serving only public/
scripts/run.ps1          Windows preview, test, QR and size runner
scripts/playwright-global-setup.mjs  Start and stop the test preview
tests/site.spec.js       Browser, interaction, layout, asset and QR checks
playwright.config.js    Desktop/mobile Chromium test configuration
```

Serve **only `public/`**, not the repository root. Git history, documentation,
Node development dependencies and tests do not belong in the published site.
Local scratch files in `work/` and review artifacts in `outputs/` are ignored by Git.

## Run locally

From the checkout root, with Node.js 20 or newer installed:

```bash
npm start
```

Open `http://localhost:8123/`. The preview serves only `public/`; use static
hosting or an HTTPS web server for a permanent deployment.
From PowerShell on Windows, run `.\scripts\run.ps1 start`.

### Current server

The user-level `stfd.service` serves `public/` on port 8123. It is enabled at startup;
user lingering is enabled on this host. Its definition is at
`~/.config/systemd/user/stfd.service` (host configuration, not a website asset).

```bash
systemctl --user status stfd.service
systemctl --user restart stfd.service
journalctl --user -u stfd.service -n 30
```

## Development and tests

Requires Node.js 20+. Development dependencies are locked in
`package-lock.json`; there are no client-side package dependencies.

```bash
npm ci
npm exec playwright install chromium
npm test
```

If Chromium is missing, install it with Playwright's browser installer. On Linux,
browser system libraries may also be required.
From PowerShell on Windows, run the suite with `.\scripts\run.ps1 test`;
the runner uses installed Chrome or Edge when available, keeps browser download
temporaries under the ignored `.playwright-tmp/` folder, and allows two minutes per
test for QR pixel decoding on Windows. Extra Playwright arguments may be appended.
Tests start and stop their own loopback-only server on port 8125; that port must be free.
To reuse an existing Chromium executable, as on the current server:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/ddovbis/.openclaw/browsers/openclaw-chrome npm test
```

The suite runs 26 checks across desktop and mobile Chromium: branding and
translation coverage in all four languages, pledge/slogan interaction, language
persistence and URL priority, invalid-language fallback, blocked storage, menu
keyboard behavior, header alignment and menu bounds at 320px, 390px, 800px and
801px, PNG/SVG QR decoding and download, favicon and asset responses,
private-file and symlink exclusion, and project-site subpath compatibility.

## QR codes

```bash
npm ci
npm run qr -- https://ddovbis.github.io/stfd/
```

The argument is the destination embedded in **both** assets. After changing the
hosting URL, regenerate the QR codes and update the expected target in
`tests/site.spec.js` before running the tests. Previously printed codes still
point to their original URL; they are not dynamic redirects.

## Deployment size

Run `npm run size` to measure the files in `public/`.

The reviewed Git version contains **34,652 bytes (33.84 KiB)** across all six deployment files.
Individually gzipped estimate: **11,770 bytes (11.49 KiB)**; actual transfer size
and compression depend on the host. These figures exclude Git history,
documentation, tests and development dependencies.
Windows CRLF line endings can make the local checkout slightly larger.

## GitHub Pages deployment

**Website:** https://ddovbis.github.io/stfd/

The repository is public because the current GitHub Free plan does not support
Pages hosting from a private repository. Only `public/` is published as the website;
Git history, documentation, tests and development dependencies are not deployed.

`.github/workflows/pages.yml` automatically runs all browser tests on pushes to
`main`, packages `public/`, and deploys it only if the tests pass. It can also be
started manually from the repository's Actions tab. The deployment uses GitHub's
built-in workflow token; no manually stored deployment credentials are needed.

All asset references are relative, and `/stfd/` subpath behavior is tested.
There is no website build step. Pages settings use **GitHub Actions** as the source.
Both QR assets encode `https://ddovbis.github.io/stfd/`.

### Release workflow

From the Windows checkout:

1. Install locked dependencies with `npm ci`, then run `.\scripts\run.ps1 test`
   and `.\scripts\run.ps1 size`. Review the desktop and mobile layout locally.
2. Review `git diff --check` and `git diff --cached --stat`, then commit only the
   intended source, tests, tooling and documentation. Keep review screenshots local.
3. Push the reviewed commit with `git push origin main`. This starts the Pages
   workflow; the live website updates after both `test-and-package` and `deploy` pass.
4. Confirm the workflow's commit SHA matches the pushed commit in
   [GitHub Actions](https://github.com/ddovbis/stfd/actions/workflows/pages.yml).
   Open the live website, check the toilet favicon, switch between all four
   languages, and check the mobile header and pledge button.

If either job fails, inspect its logs and correct the failing change before
retrying. The VPS preview is a separate checkout and is not updated by this workflow.

See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).
