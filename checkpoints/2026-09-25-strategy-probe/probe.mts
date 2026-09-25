// Step 1 of `docs/STRATEGY-DESIGN.md` §6: the falsifier probe, pre-registered in
// `PREDICTION.md` beside this file and committed before this script was run.
//
// WHAT MAKES THIS DIFFERENT FROM `../2026-09-24-strategy-commit-probe/commit-probe.py`, which asked the
// same shape of question last night: that one carried a hand-written one-paragraph stand-in for the
// situation and said so in its own README. This one builds the prisoner's ROUND-1 SEAT from the game's
// own code -- `buildOpenWorld`, `seedInitialBeliefs`, `buildOpenContext`, `renderSeatSituation`, the
// condition list on, presence modelled, ten rounds -- which is b6's P arm byte for byte. The memory note
// `prisoner-measurement-fidelity` is the reason: a recorded request is the wrong arm and a copied harness
// is the wrong instrument, so the situation is built here the way the game builds it, from the same
// functions, and nothing is pasted.
//
// Each option carries ITS OWN NUMBER, fixed by the OPTIONS call, for every ask that follows. The list is
// shown in a different seeded order each ask. So an option's number identifies WHICH option it is and its
// position in the shown list is a separate recorded fact -- which is the only way P0.c can tell
// identity-concentration from positional bias.
// CLAUDE.md rule 2, the hard way: `buildOpenWorld` builds a real world through run-dmcp, so it opens a
// real database. `checkpoint.ts` sets `DMCP_DB_PATH` itself (from `PRISONER_CHECKPOINT_DB`, defaulting
// under /tmp); a script that imports the world code DIRECTLY does not get that, and run-dmcp's own
// default is `data/games.db` under the repo. The first run of this file created exactly that empty file
// before failing on a missing table -- recorded in RESULTS.md rather than quietly fixed. The connection
// is opened lazily, on the first `buildWorld`, so setting it here is enough; the runner passes it too.
process.env.DMCP_DB_PATH ??= `/tmp/strategy-probe-${process.pid}.db`;

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { firstJsonObject } from "mind-seam";
import { initializeSchema } from "run-dmcp";
import { prisonerMigration } from "../../src/world/schema.js";
import { buildOpenWorld } from "../../src/open/world.js";
import { buildOpenContext } from "../../src/open/briefing.js";
import { openConditions } from "../../src/open/conditions.js";
import { renderSeatSituation } from "../../src/open/mind.js";
import { seedInitialBeliefs } from "../../src/ledger/beliefs.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const URL_BASE = process.env.PRISONER_MODEL_URL ?? "http://localhost:8799/v1";
const MODEL = "muse-glimmer-30b-q4_k_m";
const SEED = 20260925;
const ROUNDS = 10;

/** The prisoner's round-1 seat, as `runOpenGame` would hand it to the mind. `window` is the only arm
 *  this file ever changes (P0.f welds it, which drops the two conditions naming the bar and nothing
 *  else); everything else is b6's P defaults. */
function seatAtRoundOne(window: "open" | "welded"): { situation: string; ids: string[] } {
  // The same startup pass `checkpoint.ts` makes: run-dmcp's own tables and this repository's, in the
  // scratch file DMCP_DB_PATH now names.
  initializeSchema({ migrations: [prisonerMigration] });
  const openWorld = buildOpenWorld({ presence: "modelled", window });
  seedInitialBeliefs(openWorld.base);
  const t = openWorld.base.clock.prisonerT(1);
  const context = buildOpenContext(openWorld, "prisoner", t, 1, ROUNDS, {}, "modelled");
  const conditions = openConditions({ window });
  return {
    situation: renderSeatSituation("Voss", "Croft", context, conditions),
    ids: context.perceivedObjects.map((o) => o.id),
  };
}

const OPTIONS_ASK =
  "List 5 to 8 DIFFERENT concrete things you could try over this game to get out, each grounded only in " +
  "what you can reach or perceive above. Number them. List only; choose nothing. Answer with one JSON " +
  'array of objects: [{"text": string, "reason": string}].';

const commitAsk = (numbered: string) =>
  `Your options this game, as you listed them:\n${numbered}\n\n` +
  'Which ONE of these do you pursue this game? Answer with one JSON object: {"chosen": number, "strategy": string, "targets": [string]} -- ' +
  '"chosen" is the option\'s number; "strategy" is one sentence, at most 200 characters, you will be shown every turn to remind you what ' +
  'you are trying to do; "targets" names 1 or 2 of the object ids above that this strategy works on.';

