// Screens the two questions §46 left open, without spending games on either.
//
//  1. WORDING (§46.4). v1's clause is gated on "the door is shut" -- a state she holds no belief
//     about, and the one `stated` game that stayed at the window rejected the door twice on exactly
//     that ("uncertainty about its current state"). v2 moves the antecedent to something she
//     perceives every turn and answers the second doubt ("unsure if this applies to a locked door").
//  2. PERSON. Every condition marked "(for you)" refers to the reader in the third person in its body
//     ("then Mara Voss can open the window"), so each asks the reader to resolve that they are the
//     same person. That is a `conditionList.ts` rendering choice, so it is a question for every future
//     caller of that module, not a Prisoner one.
//
// A 2x2, N asks each, at her round 1 with both ways out available -- the choice point. Same prompt
// builder the game uses, captured through an intercepting fetchFn, so only the conditions differ.
// Classified by whether her intent, and separately her plan, names the door route; her words are all
// a prompt can be judged on here, and the page's own verdict is a guess for the same reason.
import { writeFileSync } from "node:fs";
import { createTestDb, destroyTestDb } from "../../src/world/testDb.js";
import { buildOpenWorld } from "../../src/open/world.js";
import { buildOpenContext } from "../../src/open/briefing.js";
import { createOpenPrisonerMind } from "../../src/open/mind.js";
import { precedentLines } from "../../src/open/precedent.js";
import { openConditions } from "../../src/open/conditions.js";
import { seedInitialBeliefs } from "../../src/ledger/beliefs.js";
import type { Condition } from "../../src/open/conditionList.js";
import { parseLedger, beginEpisode, seenBefore } from "mother-of-invention";
import { readFileSync } from "node:fs";

const ENDPOINT = "http://doris:11434/v1/chat/completions";
const MODEL = "qwen3:14b";
const N = Number(process.env.SCREEN_N ?? "8");
const DOOR_WORDS = /\b(door|bolt|lock)\b/i;

/** v1 is what §46 shipped; v2 moves the antecedent to something she can actually check. */
const V1: Condition = { when: ["the door is shut"], then: "Mara Voss can open it, with no threshold to meet first", for: "Mara Voss" };
const V2: Condition = {
  when: ["the door stands in the cell wall"],
  then: "Mara Voss can try to open it; the lock's integrity is not a threshold she must reach first",
  for: "Mara Voss",
};
/** The reader's own conditions, in the second person the "(for you)" marker already uses. */
const toSecondPerson = (c: Condition): Condition =>
  c.for !== "Mara Voss" ? c : { ...c, then: c.then.replace(/\bMara Voss\b/g, "you").replace(/\bshe has escaped\b/, "you have escaped").replace(/\bshe must reach\b/, "you must reach") };

function conditionsFor(wording: "v1" | "v2", person: "name" | "you"): Condition[] {
  const base = openConditions();
  const withDoor = [base[0], wording === "v1" ? V1 : V2, ...base.slice(1)];
  return person === "you" ? withDoor.map(toSecondPerson) : withDoor;
}

const ledger = beginEpisode(parseLedger(JSON.parse(readFileSync("checkpoints/precedent-ledger.json", "utf8"))), "screen");
const precedents = seenBefore(ledger, { observer: "warden", actor: "prisoner", episode: "screen", limit: 10 });
const standing = precedentLines(precedents).prisoner;

async function promptFor(conditions: Condition[]): Promise<string> {
  createTestDb();
  try {
    const openWorld = buildOpenWorld();
    seedInitialBeliefs(openWorld.base);
    const context = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.prisonerT(1), 1, 30, {
      standing,
      fromOther: ['Warden Croft examines the bar closely.', 'Croft says: "The way a man looks at a bar tells me more than he thinks"'],
    });
    let captured = "";
    const mind = createOpenPrisonerMind({
      baseUrl: "http://captured.invalid/v1",
      witsModel: MODEL,
      voiceModel: MODEL,
      conditions,
      fetchFn: async (_u, init) => {
        captured = JSON.parse(String((init as RequestInit).body)).messages.map((m: { content: string }) => m.content).join("\n");
        throw new Error("captured");
      },
    });
    await mind.consider(context).catch(() => undefined);
    if (!captured) throw new Error("nothing captured");
    return captured;
  } finally {
    destroyTestDb();
  }
}

async function ask(prompt: string): Promise<{ intent: string; plan: string }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.9, stream: false }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const raw = (await res.json()).choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return { intent: String(parsed.intent ?? ""), plan: String(parsed.plan ?? "") };
  } catch {
    return { intent: "(unparseable)", plan: "" };
  }
}

const rows: string[] = [];
const ONLY = process.env.SCREEN_ONLY;
for (const wording of (["v1", "v2"] as const).filter((w) => !ONLY || w === ONLY)) {
  for (const person of ["name", "you"] as const) {
    const prompt = await promptFor(conditionsFor(wording, person));
    let intentDoor = 0;
    let planDoor = 0;
    const seen: string[] = [];
    for (let i = 0; i < N; i++) {
      const { intent, plan } = await ask(prompt);
      if (DOOR_WORDS.test(intent)) intentDoor++;
      if (DOOR_WORDS.test(plan)) planDoor++;
      seen.push(`      ${DOOR_WORDS.test(intent) ? "DOOR " : "     "}${intent}`);
    }
    const line = `${wording} / ${person}: intent names the door ${intentDoor}/${N}, plan names it ${planDoor}/${N}`;
    console.log(`\n== ${line}`);
    for (const s of seen) console.log(s);
    rows.push(line);
  }
}
console.log("\n-- summary");
for (const r of rows) console.log(`   ${r}`);
writeFileSync("checkpoints/2026-09-17-door/screen-results.txt", rows.join("\n") + "\n");
