title: The wits thinking switch sends a field this server ignores, so every `Thinking (wits): OFF` header line is true for the wrong reason

Measured 2026-09-25 03:22Z and again at 04:00Z (`checkpoints/2026-09-25-strategy-probe/SETUP.md`), against the
live llama-server serving Muse-Glimmer-30B, one trivial prompt at temperature 0:

| request field | completion tokens | reasoning chars |
|---|---|---|
| `chat_template_kwargs: {"reasoning_strength":"none"}` | 33 | 90 |
| `chat_template_kwargs: {"reasoning_strength":"low"}` | 51 | 183 |
| `chat_template_kwargs: {"reasoning_strength":"medium"}` | 60 | 220 |
| `chat_template_kwargs: {"reasoning_strength":"high"}` | 109 | 432 |
| **`reasoning_effort: "high"`** | **33** | **90** |

`src/open/thinking.ts`'s `withThinking` sends `reasoning_effort`. On this server that field changes
nothing: it is the same 33 tokens as `none`. What actually held reasoning off across batches 3 through 6
is the server's own command line, `--chat-template-kwargs '{"reasoning_strength":"none"}'`, set when the
process was started and true of every request any client sent it.

**What this does and does not invalidate.** The batches are not wrong: reasoning really was off, so the
transcripts describe what happened. What is wrong is the *reason* a reader would give — the header line
attributes it to a variable that did nothing, and a future run against a server started WITHOUT that flag
would print the identical `Thinking (wits): OFF` line while the model reasoned freely. The memory note
`prisoner-thinking-changes-rulings` (2026-09-20: the referee's target question answers differently ON
versus OFF) is what makes that a live hazard rather than a tidy-up.

## FIXED 2026-09-25 (fixes 1 and 2), except fix 3 -- see below

`src/open/thinking.ts` and `src/open/refereeTransport.ts` now send
`chat_template_kwargs: { reasoning_strength: "none" }`, merged into any the caller already set, and
`thinkingHeaderLine` names the field and value actually sent. **A per-request value overrides the
server's start flag** (measured here), so no restart of llama-server was needed. Verified live after
the change: `withThinking` off = 44 tokens, `on` (bare) = 44 tokens -- the flag still deciding, which
is now what the header SAYS -- and an explicit `high` = 79. Tests in `src/open/__tests__/thinking.test.ts`,
`mind.test.ts` and `refereeTransport.test.ts`; 1194 green, typecheck clean, lint 0 errors.

**Fix 3 is deliberately NOT done.** This issue calls it "the cheap version of 1", and 1 is now done
properly: the header is checkable against the wire. It would still catch a *different* server that
ignores `chat_template_kwargs` too, so the issue stays open on that point alone rather than closed.

**A consequence found while fixing it, worth more than the fix.** `checkpoints/2026-09-25-referee-thinking/`
(OPEN-VARIANT.md §75.5) measured the referee arm properly once a serial baseline existed: reasoning is
**worse in both directions** on Muse-Glimmer -- `none` 6 correct resolutions and 0 false, `high` 3 correct
and 1 false, breaking 4 of the 6 rows `none` gets right. So `ROLE_DEFAULT.referee` is flipped from `on`
to `off`. The "live hazard" this issue named was real and is now doubly so: a server restarted without the
flag would have made the referee measurably worse, not merely different.

**Fix, in the order that matters:**

1. The header must print **the field and the value actually sent**, not a word that stands for them. A
   run whose strength came from the server's flag rather than the request should say so.
2. `withThinking` should send `chat_template_kwargs: { reasoning_strength }` for a llama.cpp-served
   model. `reasoning_effort` is kept only where a served model honours it, and the two are not synonyms.
3. A startup assertion is the cheap version of 1: ask the served model once with `none` and once with
   `high` and fail the run if the token counts do not differ, so a server flag and a request field cannot
   silently disagree again.

Found while designing the strategy step (`docs/STRATEGY-DESIGN.md` §1.1), whose commit call needs a
per-request strength and therefore had to learn which field carries one.
