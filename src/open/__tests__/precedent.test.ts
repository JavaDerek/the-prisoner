import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { emptyLedger, beginEpisode, seenBefore, type Precedent } from "mother-of-invention";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { recordGame, precedentLines, stalenessBump, readPrecedentPrice } from "../precedent.js";
import { KNOWN_APPROACH_SUSPICION_BUMP, type KnownApproach } from "../loop.js";
import { RESOURCE_MAX } from "../../world/setup.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, SCRAPE, EXAMINE, WAIT } from "./helpers/scriptedReferee.js";

async function play(
  prisonerIntent: string,
  precedent?: { warden: readonly string[]; prisoner: readonly string[]; known: readonly KnownApproach[] }
): Promise<OpenGameResult> {
  createTestDb();
  const game = await runOpenGame({
    openWorld: buildOpenWorld(),
    resolver: buildOpenResolver(),
    referee: createReferee([scriptedReferee(RULINGS)]),
    wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: EXAMINE }),
    prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: prisonerIntent }),
    rounds: 2,
    ...(precedent ? { precedent } : {}),
  });
  destroyTestDb();
  return game;
}

describe("precedent: what the warden has already seen prisoners try (mother-of-invention)", () => {
  afterEach(() => destroyTestDb());

  it("records what the warden perceived of each prisoner attempt, in role-neutral words, never the intent", async () => {
    const game = await play(SCRAPE);
    const ledger = recordGame(beginEpisode(emptyLedger(), "g1"), "g1", game.halves);
    expect(ledger.accounts).toEqual([
      { episode: "g1", actor: "prisoner", observer: "warden", text: "A prisoner works at the bar." },
      { episode: "g1", actor: "prisoner", observer: "warden", text: "A prisoner works at the bar." },
    ]);
    expect(JSON.stringify(ledger)).not.toContain(SCRAPE);
  });

  it("an attempt the warden could not perceive is never recorded as seen", async () => {
    const game = await play(WAIT); // ruled impossible: nothing perceptible
    expect(recordGame(beginEpisode(emptyLedger(), "g1"), "g1", game.halves).accounts).toEqual([]);
  });

  it("renders the warden's precedent into both briefings: as Croft's experience for the prisoner, as its own for the warden", () => {
    const precedents = [{ text: "A prisoner works at the bar.", times: 12, episodes: 2, lastEpisode: "g2" }];
    const lines = precedentLines(precedents);
    expect(lines.prisoner.join("\n")).toContain("Croft");
    expect(lines.prisoner.join("\n")).toContain("however quietly");
    expect(lines.prisoner.join("\n")).toContain(`jumps by ${KNOWN_APPROACH_SUSPICION_BUMP}`);
    expect(lines.warden.join("\n")).toContain(`jumps by ${KNOWN_APPROACH_SUSPICION_BUMP}`);
    expect(lines.known).toEqual([{ text: "A prisoner works at the bar.", suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP }]);
    expect(lines.prisoner.join("\n")).toContain("A prisoner works at the bar. (seen 12 times, in 2 earlier attempts)");
    expect(lines.warden.join("\n")).toContain("You have seen");
    expect(lines.warden.join("\n")).toContain("A prisoner works at the bar.");
    expect(precedentLines([])).toEqual({ prisoner: [], warden: [], known: [] });
  });

  it("across two games: what the warden saw in the first is in both briefings of every round of the second", async () => {
    const first = await play(SCRAPE);
    let ledger = recordGame(beginEpisode(emptyLedger(), "g1"), "g1", first.halves);
    ledger = beginEpisode(ledger, "g2");

    const second = await play(WAIT, precedentLines(seenBefore(ledger, { observer: "warden", actor: "prisoner", episode: "g2" })));
    for (const half of second.halves) {
      expect(half.context.briefing, `${half.roundN} ${half.principal}`).toContain("A prisoner works at the bar. (seen 2 times, in 1 earlier attempt)");
    }
  });

  it("in a game, a known approach costs the prisoner the jump: the warden's next briefing shows it", async () => {
    const known = precedentLines([{ text: "A prisoner works at the bar.", times: 9, episodes: 2, lastEpisode: "g2" }]);
    const game = await play(SCRAPE, known);
    const round2Warden = game.halves.find((h) => h.roundN === 2 && h.principal === "warden")?.context.briefing ?? "";
    // round 1 scrape: substantial audible bump 30 + known approach 30.
    expect(round2Warden).toContain(`warden suspicion: ${30 + KNOWN_APPROACH_SUSPICION_BUMP}.`);
  });
});

