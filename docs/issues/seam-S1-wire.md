title: The wire — createLocalMind over an OpenAI-compatible endpoint: tools: [], no credential, silence with a reason

DESIGN §7.3. The only behaviour in the seam, and the part every caller would otherwise copy.

## Deliverables

`src/wire/localMind.ts`:

- `createLocalMind<C, P>({ baseUrl, model, prompt, coerce, temperature?, timeoutMs?, fetchFn?,
  onSilence? }): Mind<C, P>`. `baseUrl` is **required** — the package knows nobody's box. Defaults:
  `temperature` 0.9, `timeoutMs` 12 000, both with their reasons in the doc comment.
- `coerceProposal(raw, maxLength = 600): Proposal | null` — `intent` a non-empty string after trim,
  `line` optional, both capped; anything else `null`.
- `firstJsonObject(text): unknown` — whole-string `JSON.parse`, else the first balanced `{…}`,
  else `null`.
- `SilenceReason = "unreachable" | "timeout" | "status" | "unparseable" | "rejected"`.

Behaviour: `assertInert(context)` first (throws — a non-inert context is a defect, not a quiet
model); `POST {baseUrl}/chat/completions` with `{ model, messages: [{ role: "user", content:
prompt(context) }], tools: [], temperature, stream: false }`; header `content-type` only;
`AbortSignal.timeout(timeoutMs)`; parse `choices[0].message.content` through `firstJsonObject`
then the caller's `coerce(raw, context)`; on any failure call `onSilence(reason, context)` and
return `null`. Never throws past the `assertInert` line, never hangs.

## Tests first, all offline with an injected fetch

- The request body carries `tools: []` and `stream: false`; the URL ends in `/chat/completions`.
- No header named `authorization` or containing `api-key`, case-insensitive.
- No `process.env` read anywhere under `src/wire/` (the S0 guard covers everywhere else; this
  one is the wire's own).
- Unreachable (`fetch` throws) → `null`, reason `unreachable`. `TimeoutError` → `timeout`.
  Non-200 → `status`. Body neither JSON nor containing a balanced object → `unparseable`.
  `coerce` returns `null` → `rejected`. Each calls `onSilence` exactly once with that reason.
- A fenced or sentence-wrapped JSON object is parsed; the caller's `coerce` receives the parsed
  value and the context.
- A context with an accessor throws before any fetch is made (`fetchFn` never called).
- `coerceProposal`: accepts intent; keeps a string line; drops a non-string line; rejects `{}`,
  whitespace intent, non-string intent, `null`, a bare string; caps at `maxLength`.
