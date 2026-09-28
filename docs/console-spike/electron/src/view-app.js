// The View: runs inside the innermost sandboxed iframe. Uses the real APP-side SDK
// (@modelcontextprotocol/ext-apps, main export) to complete the ui/initialize handshake,
// then measures autoplay and WebGL/WebGPU, and reports facts back to the host via
// the real sendLog/sendMessage methods (never assets -- just small JSON facts).
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "console-spike-view", version: "0.0.1" }, {});

function checkGraphics() {
  const canvas = document.getElementById("gl");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const webgl = !!gl;
  const webglVersion = canvas.getContext("webgl2") ? "webgl2" : gl ? "webgl1" : null;
  let renderer = null;
  if (gl) {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.clearColor(0.1, 0.4, 0.8, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  const webgpu = !!navigator.gpu;
  return { webgl, webglVersion, renderer: String(renderer), webgpu };
}

async function checkAutoplay() {
  const audio = document.getElementById("a");
  let playError = null;
  try {
    await audio.play();
  } catch (e) {
    playError = String(e);
  }
  // Give the media pipeline a tick, then read the real HTMLMediaElement state.
  await new Promise((r) => setTimeout(r, 300));
  return {
    paused: audio.paused,
    currentTime: audio.currentTime,
    readyState: audio.readyState,
    playError,
  };
}

async function main() {
  await app.connect(); // default transport: PostMessageTransport(window.parent, window.parent)
  app.sendLog({ level: "info", data: "view connected, ui/initialize handshake done" });

  const graphics = checkGraphics();
  const audio = await checkAutoplay();
  const facts = { graphics, audio, ua: navigator.userAgent };
  app.sendLog({ level: "info", data: "SPIKE1 FACTS " + JSON.stringify(facts) });
  await app.sendMessage({ role: "user", content: [{ type: "text", text: "SPIKE1 FACTS " + JSON.stringify(facts) }] });
}

main().catch((e) => app.sendLog({ level: "error", data: "VIEW ERROR " + (e && e.stack || e) }));