// OPEN-VARIANT.md §42: the free-turn question moi#2 asks cannot be answered by handing the mind more
// information (§41), so this prices the obvious approach instead. The ledger always knew how stale an
// approach was -- "seen 76 times, in 19 earlier attempts" -- and the flat bump spent that on a single
// number and threw the counts away. An arm, never a silent change: `flat` is exactly what every batch
// before today was measured against.
describe("staleness pricing (§42): a known approach costs what its own precedent is worth", () => {
  const seen = (episodes: number, times = episodes): Precedent => ({ text: "A prisoner works at the bar.", times, episodes, lastEpisode: "g1" });

  it("prices one earlier attempt at the flat bump, and each further one a step above", () => {
    expect(stalenessBump(seen(1))).toBe(KNOWN_APPROACH_SUSPICION_BUMP);
    expect(stalenessBump(seen(2))).toBe(2 * KNOWN_APPROACH_SUSPICION_BUMP);
    expect(stalenessBump(seen(3))).toBe(3 * KNOWN_APPROACH_SUSPICION_BUMP);
  });

  it("never states a price the world cannot charge: warden_suspicion is bounded, and bounded writes are REJECTED, not clamped", () => {
    expect(stalenessBump(seen(4))).toBe(RESOURCE_MAX); // 4 * 30 = 120, and the resource stops at 100
    expect(stalenessBump(seen(19))).toBe(RESOURCE_MAX); // the committed ledger's own worst case
  });

  it("counts earlier attempts, not sightings, so scraping the bar twenty times in one game does not price it up", () => {
    expect(stalenessBump(seen(1, 76))).toBe(KNOWN_APPROACH_SUSPICION_BUMP);
  });

  it("states each approach's own price in both briefings, and no single global number", () => {
    const lines = precedentLines([seen(19), { text: "A prisoner opens the door.", times: 1, episodes: 1, lastEpisode: "g1" }], { price: "stale" });
    expect(lines.prisoner.join("\n")).toContain(`A prisoner works at the bar. (seen 19 times, in 19 earlier attempts) -- suspicion jumps by ${RESOURCE_MAX}`);
    expect(lines.prisoner.join("\n")).toContain(`A prisoner opens the door. (seen 1 time, in 1 earlier attempt) -- suspicion jumps by ${KNOWN_APPROACH_SUSPICION_BUMP}`);
    expect(lines.warden.join("\n")).toContain(`-- suspicion jumps by ${RESOURCE_MAX}`);
    // The flat arm's one global sentence would be a lie here: the prices differ per line.
    expect(lines.prisoner.join("\n")).not.toContain(`jumps by ${KNOWN_APPROACH_SUSPICION_BUMP} at once`);
    expect(lines.known).toEqual([
      { text: "A prisoner works at the bar.", suspicionBump: RESOURCE_MAX },
      { text: "A prisoner opens the door.", suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP },
    ]);
  });

  it("leaves the flat arm exactly as it was", () => {
    expect(precedentLines([seen(19)], { price: "flat" })).toEqual(precedentLines([seen(19)]));
    expect(precedentLines([seen(19)]).prisoner.join("\n")).toContain(`jumps by ${KNOWN_APPROACH_SUSPICION_BUMP} at once`);
  });

  it("in a game, a stale approach costs its own price, not the flat one", async () => {
    const known = precedentLines([seen(19)], { price: "stale" });
    const game = await play(SCRAPE, known);
    const round2Warden = game.halves.find((h) => h.roundN === 2 && h.principal === "warden")?.context.briefing ?? "";
    // round 1 scrape: substantial audible bump 30, plus this approach's own 100, clamped at the bound.
    expect(round2Warden).toContain(`warden suspicion: ${RESOURCE_MAX}.`);
  });
});

describe("readPrecedentPrice: PRISONER_PRECEDENT_PRICE (§42)", () => {
  it("prices flat unless asked, so every batch before today stays the comparison it was", () => {
    expect(readPrecedentPrice(undefined)).toBe("flat");
    expect(readPrecedentPrice("")).toBe("flat");
    expect(readPrecedentPrice("flat")).toBe("flat");
  });

  it("prices by staleness when asked for", () => {
    expect(readPrecedentPrice("stale")).toBe("stale");
  });

  it("stops the run rather than guessing", () => {
    expect(() => readPrecedentPrice("staleness")).toThrow(/unrecognised value/);
  });
});
