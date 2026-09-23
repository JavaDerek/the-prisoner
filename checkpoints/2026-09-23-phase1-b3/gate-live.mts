// The citation waiver, measured where it binds: over batch 3's OWN recorded rulings.
//
//   npx tsx checkpoints/2026-09-23-phase1-b3/gate-live.mts <tag> <referee.json...>
//
// A gate change cannot alter what the model said, so every ruling is recomputed from the reply
// the referee really gave -- no model call, nothing to re-run, and the only difference between
// two runs of this script is the code it runs under. Run it once in a tree with the waiver and
// once without, and diff the two files it writes (`gate-<tag>.json`).
//
// The recorded reply is fed back through `createRefereeTransport`'s own `fetchFn` seam rather
// than through a hand-rolled parser, so the citation rebuild (§18.1's word ranges) and the
// reader's verbatim check are the same code that ruled the game.
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const HERE = new URL(".", import.meta.url).pathname;
const [tag, ...files] = process.argv.slice(2);
if (!tag || files.length === 0) throw new Error("usage: gate-live.mts <tag> <referee.json...>");

const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const isPerson = (id: string): boolean => id === "prisoner" || id === "warden";

type Entry = { label: string; request: ReadRequest; replies: { content?: string; status?: number }[] };
const out: { tag: string; rulings: unknown[] } = { tag, rulings: [] };

for (const file of files) {
  const entries = JSON.parse(readFileSync(file, "utf-8")) as Entry[];
  for (const [i, entry] of entries.entries()) {
    // The one-act call (OPEN-VARIANT §74.1) is a separate request with its own single `acts`
    // question and no target at all; it has no ruling to recompute and no citation gate to pass.
    if (!entry.request.questions.some((q) => q.id === "target")) continue;
    const queue = entry.replies.map((r) => r.content ?? "");
    const transport = createRefereeTransport({
      baseUrl: "http://recorded",
      model: "recorded",
      ensureLoaded: async () => {},
      fetchFn: (async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: queue.shift() ?? "" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    });
    const result = await createTurnReader({ questions: entry.request.questions, transports: [transport] }).read(entry.request.sources);
    const r = computeRuling(result, entry.request, isDeclared, isPerson);
    out.rulings.push({
      file,
      i,
      label: entry.label,
      target: r.targetObjectId,
      effect: r.effectKind,
      property: r.property,
      applicable: r.applicable,
      propertyVerified: r.citations.property.verified,
      propertySource: r.citations.property.citation?.sourceId ?? null,
    });
  }
}
writeFileSync(`${HERE}gate-${tag}.json`, JSON.stringify(out, null, 1));
const applicable = out.rulings.filter((x) => (x as { applicable: boolean }).applicable).length;
console.log(`${tag}: ${out.rulings.length} rulings, ${applicable} applicable, ${out.rulings.length - applicable} refused`);
