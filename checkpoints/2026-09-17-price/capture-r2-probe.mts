// The one probe worth running by hand after §45 (see §45.3): is the price ignored because it is
// quoted in a currency she cannot see?
//
// `src/ledger/beliefs.ts` says the prisoner never holds a belief about `warden_suspicion`, "who has
// no channel to learn it" -- by design, and right for the fog. So she is told a known approach costs
// 100 and is never told what she has spent. In the stale game she paid 100 on round 1 and on round 2
// was still planning to "avoid raising suspicion above 40", while the warden's own round-2 thought
// began "With suspicion already at 100".
//
// This writes two round-2 prompts for the lab, identical but for one line:
//   stale-r2.txt          what the game really sent on that turn (the control)
//   stale-r2-visible.txt  the same, plus her balance as a belief line in the briefing's own format
//
// The visible one BREAKS THE FOG deliberately and exists only to answer the question the batch cannot:
// if she avoids the bar once she can see she is at 100, the price works and what it lacks is a
// channel, so an in-fiction one is worth designing. If she goes at the bar anyway, the price is not
// the lever at any magnitude or visibility, and staleness pricing is finished.
//
// Built from the captured r1 prompt (whose non-briefing tail is the same every turn) and the recorded
// r2 briefing, verbatim from the transcript. Nothing is invented: it asserts both halves join cleanly.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "checkpoints/2026-09-17-price";
const GAME = "checkpoints/2026-09-17T19-35-58-790Z.md";
const SUSPICION_AFTER_ROUND_1 = 100; // what that game's warden actually stood at; its own briefing says so

const captured = readFileSync(`${DIR}/prisoner-prompt-r1-stale.txt`, "utf8");
const block = readFileSync(`${DIR}/precedent-block-stale.txt`, "utf8").replace(/\n$/, "");
const transcript = readFileSync(GAME, "utf8");

// Everything before the per-turn briefing (the condition list, identity, motive) and everything after
// it (the reach list, the rule sentences, the answer instruction) is turn-invariant.
const head = captured.slice(0, captured.indexOf("Round 1 of 30."));
const tail = captured.slice(captured.indexOf("\nWhat you can currently reach or perceive:"));

const r2 = /### Round 2 \(t=6\) -- the prisoner\n\n\*\*Briefing given, verbatim:\*\*\n```\n([\s\S]*?)\n```/.exec(transcript)?.[1];
if (!r2) throw new Error("could not find the recorded round-2 prisoner briefing");
if (!r2.includes(block)) throw new Error("the recorded round-2 briefing does not carry the stale precedent block verbatim");
if (!/^bar integrity: \d+ \(as of round \d+\)\.$/m.test(r2)) throw new Error("no belief line to anchor the probe to");

const briefing = r2.replace(block, "{{PRECEDENT}}");
writeFileSync(`${DIR}/prisoner-prompt-r2-stale.txt`, head + briefing + tail);

// The probe: one more belief line, in the exact shape the briefing renders the others.
const visible = briefing.replace(/^(lock integrity: .*)$/m, `$1\nwarden suspicion: ${SUSPICION_AFTER_ROUND_1} (as of round 1).`);
if (visible === briefing) throw new Error("the probe line was not inserted");
writeFileSync(`${DIR}/prisoner-prompt-r2-stale-visible.txt`, head + visible + tail);

console.log("prisoner-prompt-r2-stale.txt and prisoner-prompt-r2-stale-visible.txt written");
console.log(`they differ by exactly one line: "warden suspicion: ${SUSPICION_AFTER_ROUND_1} (as of round 1)."`);
