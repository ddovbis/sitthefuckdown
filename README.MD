# STFD — Sit the Fuck Down

A tiny, multilingual bathroom manifesto encouraging visitors to sit down to pee.
Built with plain HTML, CSS and JavaScript, with no framework, backend, analytics,
external fonts, or build step.

**[Visit the website](https://sitthefuckdown.com/)** ·
[Report a bug or suggest a feature](https://github.com/ddovbis/stfd/issues)

## Features

- English, Romanian, Russian and Hungarian translations.
- Responsive layout with reduced-motion support.
- Language picker with saved preference and `?lang=en|ro|ru|hu` overrides.
- Interactive pledge button and rotating localized slogans.
- Downloadable PNG and SVG QR codes linking to the website.

## Run locally

Use Node.js **24.19.0 or newer within 24.x** and npm **11.21.0**, as declared in
[package.json](package.json). Ensure `node` and `npm` are on your PATH.
From the repository root:

```sh
npm ci
npm start
```

Open [localhost:8123](http://localhost:8123/). The preview serves `public/`.

On Windows, use `npm.cmd` if PowerShell blocks the npm shim.
The PowerShell runner also supports previewing with `.\scripts\run.ps1 start`
and testing with `.\scripts\run.ps1 test`.

## Development

Install Chromium once, then run the desktop and mobile browser tests:

```sh
npm exec -- playwright install chromium
npm test
```

On Linux, add `--with-deps` to the browser installation command if system
libraries are needed. Tests cover translations, interactions, responsive layout,
QR codes and static serving. They manage their own local server; port **8125**
must be free.

Useful commands:

```sh
npm run qr
npm run qr -- https://example.com/ # optional one-off destination override
npm run size
npm run export:release -- --ref HEAD --output outputs/release
npm run verify:live -- --expected-dir outputs/release/public --output outputs/live-checks.json
npm run verify:live -- --dns --expected-dir outputs/release/public
```

The canonical site URL and legacy hosting URLs live in
[config/site.json](config/site.json). The QR command reads the canonical URL by
default and regenerates both assets. Its optional URL argument overrides the
destination for that run. Previously printed codes keep their original
destination.

`npm run export:release` exports committed `public/` bytes using local Git,
including a commit/hash manifest. Choose a new output directory for each export.
This avoids Windows checkout line-ending conversion; an ordinary checkout may
not match the bytes deployed by Linux CI. On Windows, use
`.\scripts\run.ps1 export` with the same arguments.

`npm run verify:live` checks the live site. Pass `--expected-dir` with the
`public/` directory from the release being checked; it compares the deployed QR
files with that directory, including newly added images. Add `--dns` to check
the public DNS records against [config/pages-dns.json](config/pages-dns.json).
Reports default to a dated JSON file in ignored `outputs/`; `--output` selects
a different report path. Without `--expected-dir`, release hashes are not checked.
On Windows, use `.\scripts\run.ps1 verify` with the same arguments.
See [docs/domain.md](docs/domain.md) before changing the domain or DNS.

## Project layout

- `public/` — deployable website and QR assets.
- `scripts/` — local preview, QR generation and size reporting.
- `tests/` — Playwright browser tests.
- `.github/workflows/pages.yml` — tests and GitHub Pages deployment.

## Deployment

Publish **only `public/`** to any static host. No build step is required.

The [GitHub Pages workflow](.github/workflows/pages.yml) tests pushes to `main`
and deploys `public/` after the tests pass. Asset paths support hosting under
`/stfd/`.
