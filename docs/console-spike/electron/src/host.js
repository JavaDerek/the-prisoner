// Host-side spike: instantiates the REAL host-side SDK, @modelcontextprotocol/ext-apps/app-bridge
// (npm, published, verified against github.com/modelcontextprotocol/ext-apps/blob/main/src/app-bridge.ts).
// This is not a hand-rolled fallback: AppBridge, PostMessageTransport and buildAllowAttribute below
// are the real exports. No MCP client/server connection is spiked here (that step only fetches a
// resource's HTML text over MCP; irrelevant to autoplay/WebGL) -- the View HTML is supplied directly.
import { AppBridge, PostMessageTransport, buildAllowAttribute } from "@modelcontextprotocol/ext-apps/app-bridge";

const SANDBOX_ORIGIN = "http://localhost:8081";
const log = (...a) => {
  console.log("[HOST]", ...a);
  window.__hostLog = window.__hostLog || [];
  window.__hostLog.push(a.map(String).join(" "));
};

async function main() {
  const iframe = document.getElementById("sandbox");
  const permissions = { microphone: false, camera: false, geolocation: false, clipboardWrite: false };
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const allow = buildAllowAttribute(permissions);
  if (allow) iframe.setAttribute("allow", allow);

  // Real AppBridge, no MCP client (client=null -> manual handlers, per app-bridge.d.ts).
  const bridge = new AppBridge(null, { name: "console-spike-host", version: "0.0.1" }, {}, {
    hostContext: {
      theme: "dark",
      platform: "web",
      containerDimensions: { width: 800, maxHeight: 600 },
      displayMode: "fullscreen",
      availableDisplayModes: ["inline", "fullscreen"],
    },
  });

  bridge.onmessage = async (params) => { log("ui/message from View:", JSON.stringify(params)); return {}; };
  bridge.onloggingmessage = (params) => log("View log:", JSON.stringify(params));
  bridge.onrequestdisplaymode = async (p) => ({ mode: p.mode === "fullscreen" ? "fullscreen" : "inline" });

  const initialized = new Promise((resolve) => { bridge.oninitialized = () => { log("View initialized (ui/initialize handshake complete)"); resolve(); }; });

  // Wait for the sandbox proxy (a separate origin, per spec) to load, then connect.
  await new Promise((resolve) => {
    const onMsg = (e) => {
      if (e.origin === SANDBOX_ORIGIN && e.data?.method === "ui/notifications/sandbox-proxy-ready") {
        window.removeEventListener("message", onMsg);
        resolve();
      }
    };
    window.addEventListener("message", onMsg);
    iframe.src = SANDBOX_ORIGIN + "/sandbox.html";
  });
  log("sandbox proxy ready, connecting AppBridge");

  await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));

  // The View HTML shell itself travels over postMessage (that IS the spec's delivery mechanism for
  // sendSandboxResourceReady) but references its real assets -- the bundled view-app script and the
  // WAV -- by URL from the sandbox origin's local server. No base64 asset payloads.
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' http://localhost:8081; media-src http://localhost:8081; connect-src http://localhost:8081; style-src 'unsafe-inline'; img-src 'self' data:;">
</head><body style="margin:0;background:#111">
<canvas id="gl" width="480" height="270" style="display:block"></canvas>
<audio id="a" src="http://localhost:8081/beep.wav" autoplay></audio>
<script src="http://localhost:8081/view-app.bundle.js"></script>
</body></html>`;
  await bridge.sendSandboxResourceReady({ html, permissions });
  log("sendSandboxResourceReady sent");

  await initialized;
  log("SPIKE 1 HOST: handshake complete, view is live");
}

main().catch((e) => log("HOST ERROR:", e && e.stack || e));
