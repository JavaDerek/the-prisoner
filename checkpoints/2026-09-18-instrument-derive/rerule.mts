// Live re-ruling for the-prisoner#17 and #18 (OPEN-VARIANT.md §51), against
// the exact two intents that let checkpoints/2026-09-18T02-40-27-834Z.md's
// prisoner escape on an instrument the world never made. NEVER RUN BY THE
// AGENT THAT WROTE THIS FILE -- this session must not call a model. This is
// the owner's script: it calls the real referee model on doris, through the
// same one-model-at-a-time swapper `npm run checkpoint` uses, and touches no
// database (the referee takes a fixed, hand-supplied `perceivedObjects`
// list -- OPEN-VARIANT.md's own object descriptions, copied verbatim from
// that transcript's briefings, not rebuilt from `scenarioObjects.ts`, so
// this script re-asks exactly what the real referee was asked that night).
//
// usage:
//   npx tsx checkpoints/2026-09-18-instrument-derive/rerule.mts [instrument|derive|both]
//   RERULE_N=8 PRISONER_REFEREE_MODEL=qwen2.5:14b npx tsx checkpoints/2026-09-18-instrument-derive/rerule.mts
//
// Defaults to this repository's current default referee model
// (`resolveRefereeModel`, `qwen3:14b`); the exploit's own transcript ran
// `qwen2.5:14b` (`PRISONER_REFEREE_MODEL=qwen2.5:14b` to match it exactly).
//
// "derive" (#18): "pull a wire out of the cot", baseline vs sharpened
//   wording, N trials each. Tallies the `effect` ruling -- baseline
//   reproduces the exploit's own `wear`; a batch worth promoting the arm
//   should shift most trials to `derive`, product `wire`, without breaking
//   ordinary `wear` intents elsewhere (not this script's job to check that;
//   see OPEN-VARIANT.md §51 for what else the owner should run).
// "instrument" (#17): "pick the lock using the wire", against the SAME 11
//   objects the prisoner actually perceived that round -- no "wire" object
//   among them, because the derive never landed. `off` reproduces the
//   exploit (silently escapes the gate); `checked` asks a seventh question
//   whose answer keys are those 11 objects, `none`, and `absent` -- a
//   referee that follows the closed-key instruction perfectly can legally
//   answer `absent`, cited from the intent, when the true tool is not among
//   them. `checked` trials should show some `instrument: absent` with
//   `missingInstrument` set and `applicable: false`. Unlike the arm's first
//   draft, this does NOT depend on the model breaking its own instructions
//   -- `absent` is a normal, legal member of the closed set -- so 0/N here
//   is a real finding about this referee model's judgement, not a
//   structural blind spot in the mechanism.
import { createReferee, type ObjectPerception } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";

const N = Number(process.env.RERULE_N ?? "8");
const WHICH = (process.argv[2] as "instrument" | "derive" | "both" | undefined) ?? "both";

const BASE_URL = process.env.PRISONER_MODEL_URL ?? "http://doris:11434/v1";
const MODEL = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);

// The 11 objects the prisoner actually perceived in
// checkpoints/2026-09-18T02-40-27-834Z.md, rounds 2-4 -- copied verbatim
// from that transcript's own briefings. No "wire": round 2's derive never
// landed (effect ruled `wear`, product `none`), so it was never created.
const PERCEIVED: ObjectPerception[] = [
  {
    id: "window",
    description:
      "A small window set in the wall at shoulder height, a little wider than a person's shoulders. Iron bars cross it, and a single rusted bar closes its widest gap: with that bar gone, a person could climb through.",
  },
  {
    id: "bar",
    description:
      "The iron bar that closes the widest gap in the cell's small window, about as thick as a thumb. Rust has pitted it near the bottom, where it is set into old mortar that is dry and cracked.",
  },
  {
    id: "door",
    description: "A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap.",
  },
  { id: "lock", description: "A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame." },
  {
    id: "spoon",
    description: "A dented aluminium spoon, thin enough to bend by hand. One side of the bowl is worn flat from being scraped along the floor.",
  },
  {
    id: "loose_tile",
    description: "A square clay floor tile beside the cot, cracked across one corner. It rocks underfoot, and beneath it is a shallow hollow of dry grit about the size of a hand.",
  },
  {
    id: "cot",
    description:
      "A narrow cot whose iron frame is bolted to the wall at the head and stands on two legs at the foot. The crossbar is rough with flaking paint, and the springs are held to the frame by twists of wire.",
  },
  { id: "blanket", description: "A heavy grey wool blanket, thick and coarse, frayed along the hem, with a loose thread running down one edge." },
  { id: "bucket", description: "A tin slop bucket with a wire handle and a dented rim. It rings sharply when anything strikes it." },
  {
    id: "meal_tray",
    description: "A shallow steel tray pushed through a slot at the bottom of the door, holding a tin cup and a bowl, and collected at the next round.",
  },
  {
    id: "key_ring",
    description: "A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks.",
  },
];

