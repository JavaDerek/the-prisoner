// Captures the prisoner's exact round-1 wits request for the prompt lab, for both price arms, by
// running the REAL prompt builder with a capturing fetchFn -- so the lab edits what the game sends,
// not a transcription of it. No model is ever called: the fetch is intercepted before the network.
//
// Round 1 is the turn §45 is about. The bar is at 100, nothing is forced, the ledger's most-repeated
// approach is priced in front of her, and in both arms she reached for it anyway. The lab's job is to
// find wording that makes her reach for something else.
//
// The precedent block is written out with a {{PRECEDENT}} placeholder so the page can swap that region
// alone, and separately in full, so a variant can be diffed against what the game really said.
import { writeFileSync } from "node:fs";
import { createTestDb, destroyTestDb } from "../../src/world/testDb.js";
import { buildOpenWorld } from "../../src/open/world.js";
import { buildOpenContext } from "../../src/open/briefing.js";
import { createOpenPrisonerMind } from "../../src/open/mind.js";
import { precedentLines, type PrecedentPrice } from "../../src/open/precedent.js";
import { openConditions } from "../../src/open/conditions.js";
import { parseLedger, beginEpisode, seenBefore } from "mother-of-invention";
import { seedInitialBeliefs } from "../../src/ledger/beliefs.js";
import { readFileSync } from "node:fs";

const OUT = "checkpoints/2026-09-17-price";
const PRECEDENT_LIMIT = 10; // checkpoint.ts's own limit, so the lab shows what a real game shows
const ledger = beginEpisode(parseLedger(JSON.parse(readFileSync("checkpoints/precedent-ledger.json", "utf8"))), "lab");
const precedents = seenBefore(ledger, { observer: "warden", actor: "prisoner", episode: "lab", limit: PRECEDENT_LIMIT });

// Both arms' blocks, so the faithfulness gate below can tell a precedent line (which legitimately
// differs by arm) from a line of the briefing proper (which must never differ at all).
const blockFor = (price: PrecedentPrice) => precedentLines(precedents, { price }).prisoner;
const anyBlockLine = new Set([...blockFor("flat"), ...blockFor("stale")]);

for (const price of ["flat", "stale"] as const satisfies readonly PrecedentPrice[]) {
  const standing = blockFor(price);
  createTestDb();
  const openWorld = buildOpenWorld();
  // What runOpenGame does before the first turn, and what the briefing's belief lines come from.
  seedInitialBeliefs(openWorld.base);
  // Faithful to the turn this is a lab for: in that game the warden moved first in round 1, so her
  // r1 briefing carried its act and its line. Taken from the transcript, which prints both verbatim.
  const context = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.prisonerT(1), 1, 30, {
    standing,
    fromOther: ['Warden Croft examines the bar closely.', 'Croft says: "The way a man looks at a bar tells me more than he thinks"'],
  });

  let captured = "";
  let schema = "";
  const mind = createOpenPrisonerMind({
    baseUrl: "http://captured.invalid/v1",
    witsModel: "qwen3:14b",
    voiceModel: "qwen3:14b",
    conditions: openConditions(),
    fetchFn: async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      captured = body.messages.map((m: { content: string }) => m.content).join("\n");
      // Today's live schema, so the lab forces exactly the answer the game forces. Written under its
      // own name: the existing lab pages have their own copy and must not be disturbed.
      schema = JSON.stringify(body.response_format, null, 2);
      // Enough of an answer that the mind returns without a second (voice) call.
      throw new Error("captured");
    },
  });
  await mind.consider(context).catch(() => undefined);
  destroyTestDb();

  if (!captured) throw new Error(`nothing captured for ${price}`);
  const block = standing.join("\n");
  if (!captured.includes(block)) throw new Error(`the precedent block is not verbatim in the ${price} prompt`);
  const recorded = readFileSync("checkpoints/2026-09-17T19-35-58-790Z.md", "utf8");
  const briefing = /### Round 1 \(t=4\) -- the prisoner\n\n\*\*Briefing given, verbatim:\*\*\n```\n([\s\S]*?)\n```/.exec(recorded)?.[1] ?? "";
  const absent = briefing.split("\n").filter((l) => l.trim() !== "" && !anyBlockLine.has(l) && !captured.includes(l));
  if (absent.length > 0) throw new Error(`the ${price} prompt is missing ${absent.length} line(s) the game really sent, e.g. ${JSON.stringify(absent[0])}`);
  console.log(`  faithful: every line of the recorded r1 briefing is present (${briefing.split("\n").filter((l) => l.trim()).length} lines checked)`);
  writeFileSync(`${OUT}/prisoner-prompt-r1-${price}.txt`, captured.replace(block, "{{PRECEDENT}}"));
  writeFileSync(`${OUT}/precedent-block-${price}.txt`, block);
  writeFileSync(`${OUT}/response_format-price.json`, schema);
  console.log(`prisoner-prompt-r1-${price}.txt  (${captured.length} chars, precedent block ${block.length} chars extracted)`);
}
