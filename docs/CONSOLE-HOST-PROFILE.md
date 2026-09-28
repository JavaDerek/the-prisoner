# Console host profile: the documented superset of MCP Apps this console guarantees

Draft per the-prisoner#14. Written the night of 2026-09-27 under delegated authority while the owner
slept; every claim below is marked **measured** (this session ran it and quotes the output),
**decided** (a call taken here, to be revisited), or **unverified** (researched but not run). Nothing
here is committed -- this file is left in the working tree for the coordinator to review and commit.

**Home.** The console does not exist as a repository yet. Decided tonight: its home is **a new
repository, created when the console build starts**. Until then this profile lives here, in
the-prisoner, beside `CONSOLE-DIAGRAM-BRIEF.md`, and **moves with that brief** when the console repo
is created (the-prisoner#13's own rule: "the home is the owner's decision and this issue moves when
that repo exists").

Vocabulary note (per this repo's own CLAUDE.md): this document is written for the console, which is
not the-prisoner's own vocabulary. Nothing below uses "warden," "prisoner," "cell," or "custody."

---

## 1. Persistent Views

**Decided.** One View per scene, mounted once and surviving across turns and tool calls; torn down
only on scene change. This is a console guarantee, not a spec guarantee: MCP Apps' own View lifecycle
is still being designed upstream -- **unverified as upstream-settled**, confirmed still open tonight:
`modelcontextprotocol/ext-apps#744` ("Add UI 'preload' Control and 'ui/close' Signal for MCP Apps
Tool-Driven Widgets") is **open**, proposing exactly the preload/close signalling a host needs to avoid
tearing a View down between tool calls. Until it lands, "persistent" is something the console
implements itself by simply not tearing the iframe down, not something the spec hands it for free.

## 2. Fullscreen by the host

**Decided, and measured feasible tonight (spike 1).** The console renders the View full-window itself
via its own window management; the HTML Fullscreen API is not needed. Confirmed in the spike: the host
page set `displayMode: "fullscreen"` in the initial `hostContext` passed to `AppBridge`'s constructor
and the View never called the Fullscreen API. Spec display modes remain inline / fullscreen / pip
(`McpUiHostContext.displayMode`, verified against the installed `@modelcontextprotocol/ext-apps@2.0.0`
type declarations).

## 3. Audio without a click

**Measured, spike 1.** Electron + a Chromium autoplay-policy switch produces a `<audio autoplay>`
element that actually plays, unattended, inside the real MCP Apps double-iframe (host → sandbox proxy
→ View), through the real `AppBridge`/`App` SDK handshake. Full facts and log lines in §7 below.
Tauri is unmeasured on this machine (§8) -- record only that the mechanism differs per shell (a
Chromium command-line switch here; each OS's own native webview settings there), not that it works
the same way.

## 4. Assets by URL, never base64 over postMessage

**Decided; exercised in spike 1, not fully replicated to Tauri.** The spike's View HTML (which itself
travels over `postMessage` via `sendSandboxResourceReady` -- that IS the spec's delivery mechanism for
a View's markup, not a violation of this rule) references its actual payloads by URL against a local
HTTP server: the WAV file and the bundled View script both loaded from `http://localhost:8081/...`,
never inlined as base64 in the message. This is "the single biggest performance decision" per the
issue, and the spike confirms the mechanism is available in Electron (`http.createServer` on
`localhost`, referenced from a CSP-scoped `<script src>`/`<audio src>`). A real console would use a
custom scheme (`app://` or similar) rather than a loopback TCP port to avoid port collisions --
**measured as a real hazard tonight**: the spike's first run silently failed to bind its host port
because an unrelated dev server already had `0.0.0.0:8080`; moving to an uncommon port (`18080`) fixed
it. A custom protocol scheme avoids this whole class of problem and is the better production choice;
the spike used ports only because they're the fastest thing to stand up for a one-off test.

## 5. Turn-level messaging only

**Decided, consistent with what's measured.** No per-frame state channel was built or needed: the
spike's every host↔View message was a discrete JSON-RPC call (`ui/notifications/sandbox-resource-ready`,
`ui/initialize` → `ui/notifications/initialized`, `ui/message`, `ui/notifications/logging-message`),
never a stream. This matches the spec's own transport (JSON-RPC over `postMessage`) and the issue's
framing: model calls take seconds, so a cartridge needing per-frame host state is a different kind of
game.

## 6. Declared capabilities beyond the spec's four permissions

**Decided (shape), unverified (no cartridge declares this yet).** The spec's `McpUiResourcePermissions`
defines exactly four: `camera`, `microphone`, `geolocation`, `clipboardWrite` (confirmed against the
installed SDK's `buildAllowAttribute` and its type declarations -- it maps only these four to iframe
`allow` directives). Everything else the console offers -- TTS voices, image generation, generated
video, a live voice call, a narrator role -- has **no field in the MCP Apps spec at all**. A stock host
has no channel for a cartridge to ask for these (§9 makes this concrete). The console therefore needs
its own declaration, alongside the spec's `permissions` object, not instead of it:

```json
{
  "permissions": { "microphone": true, "camera": false, "geolocation": false, "clipboardWrite": false },
  "consoleCapabilities": {
    "tts": { "voices": ["narrator", "cast"] },
    "imageGeneration": true,
    "videoGeneration": { "maxSeconds": 8 },
    "liveVoiceCall": true,
    "narrator": true
  }
}
```

**The console's refusal rule:** at load time the console diffs a cartridge's `consoleCapabilities`
against what it can currently meet (a capability may be unmet permanently -- no video generator wired
up at all -- or transiently -- the GPU is busy, §10). Anything unmet is refused explicitly (the
cartridge is told which capability failed and why), never silently degraded into a worse experience
the cartridge didn't ask for. This is the-prisoner#13's "accretion guard" applied to capability
declarations specifically: a gap becomes a console issue, not a cartridge workaround, and refusal is
what keeps that true -- a console that quietly substituted subtitles for voice without telling the
cartridge would let the workaround happen anyway, just invisibly. (Degradation, §10's table, is a
*declared* fallback the cartridge opted into up front -- e.g. "subtitles are an acceptable substitute
for voice" -- which is different from the console silently deciding that on the cartridge's behalf.)

## 7. Spike 1 (shell): measured facts

**Setup.** `/tmp/console-spike/electron` (code copied into `docs/console-spike/electron/` in this
repo, ~230 lines total -- see that directory's own README for exact commands and the two environment
gotchas that cost the most time tonight: `ELECTRON_RUN_AS_NODE=1` was set in this shell's environment,
which makes the `electron` binary run as plain Node and reject every Chromium flag as "bad option";
and `WAYLAND_DISPLAY` was set to the desktop's *real* Wayland session, which Electron's Ozone platform
auto-detects and prefers over Xvfb's X11 display, crashing the GPU process with `SIGSEGV` when it tried
to talk to a compositor that wasn't there. Both had to be unset for the run; `--ozone-platform=x11` was
also passed explicitly.)

**What was built, faithfully to the real SDK, not a mock:**
- Package: `@modelcontextprotocol/ext-apps@2.0.0` (npm, published, verified against
  `github.com/modelcontextprotocol/ext-apps`) -- **this is the real package name; it exists exactly as
  the issue described**, no fallback needed. Host-side import is the `/app-bridge` subpath
  (`@modelcontextprotocol/ext-apps/app-bridge`, confirmed present in the installed package's
  `exports` map), exporting a real `AppBridge` class, `PostMessageTransport`, and `buildAllowAttribute`.
- A double-iframe host → sandbox-proxy → View structure, adapted (trimmed) from the SDK's own
  `examples/basic-host` reference (`app-bridge.ts`, `sandbox.ts`), not invented: the host holds a
  real `AppBridge` (constructed with `client: null`, i.e. no live MCP server connection -- fetching a
  resource's HTML over MCP is orthogonal to what this spike measures); the View holds the real
  app-side `App` class from the package's main export. Both bundled with `esbuild` (browser IIFE,
  ~1.0 MB each, dominated by the pulled-in `@modelcontextprotocol/client`/`core` and `zod` -- this SDK
  is not a lightweight dependency).
- Host and sandbox proxy on two different local-server origins (`localhost:18080` / `localhost:8081`),
  matching the spec's own requirement that host and sandbox be cross-origin.

**Measured, end to end, one clean run (`docs/console-spike/electron`, 2026-09-27):**

```
[HOST] sandbox proxy ready, connecting AppBridge
[HOST] sendSandboxResourceReady sent
[HOST] View initialized (ui/initialize handshake complete)
[HOST] View log: {"level":"info","data":"view connected, ui/initialize handshake done"}
[HOST] View log: {"level":"info","data":"SPIKE1 FACTS {\"graphics\":{\"webgl\":true,\"webglVersion\":\"webgl2\",
  \"renderer\":\"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)\",
  \"webgpu\":true},\"audio\":{\"paused\":false,\"currentTime\":0.225132,\"readyState\":4,\"playError\":null},
  \"ua\":\"...Chrome/152.0.7977.130 Electron/44.4.5...\"}"}
[HOST] ui/message from View: {"role":"user","content":[{"type":"text","text":"SPIKE1 FACTS ..."}]}
```

Read directly:
- **Audio autoplay: yes, measured working.** `audio.play()` was called with no user gesture; 300ms
  later `HTMLMediaElement.paused === false`, `currentTime` had advanced (`0.225`s), `readyState === 4`
  (`HAVE_ENOUGH_DATA`), and the `play()` promise resolved with no `playError`. This is inside the real
  sandboxed MCP Apps View (behind the double-iframe, after the real `ui/initialize` handshake), not a
  bare page. The mechanism: `app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")`
  in the Electron main process, set before `app.whenReady()`.
- **WebGL: yes, WebGL2, measured.** `canvas.getContext("webgl2")` succeeded; renderer string reads
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` --
  **software rendering**, because there is no real display/GPU compositor available to a headless
  Xvfb session, and the switches used (`--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader`) explicitly requested that fallback rather than letting WebGL fail
  outright. This is a fact about *this measurement's environment*, not a claim about WebGL performance
  on the console's real target hardware (a machine with an actual GPU and display would get a hardware
  ANGLE backend instead) -- flagged so it isn't misread as "the console gets software WebGL."
- **WebGPU: `navigator.gpu` is present** (`true`). **Unverified beyond that**: the spike checked only
  for the property's existence, not that `navigator.gpu.requestAdapter()` succeeds -- under SwiftShader
  a WebGPU adapter request can still fail even when the object exists. Getting a real adapter is the
  next thing to check before relying on WebGPU for anything.
- **CSP**: the View's shell HTML carried CSP as a `<meta>` tag (`default-src 'none'; script-src 'self'
  http://localhost:8081; media-src ...; connect-src ...`), which worked for this spike. **Decided
  correction for production, not just observed**: the SDK's own reference host does *not* do this --
  its comment says CSP should be delivered via the sandbox response's HTTP headers ("tamper-proof
  unlike meta tags"), because a meta-tag CSP is weaker (e.g. cannot set `frame-ancestors`) and, being
  part of the served HTML, is exactly the kind of thing untrusted content could in principle try to
  interfere with. The spike used a meta tag purely for speed; the real console should follow the
  reference and set CSP via response headers on the sandbox resource.
- One thing this spike got wrong and fixed live: the View's first `app.sendMessage()` call failed
  real, non-mocked schema validation (`ProtocolError: Invalid params for ui/message: role: Invalid
  input: expected "user"`) -- the SDK enforces `McpUiMessageRequest`'s shape strictly. Left in this
  report because it's a small piece of evidence that the "real SDK" claim is not decorative: a
  hand-rolled fallback would not have caught this.

**What spike 1 did not test:** an actual MCP server connection (`Client.connect`, `listTools`,
`readResource`) -- irrelevant to autoplay/WebGL/CSP, the things this spike exists to measure, and
already exercised at length in the SDK's own example and test suite; the console's own load-cartridge
path will need it, but that's ordinary MCP client wiring, not a shell-specific risk. Also not tested:
resizing/`ResizeObserver` behavior, `ui/open-link`, file download, or any interaction requiring the
four spec permissions (none were requested).

## 8. Tauri: unmeasured, and why

**Unverified / not run.** This machine has no Rust toolchain and no `webkit2gtk` development
libraries, and sudo is not assumed available to install either. Tauri's Linux build requires both (it
compiles a Rust binary and links against the system's WebKitGTK for its webview) -- there is no way to
build or even trial-run a Tauri shell here without first installing a toolchain, which was out of scope
for a same-night spike. Record concretely what it would take next time: `rustup` (or a distro Rust
package new enough for Tauri's MSRV), the `webkit2gtk-4.1`/`libsoup` dev packages (Debian/Ubuntu:
`libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`, plus the usual
`build-essential`/`libssl-dev`/`libgtk-3-dev`), and `@tauri-apps/cli`. Once available, the same
question set applies: does `<audio autoplay>` play without a gesture in WebKitGTK's default
configuration (WebKit's autoplay policy is a runtime setting distinct from Chromium's, and historically
stricter by default on Linux), is WebGL/WebGPU exposed through WebKitGTK on this hardware, and what
does its CSP enforcement require differently from Chromium's. None of that is knowable without the
toolchain; treat "Electron works, Tauri unknown" as the honest state, not "Tauri is worse" -- there is
no measurement behind a comparison yet.

## 9. Degraded portability (spike 3): what stock MCP Apps hosts support today

**Researched (WebSearch/WebFetch), not run against a live host** -- no host in this list was actually
loaded with a cartridge tonight; this section is desk research, marked as such throughout.

**Which hosts render MCP Apps at all (authoritative source: the spec's own maintained client matrix,
`modelcontextprotocol.io/extensions/client-matrix`, fetched 2026-09-27):** Claude (web), Claude
Desktop, VS Code GitHub Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam, ChatGPT, Cursor,
Archestra.AI, and PostHog Code all show a checkmark for the `io.modelcontextprotocol/ui` extension.
The matrix is boolean per client -- it does **not** break down *which parts* of the spec (display
modes, which of the four permissions get honored) each host implements; that finer grain is
unverified from any single authoritative source found tonight.
(`https://modelcontextprotocol.io/extensions/client-matrix`)

**Timeline / rollout, per the spec's own announcement**
(`https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/`, fetched via WebFetch): MCP Apps
became the first extension to reach production-ready status on 2026-01-26, alongside Claude shipping
support "today, both on web and desktop"; VS Code had it in Insiders; ChatGPT was "rolling out starting
this week." (`https://www.theregister.com/special-features/2026/01/26/claude-supports-mcp-apps-presents-ui-within-chat-window/4645652`
corroborates the Claude launch date and framing.)

**Per-host granularity found, and its reliability:** a secondary source (`mcpplaygroundonline.com`,
fetched via WebFetch) claimed VS Code lacks fullscreen/PiP display modes and ChatGPT lacks
tool-calling-from-the-UI, `useFiles`, and `useCheckout`. **Marked unverified** -- this is a
non-authoritative blog, it does not cite its own source for those specifics, and it is not corroborated
by the spec's own client matrix (which only records yes/no on the extension as a whole). Do not treat
this as settled; re-check against each host's own release notes before relying on it.

**A separate, confirmed data point that is easy to conflate with the above:** Claude Code (the CLI,
`anthropics/claude-code`) does **not** render MCP Apps UI resources at all -- confirmed via
`https://github.com/anthropics/claude-code/issues/95149` (open): "Claude Code connects to MCP servers
but does not render MCP Apps (SEP-1865) UI resources. A tool bound to a `ui://` resource ... returns
its text result and the UI is dropped," because Claude Code's `capabilities.extensions` does not
advertise `io.modelcontextprotocol/ui`. This is Claude Code specifically, not "Claude" generally --
Claude (web) and Claude Desktop are separately confirmed supporting hosts in the client matrix above.
Relevant here only as a reminder that "Claude supports it" is not one fact but several per surface.

**Persistent Views upstream:** `modelcontextprotocol/ext-apps#744` (open, confirmed via WebFetch
tonight) is exactly the missing piece for §1's guarantee: without it, a stock host may legitimately
tear a View down and rebuild it between tool calls, and a cartridge cannot yet ask it not to.

**What a cartridge loses, reasoned from the spec text plus §1-§6 above (not measured against a live
host tonight, so marked reasoned/unverified throughout):**

| This profile's extra | What a stock MCP Apps host gives instead |
| --- | --- |
| Persistent View across turns (§1) | Spec-level lifecycle is still unsettled (#744 open); a stock host may reload the View's HTML between tool calls, unverified either way per host |
| Host fullscreen, no click (§2) | The View can *request* `fullscreen` via `ui/request-display-mode`, but the host decides; degrades to inline at the host's discretion |
| Audio without a click (§3) | **Reasoned, not measured**: a chat host has no reason to pass an autoplay-enabling flag to its own webview, and browser/webview autoplay policies default to blocking unmuted audio without a gesture; likely silent until the user interacts, unconfirmed against any real host tonight |
| Assets served by the console, by URL (§4) | Still fine for a cartridge's *own* assets -- the spec already supports `_meta.ui.csp` naming external origins for a server's own resource. Lost only for *console-generated* assets (TTS audio, a generated clip) that a stock host has nothing to fetch, since it never asked for them |
| `consoleCapabilities` (§6): TTS, image/video generation, live voice, narrator | **Entirely absent.** These are not part of the MCP Apps spec. A stock host has no field to grant them and no service behind them even if it did. A cartridge that needs one gets nothing -- not a degraded version, nothing |
| GPU scheduling / degradation table (§10) | Not applicable -- a stock host isn't running local model inference for this cartridge at all |

The practical floor: a cartridge dropped into a stock MCP Apps host most likely still renders its View
(text, static images, standard interaction), because that much *is* the spec. Everything this profile
adds on top -- the console's whole reason to exist, per the-prisoner#13 -- goes away. This matches
`CONSOLE-DIAGRAM-BRIEF.md`'s own hedge exactly: *"a stock MCP Apps host renders the View with none of
the profile's extras... this is a question, not a promise."* Tonight's research answers that it is
at minimum plausible (the View itself does render, per the client matrix) and confirms several of the
specific things given up, without running the experiment for real.

## 10. GPU scheduling policy (spike 2): measurement plan, not run tonight

**No GPU work was done for this section** -- no model was loaded, no Ollama call was made, per this
task's explicit instruction (a probe is using the card tonight). The one GPU fact used below is a
passive `nvidia-smi` read, which loads nothing:

```
$ nvidia-smi --query-gpu=memory.used,memory.total,name --format=csv
19070 MiB, 24564 MiB, NVIDIA GeForce RTX 4090
$ nvidia-smi --query-compute-apps=pid,used_memory,process_name --format=csv
1242038, 18044 MiB, /usr/lib/ollama/llama-server
2365786,   566 MiB, /home/derek/ComfyUI/.venv/bin/python
```

**Measured** tonight, matching the figure this task was briefed with almost exactly (19080 MiB
briefed vs. 19070 MiB read here, same 24564 MiB total): with the resident local mind model
(`muse-glimmer:30b`, per the-prisoner's own CLAUDE.md) loaded via `llama-server` at 18044 MiB, **5494
MiB (≈5.4 GB) of the 24 GB 4090 is free** tonight, alongside an idle ComfyUI process holding 566 MiB.
That headroom number is the budget every other service below has to fit inside, or displace something
to get.

### What to measure, and how (for the coordinator to run when the card is free)

For each candidate service -- **STT** (speech-to-text, for the live voice call's barge-in), **TTS**
(voices), **image generation**, **video generation** (the big unknown; "minutes, not seconds" per the
issue) -- measure, in isolation first and then co-resident with `muse-glimmer:30b`:

1. **Idle VRAM**: `nvidia-smi --query-gpu=memory.used --format=csv` immediately after the service
   loads its model/weights and before any inference, delta against the pre-load baseline.
2. **Peak VRAM during inference**: poll `nvidia-smi --query-gpu=memory.used --format=csv -l 1` (or
   the compute-apps per-process query, which also catches which process is responsible) across one
   representative call; take the max, not just the end value -- some runtimes spike during the first
   batch/allocation and settle lower.
3. **Wall-clock latency**: time-to-first-audio-frame for TTS/STT (matters for barge-in feel), total
   generation time for image/video (matters for "does a turn have to wait").
4. **Contention, not just coexistence**: repeat (1)-(3) while a synthetic wits+voice call cadence runs
   against the resident `muse-glimmer:30b` (reuse or adapt this repo's own `checkpoint` harness at low
   round count) to see whether the new service's latency or the mind's latency degrades when both
   compete for the card, not just whether both *fit* in VRAM at once. This is the same class of
   measurement OPEN-VARIANT.md §75 already did for two request drivers sharing one server (non-deterministic
   rulings) -- GPU contention between distinct model processes is a different mechanism (memory/compute
   scheduling, not shared server state) and needs its own measurement, not an assumption that §75's
   finding transfers.
5. Record every number against the specific runtime and quantization used (this repo's own CLAUDE.md
   is emphatic that "the switch follows the runtime" for other measured behaviour -- treat GPU
   footprint the same way; a different quant or backend changes the number).

### Decision rules (to fill in once (1)-(5) are measured; the shape, not the numbers, is written now)

- **Residency tiers.** *Always resident* while the console is running a turn loop: the wits model
  (needed every turn). *Warm-on-demand, evicted after idle*: voice, referee, narrator, TTS -- anything
  called at most once or twice a turn. *Exclusive, evicts everything*: video generation, if its
  measured VRAM leaves no room for anything else (plausible for a generation model sized for quality
  over speed) -- the console should say so explicitly ("generating a clip") rather than let a wits call
  silently queue behind it.
- **The live voice call is the hard case.** It wants STT + the wits model + TTS warm *together*, for
  barge-in latency. If (1)-(2) show that doesn't fit in the ≈5.4 GB free tonight alongside a 30B local
  mind, the console has two honest choices, not a silent one: (a) swap the wits model to something
  small enough to coexist for the duration of a live call, narrating the tradeoff to the player, or (b)
  route the wits call through the model router (`the-prisoner`'s own pattern, `src/tools/modelRouter.ts`
  -- a hosted call that touches no local VRAM) for the call's duration, freeing the whole card for
  STT+TTS. Either is a real design decision once the numbers exist; right now there are no numbers to
  decide between them.
- **Preemption for video.** If measurement confirms video generation needs the card to itself, it must
  fully evict every resident model first (not partially -- partial eviction that still leaves it OOM
  is worse than a clean queue), and the turn that triggered it must not block: narrate the outcome
  immediately, generate the clip in the background, and show it when it lands (already decided in the
  issue; restated here because it's the trigger for this preemption rule).
- **The existing swap discipline generalises, it doesn't get reinvented.** the-prisoner's own
  `src/ollamaSwap.ts` (unload-before-load, one call at a time, a foreign-model guard, a documented
  resident-models allowlist) is prior art for exactly this problem on a single consumer GPU. The
  console's GPU scheduler should read as this pattern generalised to *multiple kinds* of service
  (STT/TTS/image/video, not just chat models), not a parallel mechanism invented from scratch.

### Degradation table (shape decided; specific thresholds await the measurements above)

| Resource contention | Degrade to |
| --- | --- |
| No VRAM/time for TTS | Subtitles instead of spoken voice |
| No VRAM/time for video generation | A still frame (or the narrated text alone) instead of a clip |
| Live call requested while wits model is large and resident | Swap wits to a smaller model for the call's duration, or route wits through the model router for the call's duration (pick one once §10's numbers exist) |
| STT unavailable/contended during a live call | Fall back to typed input for that turn, narrated as a degradation, not a silent failure |

---

## Open items for the coordinator

- Run §10's actual measurements once the probe currently on the GPU is done.
- Decide (a) vs (b) under "the live voice call is the hard case" once those numbers exist.
- Get a Tauri-capable box (Rust + webkit2gtk dev libs) to run spike 1's other half; until then, Electron
  is the only shell with any measurement behind it.
- Treat the mcpplaygroundonline.com per-host claims in §9 as a lead to verify, not a fact to build on.