const PULL_WIRE = "pull a wire out of the cot";
const PICK_LOCK = "pick the lock using the wire";

function makeTransport(swapper: OllamaModelSwapper) {
  return createRefereeTransport({
    baseUrl: BASE_URL,
    model: MODEL,
    timeoutMs: 120_000,
    ensureLoaded: (m) => swapper.withModel(m, async () => {}),
  });
}

async function runDerive(swapper: OllamaModelSwapper): Promise<void> {
  console.log(`\n== #18: "${PULL_WIRE}" -- effect ruled, baseline vs sharpened, N=${N} each, model ${MODEL} ==`);
  for (const deriveWording of ["baseline", "sharpened"] as const) {
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      // A fresh referee per trial: `referee.ts` caches identical
      // (intent, perceivedObjects) pairs, which would otherwise turn every
      // repeat into zero extra network calls instead of an independent
      // sample (temperature 0 still leaves real serving nondeterminism
      // worth sampling -- OPEN-VARIANT.md §10.5).
      const referee = createReferee([makeTransport(swapper)], { deriveWording });
      const ruling = await referee.rule(PULL_WIRE, PERCEIVED);
      counts.set(ruling.effectKind, (counts.get(ruling.effectKind) ?? 0) + 1);
      console.log(`  [${deriveWording}] ${i + 1}/${N}: effect=${ruling.effectKind} product=${ruling.product} applicable=${ruling.applicable}`);
    }
    console.log(`  ${deriveWording} totals: ${[...counts.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "(no rulings)"}`);
  }
}

async function runInstrument(swapper: OllamaModelSwapper): Promise<void> {
  console.log(`\n== #17: "${PICK_LOCK}" (no "wire" object exists) -- off vs checked, N=${N} each, model ${MODEL} ==`);
  for (const instrumentMode of ["off", "checked"] as const) {
    let impossible = 0;
    let ruledAbsent = 0;
    for (let i = 0; i < N; i++) {
      const referee = createReferee([makeTransport(swapper)], { instrumentMode });
      const ruling = await referee.rule(PICK_LOCK, PERCEIVED);
      if (!ruling.applicable) impossible++;
      if (ruling.missingInstrument) ruledAbsent++;
      console.log(`  [${instrumentMode}] ${i + 1}/${N}: applicable=${ruling.applicable} instrument=${ruling.instrument} missingInstrument=${JSON.stringify(ruling.missingInstrument)}`);
    }
    console.log(`  ${instrumentMode} totals: impossible ${impossible}/${N}, ruled 'absent' with a trustworthy citation ${ruledAbsent}/${N}`);
  }
}

async function main(): Promise<void> {
  const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  const allowedModels = [...new Set([MODEL, ...residents])];
  const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(BASE_URL, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });

  const ps = await swapper.fetchPs();
  assertNoForeignModel(ps, allowedModels);
  const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));

  try {
    if (WHICH === "derive" || WHICH === "both") await runDerive(swapper);
    if (WHICH === "instrument" || WHICH === "both") await runInstrument(swapper);
  } finally {
    await swapper.restoreResidents(residentsAtStart);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
