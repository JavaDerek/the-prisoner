// One-off probe (OPEN-VARIANT §34.3): re-ask the WARDEN's recorded decision from batch G, baseline
// prompt vs the condition list read from its own side, before any game gives the warden the list.
// Critical turns: the warden turn right after the prisoner opened the window (a look at the window
// then, with suspicion >= 40, catches). Controls: an earlier warden turn in two games. Intents read
// by hand. DRY=1 prints briefings only.
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenWardenMind, type OpenPrincipalContext } from "/Users/derekferguson/rpg/the-prisoner/src/open/mind.ts";
import { openConditions } from "/Users/derekferguson/rpg/the-prisoner/src/open/conditions.ts";
import { WARDEN_IDENTITY, WARDEN_MOTIVE } from "/Users/derekferguson/rpg/the-prisoner/src/scenario.ts";
import { OllamaModelSwapper, nativeBaseUrl } from "/Users/derekferguson/rpg/the-prisoner/src/ollamaSwap.ts";

const BASE = "http://doris:11434/v1";
const WITS = "qwen3:14b";
const VOICE_STUB = "voice-stub-not-called";
const N = Number(process.env.N ?? 5);
const ARM = process.env.ARM ?? "baseline"; // baseline | list
const OUT = `/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-overnight/probe-warden-${ARM}-N${N}.json`;

const turns = [
  { tag: "G1 r7 (window opened last turn)", file: "2026-09-17T03-42-30-378Z", round: 7 },
  { tag: "G2 r7 (window opened last turn)", file: "2026-09-17T03-51-05-772Z", round: 7 },
  { tag: "G3 r6 (window opened last turn)", file: "2026-09-17T03-58-48-172Z", round: 6 },
  { tag: "G4 r6 (window opened last turn)", file: "2026-09-17T04-05-11-968Z", round: 6 },
  { tag: "G1 r4 (control)", file: "2026-09-17T03-42-30-378Z", round: 4 },
  { tag: "G3 r3 (control)", file: "2026-09-17T03-58-48-172Z", round: 3 },
];

function recordedBriefing(file: string, round: number): string {
  const text = readFileSync("/Users/derekferguson/rpg/the-prisoner/checkpoints/" + file + ".md", "utf-8");
  const start = text.indexOf("### Round " + round + " (t=");
  const section = text.slice(start, text.indexOf("-- the prisoner", start));
  if (!section.includes("-- the warden")) throw new Error("no warden section " + file + " r" + round);
  const m = section.match(/\*\*Briefing given, verbatim:\*\*\n```\n([\s\S]*?)\n```/);
  if (!m) throw new Error("no briefing for " + file + " r" + round);
  return m[1];
}

const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(BASE), allowedModels: [WITS] });
const realFetch = fetch;
const fetchFn = (async (url: unknown, init?: RequestInit) => {
  const body = JSON.parse((init?.body as string) ?? "{}");
  if (body.model === VOICE_STUB) return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "", line: "" }) } }] }) };
  return realFetch(url as string, init);
}) as typeof fetch;
const mind = createOpenWardenMind({
  baseUrl: BASE, witsModel: WITS, voiceModel: VOICE_STUB, timeoutMs: 180000, fetchFn,
  ...(ARM === "list" ? { conditions: openConditions() } : {}),
  ensureLoaded: (m) => (m === VOICE_STUB ? Promise.resolve() : swapper.withModel(m, async () => {})),
});

const out: unknown[] = [];
for (const turn of turns) {
  const briefing = recordedBriefing(turn.file, turn.round);
  if (process.env.DRY) { console.log("==", turn.tag, "\n" + briefing.split("\n").filter((l) => !l.startsWith("You perceive")).join("\n")); continue; }
  const perceivedObjects = [...briefing.matchAll(/^You perceive the ([a-z ]+): (.*)$/gm)].map((m) => ({ id: m[1].replace(/ /g, "_"), description: m[2] }));
  if (perceivedObjects.length < 9) throw new Error("perceived objects not found in " + turn.tag);
  const context: OpenPrincipalContext = { principalId: "probe", identity: WARDEN_IDENTITY, motive: WARDEN_MOTIVE, briefing, perceivedObjects };
  for (let i = 0; i < N; i++) {
    const p = await mind.consider(context);
    const row = { arm: ARM, turn: turn.tag, sample: i + 1, intent: p?.intent ?? "(silence)", plan: p?.plan ?? "", thoughts: p?.thoughts ?? "" };
    out.push(row);
    console.log(JSON.stringify({ turn: row.turn, sample: row.sample, intent: row.intent }));
  }
}
if (!process.env.DRY) writeFileSync(OUT, JSON.stringify(out, null, 2));
