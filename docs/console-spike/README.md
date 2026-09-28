# Console spike code (the-prisoner#14)

This is the Electron-half shell spike (spike 1). It is reference/evidence for
`docs/CONSOLE-HOST-PROFILE.md`, not a maintained app -- the console itself has
no repo yet (profile's "Home" section).

Not included here (regenerate, don't hand-edit into the repo): `node_modules/`,
the esbuild output (`public/host.bundle.js`, `sandbox-origin/*.bundle.js`), and
the generated test tone (`sandbox-origin/beep.wav`). To reproduce:

```bash
npm install
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 22050 sandbox-origin/beep.wav
mkdir -p sandbox-origin && cp public/sandbox.html sandbox-origin/sandbox.html
./build.sh
xvfb-run -a ./node_modules/.bin/electron --no-sandbox --ozone-platform=x11 .
```

`ELECTRON_RUN_AS_NODE` and `WAYLAND_DISPLAY` must be unset in the shell that
launches it (see CONSOLE-HOST-PROFILE.md's "gotchas" note) or Electron either
runs as plain Node or picks the host desktop's real Wayland session instead of
Xvfb's.
