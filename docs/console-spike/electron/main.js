// Electron main process for the shell spike (the-prisoner#14 spike 1, Electron half only).
// Serves host.html on :18080 (host origin) and sandbox.html+view-app+beep.wav on :8081
// (sandbox origin -- a different origin, required by the spec's double-iframe security model).
// Assets are served BY URL from these local ports, never inlined as base64 over postMessage.
const { app, BrowserWindow } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = { ".html": "text/html", ".js": "application/javascript", ".wav": "audio/wav" };

function serve(root, port) {
  http.createServer((req, res) => {
    const file = path.join(root, req.url === "/" ? "/host.html" : req.url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found: " + file); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(port, "localhost", () => console.log(`[server] :${port} <- ${root}`));
}

// The single Chromium flag this spike exists to test: autoplay without a user gesture.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// No real GPU under Xvfb; let Chromium fall back to its software GL path (SwiftShader) rather
// than disabling WebGL outright, so "is WebGL available" is measured, not assumed unavailable.
app.commandLine.appendSwitch("use-gl", "angle");
app.commandLine.appendSwitch("use-angle", "swiftshader");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

app.whenReady().then(() => {
  serve(path.join(__dirname, "public"), 18080);
  serve(path.join(__dirname, "sandbox-origin"), 8081);

  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.on("console-message", (_e, _level, message) => console.log("[renderer]", message));
  win.loadURL("http://localhost:18080/host.html");

  // Let the handshake, autoplay probe and WebGL probe run, then dump results and exit.
  setTimeout(async () => {
    const log = await win.webContents.executeJavaScript("window.__hostLog || []");
    console.log("=== HOST LOG ===");
    for (const line of log) console.log(line);
    app.quit();
  }, 5000);
});

app.on("window-all-closed", () => app.quit());
