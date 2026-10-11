# STFD project notes

- Serve only `public/`; the Node preview command is `npm start`.
- Install locked development dependencies with `npm ci`, then run the desktop and mobile browser suite with `npm test`.
- From PowerShell on Windows with the bundled Codex Node runtime, use `.\scripts\run.ps1 start` or `.\scripts\run.ps1 test`. The runner also accepts `qr` and `size` tasks.
- The Playwright global setup owns its loopback server on `127.0.0.1:8125` and closes it after the suite. If that port is occupied, stop the owning process yourself and retry; setup never reuses or terminates an unknown listener.