const COMMIT_SCHEMA = {
  type: "object",
  properties: {
    chosen: { type: "integer" },
    strategy: { type: "string" },
    targets: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
  },
  required: ["chosen", "strategy", "targets"],
  additionalProperties: false,
};

type Ask = {
  content: string;
  reasoning: string;
  toks: number;
  secs: number;
  finish: string | null;
  httpError?: string;
};

async function ask(prompt: string, strength: "none" | "high" | "medium", schema: unknown | null): Promise<Ask> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    chat_template_kwargs: { reasoning_strength: strength },
  };
  if (schema) body.response_format = { type: "json_schema", json_schema: { name: "strategy", schema } };
  const t = Date.now();
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (err) {
    return { content: "", reasoning: "", toks: 0, secs: (Date.now() - t) / 1000, finish: null, httpError: String(err) };
  }
  const text = await res.text();
  if (!res.ok) return { content: "", reasoning: "", toks: 0, secs: (Date.now() - t) / 1000, finish: null, httpError: `${res.status} ${text.slice(0, 300)}` };
  const d = JSON.parse(text) as {
    choices: { message: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string }[];
    usage?: { completion_tokens?: number };
  };
  const m = d.choices[0]?.message ?? {};
  return {
    content: m.content ?? "",
    reasoning: m.reasoning_content ?? m.reasoning ?? "",
    toks: d.usage?.completion_tokens ?? 0,
    secs: Math.round((Date.now() - t) / 100) / 10,
    finish: d.choices[0]?.finish_reason ?? null,
  };
}

/** mulberry32 -- a seeded shuffle, so "a different random order each ask" is reproducible from the
 *  recorded seed rather than trusted. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(xs: readonly T[], next: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type Option = { readonly n: number; readonly text: string; readonly reason?: string };

/** The coercion the probe applies to a COMMIT reply. Deliberately generous in the ways §6 step 1 calls a
 *  BUG rather than a result: the object is found by `firstJsonObject`'s balanced braces so a wrapped or
 *  chattered reply still parses, ids are matched case-insensitively, and a `targets` entry that names an
 *  option number instead of an id is still read. What it does NOT do is guess a choice: an out-of-range or
 *  missing `chosen`, or zero surviving ids, is a genuine invalid. */
function coerce(content: string, options: readonly Option[], ids: readonly string[]) {
  const obj = firstJsonObject(content) as { chosen?: unknown; strategy?: unknown; targets?: unknown } | null;
  if (!obj || typeof obj !== "object") return { valid: false as const, why: "no JSON object in content" };
  const chosen = typeof obj.chosen === "number" ? obj.chosen : Number.isFinite(Number(obj.chosen)) ? Number(obj.chosen) : NaN;
  const option = options.find((o) => o.n === chosen);
  if (!option) return { valid: false as const, why: `chosen ${JSON.stringify(obj.chosen)} is not an option number` };
  const lower = new Map(ids.map((i) => [i.toLowerCase(), i]));
  const raw = Array.isArray(obj.targets) ? obj.targets : [];
  const targets = [...new Set(raw.map((x) => lower.get(String(x).trim().toLowerCase())).filter((x): x is string => x !== undefined))];
  if (targets.length === 0) return { valid: false as const, why: `no target resolved to a perceived id: ${JSON.stringify(raw)}` };
  const strategy = typeof obj.strategy === "string" ? obj.strategy : "";
  return { valid: true as const, chosen, option, targets, strategy, overLong: strategy.length > 200 };
}

