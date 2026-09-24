// Captures the prose seat's exact round-1 prisoner request for the prompt lab, by running the REAL
// prompt builder (`createProseMind`) with an intercepting fetchFn -- so the lab edits what the game
// sends, not a transcription of it. No model is ever called: the fetch is intercepted before the
// network, exactly as `2026-09-17-price/capture-prompt.mts` does for the wits prompt.
//
// Round 1, the prisoner's seat, conditions as a list (the default since 2026-09-17), the warden
// having moved first -- which is the turn every prose probe so far has opened on, so the lab and the
// probes are editing the same words.
import { writeFileSync } from "node:fs";
import { createTestDb } from "../../src/world/testDb.js";
import { buildOpenWorld } from "../../src/open/world.js";
import { buildOpenContext } from "../../src/open/briefing.js";
import { createProseMind } from "../../src/open/proseMind.js";
import { openConditions } from "../../src/open/conditions.js";
import { seedInitialBeliefs } from "../../src/ledger/beliefs.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../src/scenario.js";

createTestDb();
const openWorld = buildOpenWorld();
seedInitialBeliefs(openWorld.base);

const context = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.prisonerT(1), 1, 10, {
  fromOther: [
    "Warden Croft examines the bar closely.",
    'Croft says: "The way a man looks at a bar tells me more than he thinks"',
  ],
});

let captured = "";
const mind = createProseMind({
  baseUrl: "http://intercepted/v1",
  model: "lab",
  selfName: PRISONER_NAME,
  otherName: WARDEN_NAME,
  conditions: openConditions({}),
  fetchFn: (async (_url: string, init: RequestInit) => {
    captured = JSON.parse(String(init.body)).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: "(intercepted)" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch,
});
await mind.consider(context);

if (!captured) throw new Error("nothing captured -- the prose mind did not reach its fetch");
// The gate `capture-prompt.mts` established: a lab prompt that has quietly lost a line of the real
// briefing is worse than no lab at all, so assert the pieces that must be there.
for (const must of ["What do you try", "Speak only as yourself", "You never decide what happens next", context.briefing.split("\n")[0]]) {
  if (!captured.includes(must)) throw new Error(`captured prompt is missing: ${JSON.stringify(must)}`);
}

writeFileSync("checkpoints/2026-09-24-prose-lab/prose-prompt-r1.txt", captured);
// eslint-disable-next-line no-console
console.log(`captured ${captured.length} chars -> checkpoints/2026-09-24-prose-lab/prose-prompt-r1.txt`);
