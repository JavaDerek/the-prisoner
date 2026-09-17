// One-off probe (OPEN-VARIANT §34.1): re-ask the prisoner's recorded decision under today's code,
// baseline prompt vs PRISONER_CONDITIONS=list, before any game uses the list. Not committed code; its
// report is. DRY=1 prints the rebuilt briefings and makes no model call.
// Briefings are as recorded in batch E, with today's two briefing differences applied: the
// guard attention belief line is gone (8d139f5), and (§33.15 open item 3) so is the guard attention
// clause in her carried notes -- the current game cannot produce either.
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenPrisonerMind, type OpenPrincipalContext } from "/Users/derekferguson/rpg/the-prisoner/src/open/mind.ts";
import { openConditions } from "/Users/derekferguson/rpg/the-prisoner/src/open/conditions.ts";
import { PRISONER_IDENTITY, PRISONER_MOTIVE } from "/Users/derekferguson/rpg/the-prisoner/src/scenario.ts";
import { OllamaModelSwapper, nativeBaseUrl } from "/Users/derekferguson/rpg/the-prisoner/src/ollamaSwap.ts";

const BASE = "http://doris:11434/v1";
const WITS = "qwen3:14b";
const VOICE_STUB = "voice-stub-not-called";
const N = Number(process.env.N ?? 10);
const ARM = process.env.ARM ?? "baseline"; // baseline | list
const OUT = process.env.OUT ?? `/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-overnight/probe-conditions-${ARM}-N${N}.json`;

const turns: { tag: string; file: string; round: number; notesEdit?: [string, string] }[] = [
  { tag: "E1 r5 (bar 55, control: not yet open)", file: "2026-09-16T15-37-42-560Z", round: 5 },
  { tag: "E1 r6 (bar 40)", file: "2026-09-16T15-37-42-560Z", round: 6 },
  { tag: "E3 r6 (bar 47)", file: "2026-09-16T15-55-25-854Z", round: 6 },
  { tag: "F3 r16 (bar 32, window open)", file: "2026-09-17T01-35-04-448Z", round: 16 },
];

function recordedBriefing(file: string, round: number): string {
  const text = readFileSync("/Users/derekferguson/rpg/the-prisoner/checkpoints/" + file + ".md", "utf-8");
  const start = text.indexOf("### Round " + round + " (t=");
  const section = text.slice(text.indexOf("-- the prisoner", start));
  const m = section.match(/\*\*Briefing given, verbatim:\*\*\n```\n([\s\S]*?)\n```/);
  if (!m) throw new Error("no briefing for " + file + " r" + round);
  return m[1];
}

// Today's briefing: no guard attention belief line, and no guard attention clause in the notes.
function today(briefing: string): string {
  return briefing
    .split("\n")
    .filter((l) => !/^guard attention:/.test(l))
    .map((l) => (l.startsWith("Your notes from last round:") ? l.split(/(?<=[.;])\s*/).filter((c) => !/guard/i.test(c)).join(" ").replace(/;$/, ".").replace(/;$/, ".") : l))
    .join("\n");
}

const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(BASE), allowedModels: [WITS] });
const realFetch = fetch;
const fetchFn = (async (url: unknown, init?: RequestInit) => {
  const body = JSON.parse((init?.body as string) ?? "{}");
  if (body.model === VOICE_STUB) return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "", line: "" }) } }] }) };
  return realFetch(url as string, init);
}) as typeof fetch;
const mind = createOpenPrisonerMind({
  baseUrl: BASE, witsModel: WITS, voiceModel: VOICE_STUB, timeoutMs: 180000, fetchFn,
  ...(ARM === "list" ? { conditions: openConditions() } : {}),
  ensureLoaded: (m) => (m === VOICE_STUB ? Promise.resolve() : swapper.withModel(m, async () => {})),
});

const out: unknown[] = [];
for (const turn of turns) {
  const briefing = today(recordedBriefing(turn.file, turn.round));
  if (/guard attention/i.test(briefing)) throw new Error("guard attention survived in " + turn.tag);
  if (process.env.DRY) { console.log("==", turn.tag, "\n" + briefing.split("\n").filter((l) => !l.startsWith("You perceive")).join("\n")); continue; }
  // As the game handed them: every "You perceive the <object>: <description>" line of the recorded briefing.
  const perceivedObjects = [...briefing.matchAll(/^You perceive the ([a-z ]+): (.*)$/gm)].map((m) => ({ id: m[1].replace(/ /g, "_"), description: m[2] }));
  if (perceivedObjects.length < 9) throw new Error("perceived objects not found in " + turn.tag);
  const context: OpenPrincipalContext = { principalId: "probe", identity: PRISONER_IDENTITY, motive: PRISONER_MOTIVE, briefing, perceivedObjects };
  for (let i = 0; i < N; i++) {
    const p = await mind.consider(context);
    const row = { arm: ARM, turn: turn.tag, sample: i + 1, intent: p?.intent ?? "(silence)", plan: p?.plan ?? "", thoughts: p?.thoughts ?? "" };
    out.push(row);
    console.log(JSON.stringify({ turn: row.turn, sample: row.sample, intent: row.intent }));
  }
}
if (!process.env.DRY) {
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  await swapper.withModel(WITS, async () => {}); // no-op; unloading is done by the caller script
}