async function main() {
  const welded = process.argv.includes("--welded");
  const strength = (process.argv.find((a) => a.startsWith("--strength="))?.split("=")[1] ?? "high") as "high" | "medium";
  const noneAsks = Number(process.argv.find((a) => a.startsWith("--none="))?.split("=")[1] ?? (welded ? 10 : 10));
  const strongAsks = Number(process.argv.find((a) => a.startsWith("--strong="))?.split("=")[1] ?? (welded ? 0 : 20));
  const tag = process.argv.find((a) => a.startsWith("--tag="))?.split("=")[1] ?? (welded ? "welded" : "main");

  const seat = seatAtRoundOne(welded ? "welded" : "open");
  writeFileSync(join(HERE, `situation-${tag}.txt`), `${seat.situation}\n`);
  console.log(`[${tag}] situation ${seat.situation.length} chars, ${seat.ids.length} perceived ids: ${seat.ids.join(", ")}`);

  // ONE options call fixes the list for every ask that follows (§5.0). Reasoning `none`, per §3.2.
  const optionsPrompt = `${seat.situation}\n\n${OPTIONS_ASK}`;
  writeFileSync(join(HERE, `options-prompt-${tag}.txt`), `${optionsPrompt}\n`);
  let options: Option[] = [];
  let optionsReply: Ask | null = null;
  for (let attempt = 1; attempt <= 3 && options.length === 0; attempt++) {
    optionsReply = await ask(optionsPrompt, "none", null);
    const arr = ((): unknown[] => {
      const t = optionsReply.content.trim();
      const start = t.indexOf("[");
      if (start < 0) return [];
      for (let end = t.lastIndexOf("]"); end > start; end = t.lastIndexOf("]", end - 1)) {
        try {
          const v = JSON.parse(t.slice(start, end + 1)) as unknown;
          if (Array.isArray(v)) return v;
        } catch {
          /* keep walking back to the previous closing bracket */
        }
      }
      return [];
    })();
    const seen = new Set<string>();
    options = arr
      .map((x) => (typeof x === "string" ? { text: x } : (x as { text?: unknown; reason?: unknown })))
      .map((x) => ({ text: String(x.text ?? "").trim(), reason: x.reason === undefined ? undefined : String(x.reason) }))
      .filter((x) => x.text.length > 0)
      .filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true))) // §20.1: exact duplicates collapse, first kept
      .map((x, i) => ({ n: i + 1, text: x.text, ...(x.reason ? { reason: x.reason } : {}) }));
    console.log(`[${tag}] OPTIONS attempt ${attempt}: ${options.length} options, ${optionsReply.toks} toks, ${optionsReply.secs}s${optionsReply.httpError ? ` HTTP ${optionsReply.httpError}` : ""}`);
  }
  if (options.length === 0) {
    writeFileSync(join(HERE, `options-raw-${tag}.json`), JSON.stringify(optionsReply, null, 2));
    throw new Error("OPTIONS call produced no usable list in three attempts -- see options-raw-*.json");
  }
  writeFileSync(join(HERE, `options-${tag}.json`), JSON.stringify({ reply: optionsReply, options }, null, 2));
  for (const o of options) console.log(`  ${o.n}. ${o.text}`);

  const next = rng(SEED + (welded ? 1000 : 0));
  const rows: unknown[] = [];
  const plan: { strength: "high" | "medium" | "none"; i: number }[] = [
    ...Array.from({ length: strongAsks }, (_, i) => ({ strength, i: i + 1 })),
    ...Array.from({ length: noneAsks }, (_, i) => ({ strength: "none" as const, i: i + 1 })),
  ];
  for (const step of plan) {
    const order = shuffled(options, next);
    const numbered = order.map((o) => `${o.n}. ${o.text}`).join("\n");
    const prompt = `${seat.situation}\n\n${commitAsk(numbered)}`;
    const reply = await ask(prompt, step.strength, COMMIT_SCHEMA);
    const c = coerce(reply.content, options, seat.ids);
    const position = c.valid ? order.findIndex((o) => o.n === c.chosen) + 1 : null;
    const row = {
      tag,
      strength: step.strength,
      ask: step.i,
      orderShown: order.map((o) => o.n),
      valid: c.valid,
      why: c.valid ? null : c.why,
      chosen: c.valid ? c.chosen : null,
      position,
      targets: c.valid ? c.targets : null,
      strategy: c.valid ? c.strategy : null,
      overLong: c.valid ? c.overLong : null,
      toks: reply.toks,
      secs: reply.secs,
      reasoningChars: reply.reasoning.length,
      finish: reply.finish,
      httpError: reply.httpError ?? null,
      content: reply.content,
      reasoningContent: reply.reasoning,
    };
    rows.push(row);
    console.log(
      `[${tag}] ${step.strength} #${step.i}: ${c.valid ? `chose ${c.chosen} at position ${position} -> ${c.valid ? c.targets.join("+") : ""}` : `INVALID (${c.why})`} ` +
        `${reply.toks}t ${reply.secs}s r${reply.reasoning.length}${reply.finish && reply.finish !== "stop" ? ` finish=${reply.finish}` : ""}`
    );
    writeFileSync(join(HERE, `replies-${tag}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  console.log(`[${tag}] done: ${rows.length} asks written to replies-${tag}.jsonl`);
}

await main();
