# STFD project notes

- Track project tasks, bugs, and feature proposals in GitHub Issues: https://github.com/ddovbis/stfd/issues (`ddovbis/stfd`).
- When asked about open issues, the backlog, priorities, or what remains to do, query the live GitHub tracker and read relevant issue descriptions and comments. Treat GitHub as the source of truth; report issue numbers and links, and distinguish proposals from approved work. If live access is unavailable, say so rather than presenting remembered issue state as current.
- Before creating an issue, check for an existing one. When working on an issue, reference its number in the resulting PR and update its status only when the requested work is complete.

- Serve only `public/`; the Node preview command is `npm start`.
- Before changing this site's domain, DNS, or GitHub Pages configuration, read `docs/domain.md`. Preserve unrelated DNS records and existing checkout changes. After deployment, run `npm run verify:live` against the intended release and confirm HTTPS, redirects, and QR destinations.
- Keep full-resolution image masters in `outputs/`. Before adding illustrations to `public/`, export appropriately sized WebP or AVIF versions and inspect them at their intended display sizes. Use responsive sources where useful, explicit image dimensions, and lazy loading for below-the-fold images. Verify the preview server's content type and report actual asset sizes.
- Follow the Node/npm versions and PATH setup in `README.MD`, install locked development dependencies with `npm ci`, then run the desktop and mobile browser suite with `npm test`.
- From PowerShell on Windows with the bundled Codex Node runtime, use `.\scripts\run.ps1 start` or `.\scripts\run.ps1 test`. The runner also accepts `qr`, `size`, `verify`, and `export` tasks.
- The Playwright global setup owns its loopback server on `127.0.0.1:8125` and closes it after the suite. If that port is occupied, stop the owning process yourself and retry; setup never reuses or terminates an unknown listener.
- Center the header badge and toilet tile on the page. Keep the language picker at the right edge on the same row on desktop and mobile.
- Use plain EN/RO/RU/HU text in the language toggle; flag emojis can render as letters with misleading baselines on Windows.
