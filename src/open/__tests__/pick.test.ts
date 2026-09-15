import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { precedentLines } from "../precedent.js";
import { recordIntent } from "../transcript.js";
import { pick, type Verdict } from "../pick.js";
import { readPickCondition } from "../pickCondition.js";
import { renderOpenSummary } from "../checkpointTranscript.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, SCRAPE, LIFT_TILE, TEAR_STRIP, WAIT } from "./helpers/scriptedReferee.js";

// mother-of-invention#1's "pick" half, driven here first (OPEN-VARIANT.md §21).
function table(verdicts: Record<string, Verdict>) {
  return (candidate: string) => verdicts[candidate] ?? "unseen";
}

describe("pick: a forced choice away from what is already seen, with the recogniser injected", () => {
  it("a free turn keeps the mind's own choice and asks the recogniser nothing", async () => {
    let asked = 0;
    const picked = await pick("a", ["a", "b"], { force: false, recognise: () => (asked++, "seen") });
    expect(picked).toEqual({ chosen: "a", forced: false, overridden: false, verdicts: [] });
    expect(asked).toBe(0);
  });

  it("a forced turn keeps the mind's own choice when it is unseen", async () => {
    const picked = await pick("a", ["b"], { force: true, recognise: table({ b: "seen" }) });
    expect(picked.chosen).toBe("a");
    expect(picked.overridden).toBe(false);
  });

  it("a forced turn replaces a seen choice with the first unseen candidate, in the mind's own order, skipping unavailable ones", async () => {
    const picked = await pick("a", ["a", "b", "c", "d"], { force: true, recognise: table({ a: "seen", b: "unavailable", c: "unseen", d: "unseen" }) });
    expect(picked.chosen).toBe("c");
    expect(picked.overridden).toBe(true);
    expect(picked.verdicts).toEqual([
      { candidate: "a", verdict: "seen" },
      { candidate: "b", verdict: "unavailable" },
      { candidate: "c", verdict: "unseen" },
      { candidate: "d", verdict: "unseen" },
    ]);
  });

  it("a forced turn with nothing unseen to force to keeps the mind's own choice, and says so", async () => {
    const picked = await pick("a", ["b"], { force: true, recognise: table({ a: "seen", b: "unavailable" }) });
    expect(picked).toMatchObject({ chosen: "a", forced: true, overridden: false });
  });

  it("an unavailable own choice is replaced on a forced turn too: forcing never spends the turn on nothing", async () => {
    const picked = await pick("a", ["b"], { force: true, recognise: table({ a: "unavailable", b: "unseen" }) });
    expect(picked.chosen).toBe("b");
  });
});

describe("pick in a scripted game: a mind that always goes for the known approach", () => {
  afterEach(() => destroyTestDb());

  const SHOUT = "I bang on the door and shout for the guard."; // not in RULINGS: ruled impossible
  const creature: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({
    intent: SCRAPE,
    candidates: [{ text: SCRAPE }, { text: SHOUT }, { text: LIFT_TILE }, { text: TEAR_STRIP }],
  });
  const known = precedentLines([{ text: "A prisoner works at the bar.", times: 12, episodes: 3, lastEpisode: "g3" }]);

  async function play(withPick: boolean): Promise<OpenGameResult> {
    createTestDb();
    return runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind: creature,
      rounds: 6,
      precedent: known,
      ...(withPick ? { pick: { force: (roundN: number) => roundN % 2 === 0 } } : {}),
    });
  }

  it("without pick: the known approach every turn, novelty 0 -- §20.2's result, reproduced", async () => {
    const game = await play(false);
    const prisoner = game.halves.filter((h) => h.principal === "prisoner");
    expect(prisoner.map((h) => h.proposal?.intent)).toEqual(Array(6).fill(SCRAPE));
    expect(prisoner.filter((h) => recordIntent(h).novel)).toHaveLength(0);
    expect(prisoner.every((h) => h.pick === null)).toBe(true);
  });

  it("with pick on even rounds: free turns untouched, forced turns go to the first unseen, possible candidate", async () => {
    const game = await play(true);
    const prisoner = game.halves.filter((h) => h.principal === "prisoner");
    expect(prisoner.slice(0, 4).map((h) => h.proposal?.intent)).toEqual([SCRAPE, LIFT_TILE, SCRAPE, TEAR_STRIP]);
    for (const h of prisoner.filter((x) => x.roundN % 2 === 1)) expect(h.pick).toBeNull();
    const round2 = prisoner[1].pick;
    expect(round2).toMatchObject({ own: SCRAPE, forced: true, overridden: true });
    expect(round2?.verdicts.map((v) => v.verdict)).toEqual(["seen", "unavailable", "unseen", "unseen"]);
    expect(prisoner.filter((h) => recordIntent(h).novel).length).toBeGreaterThan(0);
  });

  it("what the warden perceived earlier THIS game counts as seen too, so a forced turn never repeats it (§21)", async () => {
    const game = await play(true);
    const round4 = game.halves.find((h) => h.principal === "prisoner" && h.roundN === 4);
    // round 2's audible tile lift was perceived; the silent blanket tear never is.
    expect(round4?.pick?.verdicts.map((v) => v.verdict)).toEqual(["seen", "unavailable", "seen", "unseen"]);
  });

  it("this game's sightings never reach the known-approach cost: that stays the ledger's alone (one variable at a time)", async () => {
    const game = await play(true);
    const briefing = (roundN: number) => game.halves.find((h) => h.principal === "warden" && h.roundN === roundN)?.context.briefing ?? "";
    // Round 1 scrape: 30 + known 30. Round 2 tile lift: substantial audible 30, never known. Round 3 scrape: +60, capped.
    expect(briefing(3)).toContain("warden suspicion: 90.");
    // The tile lift is "seen" to round 4's pick by this game's sighting, and still not a known approach.
    const round4 = game.halves.find((h) => h.principal === "prisoner" && h.roundN === 4);
    expect(round4?.pick?.verdicts[2]).toEqual({ candidate: LIFT_TILE, verdict: "seen" });  });
});

describe("pick in the checkpoint: the switch and the summary (§21)", () => {
  afterEach(() => destroyTestDb());

  it("PRISONER_PICK: unset is off, 'even' forces even rounds, anything else stops the run", () => {
    expect(readPickCondition(undefined)).toBeUndefined();
    expect(readPickCondition("")).toBeUndefined();
    const even = readPickCondition("even");
    expect([1, 2, 3, 4].map((n) => even?.force(n))).toEqual([false, true, false, true]);
    expect(() => readPickCondition("always")).toThrow(/PRISONER_PICK/);
  });

  it("the summary splits novelty by free and forced turns: only a change on free turns is evidence", async () => {
    createTestDb();
    const game = await runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: SCRAPE, candidates: [{ text: SCRAPE }, { text: LIFT_TILE }, { text: TEAR_STRIP }] }),
      rounds: 4,
      precedent: precedentLines([{ text: "A prisoner works at the bar.", times: 1, episodes: 1, lastEpisode: "g1" }]),
      pick: { force: (n: number) => n % 2 === 0 },
    });
    const text = renderOpenSummary(game, 4).join("\n");
    expect(text).toContain("## Pick condition (OPEN-VARIANT.md §21)");
    expect(text).toContain("Forced prisoner turns: 2 (overridden 2, nothing unseen to force to 0). Novel: 2.");
    expect(text).toContain("Free prisoner turns: 2. Novel: 0.");
  });
});
