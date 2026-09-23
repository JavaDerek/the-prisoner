// The refusal audit, generated rather than transcribed by hand.
//
//   npx tsx checkpoints/2026-09-23-phase1-b3/audit.mts <out.csv> <referee.json...>
//
// One row per REFUSED ruling, recomputed from the reply the referee really gave (the same
// recorded-reply path `gate-live.mts` uses, so the two always agree). Each row carries a proposed
// class and a proposed JURISDICTION -- the owner's four buckets, 2026-09-23:
//
//   prisoner   this game's own content: the scenario, the door's price, what the cell holds
//   run-dmcp   generic mechanism, admitted only by the engine's own test (generic + a real caller)
//   authoring  a lesson for run-dmcp/docs/AUTHORING-GUIDE.md, in the engine's neutral vocabulary
//   model      not a code fix at all -- the referee read it wrong and a better reader gets it right
//
// Both proposals are this script's guess from the KEYS alone and are wrong often enough to be
// worth checking; `your_class` and `your_jurisdiction` are the owner's, and only those two count.
// (OPUS-FIRST-DESIGN §2: the refusal classification is a labelled human audit, never an automated
// rule. This file automates the TYPING, never the judgement.)
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const [out, ...files] = process.argv.slice(2);
if (!out || files.length === 0) throw new Error("usage: audit.mts <out.csv> <referee.json...>");

const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const isPerson = (id: string): boolean => id === "prisoner" || id === "warden";

/** Which applicability clause failed, in the words a reader of the transcript would recognise. */
function whyRefused(r: ReturnType<typeof computeRuling>): string {
  if (r.targetObjectId === "none" && r.effectKind !== "noise") return "no object the actor can reach or perceive was named";
  if (r.effectKind === "none") return `refused, its effect on the ${r.targetObjectId} left unread`;
  if (!r.citations.target.verified) return "the target citation did not verify against the intent";
  if (!r.citations.effect.verified) return "the effect citation did not verify against the intent";
  if (!r.citations.property.verified) return `the property citation did not verify against ${r.targetObjectId}'s own description`;
  if (r.property === "none") return `${r.effectKind} named no property`;
  if (!isDeclared(r.targetObjectId, r.property)) return `${r.property} is a property the ${r.targetObjectId} does not declare`;
  return "refused for a reason this script could not name -- read the transcript";
}

/** A guess at the owner's two labels. Deliberately crude, and it consults the DECLARED-PROPERTY
 *  table, because without it every `property: none` looks alike: a conceal on the spoon (which
 *  declares `concealment`, and was ruled that way seven times in these games) is the referee
 *  dropping a property it knew; the same answer on the meal tray (which declares nothing at all)
 *  is the scenario giving an examiner nothing to find. Those are two different buckets and the
 *  keys alone cannot tell them apart. A guess that looks authoritative is worse than one that
 *  obviously needs checking. */
function propose(r: ReturnType<typeof computeRuling>, intent: string): { cls: string; juris: string } {
  const words = intent.toLowerCase();
  const declares = propsOf(r.targetObjectId);

  // FIRST, because a ruling with no target at all has no declared-property table to reason from,
  // and every rule below would otherwise read its emptiness as a statement about an object.
  // A target the actor genuinely cannot reach is the referee being RIGHT; the question such a row
  // raises is whether the scenario should have left her something to do, not whether to fix code.
  if (r.targetObjectId === "none" && !/between|block|stand firm|fill the doorway|interpose|hand resting on/.test(words))
    return { cls: "correctly refused: nothing named is in reach", juris: "prisoner" };

  // A PERSON target gets no confident bucket, because on these rows the keys actively mislead.
  // Measured 2026-09-23 on batch 3's own refusals: three rulings with identical keys
  // (`<person>/<effect>/none`) turned out to be three different buckets once the INTENT was read --
  // "throw the blanket over her head to blind and tangle her" is an unbuilt mechanism (a person
  // declares only `posture`, and nothing restrains or blinds); "swing the bucket at her head" is
  // arguable either way; and "study her posture and bearing", which uses the very word the property
  // list offers, is simply misread. The keys say a refusal happened and what shape it has; they do
  // not say whose fault it is.
  if (isPerson(r.targetObjectId) && r.property === "none")
    return { cls: `needs reading: ${r.effectKind} on a person with no property named -- unbuilt mechanism, or misread? the intent decides`, juris: "" };

  // An effect was named and its property dropped, on a target that declares one to name.
  if (r.effectKind !== "none" && r.property === "none" && declares.length > 0)
    return { cls: `misruled: ${r.effectKind} named, property dropped (${r.targetObjectId} declares ${declares.join("/")})`, juris: "model" };

  // Nothing to find: the target declares no property at all, so no examination of it can land.
  if (r.effectKind !== "none" && r.property === "none" && declares.length === 0)
    return { cls: `authoring: the ${r.targetObjectId} declares no property, so there is nothing to find on it`, juris: "authoring" };

  if (r.effectKind === "none" && /sharpen|grind|hone|whet|file at|scrape|dig|pry|bend/.test(words))
    return { cls: "misruled: an act with a real effect read as none", juris: "model" };

  if (r.effectKind === "none" && /place|put|set .*(down|on)|slide .*(under|through|back)|onto the/.test(words))
    return { cls: "unbuilt: put a thing somewhere", juris: "run-dmcp" };

  if (/between|block|bar (her|his) way|stand firm|fill the doorway|interpose|body between|hand resting on/.test(words))
    return { cls: "unbuilt: interpose", juris: "run-dmcp" };

  if (r.effectKind === "none" && /sit|lean|rest|wait|watch|listen|stand still|do nothing/.test(words))
    return { cls: "unbuilt: no-change act (wait and watch)", juris: "run-dmcp" };

  return { cls: "unclassified", juris: "" };
}

const esc = (s: string): string => `"${String(s).replace(/"/g, '""')}"`;
const rows: string[] = [];
let n = 0;

for (const file of files) {
  const entries = JSON.parse(readFileSync(file, "utf-8")) as { label: string; request: ReadRequest; replies?: { content?: string }[] }[];
  for (const entry of entries) {
    if (!entry.request.questions.some((q) => q.id === "target")) continue;
    const queue = (entry.replies ?? []).map((r) => r.content ?? "");
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
    if (r.applicable) continue;
    // "round 7, prisoner: <intent>" -- the label `referee.ts` records per ruling.
    const m = /^round (\d+), (\w+): ([\s\S]*)$/.exec(entry.label);
    const [round, chair, intent] = m ? [m[1], m[2], m[3]] : ["?", "?", entry.label];
    const p = propose(r, intent);
    rows.push(
      [
        String(++n),
        esc(file.split("/").pop() ?? file),
        round,
        chair,
        r.targetObjectId,
        r.effectKind,
        r.property,
        esc(intent),
        esc(whyRefused(r)),
        esc(p.cls),
        esc(p.juris),
        "",
        "",
        "",
      ].join(",")
    );
  }
}

writeFileSync(
  out,
  ["row,transcript,round,chair,target,effect,property,intent,why_refused,proposed_class,proposed_jurisdiction,your_class,your_jurisdiction,notes", ...rows].join("\n") + "\n"
);
console.log(`${out}: ${n} refusals`);
