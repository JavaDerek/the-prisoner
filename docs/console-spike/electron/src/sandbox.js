// Sandbox proxy: adapted (trimmed) from the SDK's own reference host example,
// github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-host/src/sandbox.ts.
// Runs on its own origin (localhost:8081), separate from the host (localhost:18080), per spec.
// Relays postMessage between the real host-side AppBridge and this frame's own inner iframe,
// which it fills via document.write when it receives ui/notifications/sandbox-resource-ready.
const HOST_ORIGIN = "http://localhost:18080";

const inner = document.createElement("iframe");
inner.style = "width:100%;height:100%;border:0";
inner.setAttribute("sandbox", "allow-scripts allow-same-origin");
document.body.style = "margin:0;height:100vh";
document.body.appendChild(inner);

window.addEventListener("message", (event) => {
  if (event.source === window.parent) {
    if (event.origin !== HOST_ORIGIN) return;
    if (event.data?.method === "ui/notifications/sandbox-resource-ready") {
      const { html, permissions } = event.data.params;
      if (permissions) {
        // buildAllowAttribute is host-side only in this SDK version; permissions here are
        // all false in this spike, so the inner iframe gets no extra `allow` directives.
      }
      const doc = inner.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
    } else if (inner.contentWindow) {
      inner.contentWindow.postMessage(event.data, "*");
    }
  } else if (event.source === inner.contentWindow) {
    window.parent.postMessage(event.data, HOST_ORIGIN);
  }
});

window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/sandbox-proxy-ready", params: {} }, HOST_ORIGIN);
