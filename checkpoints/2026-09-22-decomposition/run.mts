// Decomposition probe (PREDICTION.md): the main request, plus a target-only call, plus a direction-only call when the
// effect changes a property. The decomposed answers REPLACE the main call's, citations and all, and the ruling goes
// through today's `computeRuling` unchanged. usage (repo root):
//   PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_OLLAMA_RESIDENT_MODELS= npx tsx checkpoints/2026-09-22-decomposition/run.mts [N]
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReaderQuestion } from "run-dmcp";
import { createReferee, computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { readThinkingMode } from "../../src/open/thinking.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const HERE = new URL(".", import.meta.url).pathname;
const N = Number(process.argv[2] ?? "3");
const PICK = ["b2#5", "b1#34", "b1#13", "b1#25", "b1#16", "b1#50"];
const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const transport = createRefereeTransport({
  baseUrl: process.env.PRISONER_MODEL_URL ?? "http://doris:11434/v1",
  model: "qwen3:14b",
  thinking: readThinkingMode(process.env.PRISONER_THINKING),
  timeoutMs: 300000,
  ensureLoaded: async () => {},
});
const ask = async (questions: ReaderQuestion[], sources: { id: string; text: string }[]) =>
  createTurnReader({ questions, transports: [transport] }).read(sources);

const rows = (JSON.parse(readFileSync(`${HERE}../2026-09-22-referee-capacity/rows.json`, "utf-8")) as any[]).filter((r) => PICK.includes(r.id));
const out: any = { model: "qwen3:14b", n: N, rows: [] };
for (const row of rows) {
  let main: any = null;
  await createReferee([async (r) => ((main = r), [])], { isDeclared, propertiesOf: propsOf }).rule(row.intent, row.perceived);
  const targetQ = { ...main.questions.find((q: any) => q.id === "target"), prompt: main.questions.find((q: any) => q.id === "target").prompt };
  const tries = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const baseResult = await ask(main.questions, main.sources);
    const answers = [...baseResult.answers];
    const put = (id: string, a: any) => {
      const k = answers.findIndex((x) => x.questionId === id);
      if (k >= 0) answers[k] = { ...answers[k], ...a };
    };
    // (2) target alone, same closed list, the intent as the only source.
    const tRes = await ask([targetQ as ReaderQuestion], [{ id: "intent", text: row.intent }]);
    const tAns = tRes.answers.find((a) => a.questionId === "target");
    if (tAns && !tAns.fromSafeDefault) put("target", { answerKey: tAns.answerKey, citation: tAns.citation, fromSafeDefault: false });
    const target = answers.find((a) => a.questionId === "target")!.answerKey;
    const effect = answers.find((a) => a.questionId === "effect")!.answerKey;
    const property = answers.find((a) => a.questionId === "property")!.answerKey;
    // (3) direction alone, only for an effect that moves a property.
    let dir = "";
    if ((effect === "wear" || effect === "restore") && property !== "none") {
      const dq: ReaderQuestion = {
        id: "direction",
        prompt:
          `Does the actor's intent aim to RAISE or LOWER the ${property} of the ${target.replace(/_/g, " ")}? Answer raise when the act is meant to improve, ` +
          `sharpen, mend, tighten or restore it, however rough the method; lower when it is meant to damage, dull, weaken or wear it away. ` +
          `Cite the exact words in the actor's intent that show which way it goes.`,
        answerKeys: ["raise", "lower"],
        safeDefault: "lower",
      };
      const dRes = await ask([dq], [{ id: "intent", text: row.intent }]);
      const dAns = dRes.answers.find((a) => a.questionId === "direction");
      if (dAns && !dAns.fromSafeDefault) {
        dir = dAns.answerKey;
        put("effect", { answerKey: dir === "raise" ? "restore" : "wear", citation: dAns.citation, fromSafeDefault: false });
      }
    }
    const ruling = computeRuling({ ...baseResult, answers }, main, isDeclared, (id) => id === "prisoner" || id === "warden");
    const keys = `${ruling.targetObjectId}/${ruling.effectKind}`;
    tries.push({ keys, property: ruling.property, direction: dir, applicable: ruling.applicable, right: row.accept.includes(keys) && ruling.applicable, secs: Math.round((Date.now() - t0) / 1000) });
  }
  const right = tries.filter((t) => t.right).length * 2 > N;
  out.rows.push({ id: row.id, accept: row.accept, right, tries });
  writeFileSync(`${HERE}results.json`, JSON.stringify(out, null, 1));
  console.log(`${row.id.padEnd(6)} ${right ? "RIGHT" : "wrong"}  ${tries.map((t) => `${t.keys}${t.direction ? `(${t.direction})` : ""}${t.applicable ? "+" : "-"}`).join("  ")}  ${tries.map((t) => t.secs).join(",")}s`);
}
console.log(`\ndecomposed: ${out.rows.filter((r: any) => r.right).length}/${out.rows.length} right`);
