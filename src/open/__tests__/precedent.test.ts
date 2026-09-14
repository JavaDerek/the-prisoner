import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { emptyLedger, beginEpisode, seenBefore } from "mother-of-invention";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { recordGame, precedentLines } from "../precedent.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, SCRAPE, EXAMINE, WAIT } from "./helpers/scriptedReferee.js";

async function play(prisonerIntent: string, precedent?: { warden: readonly string[]; prisoner: readonly string[] }): Promise<OpenGameResult> {
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
    expect(lines.prisoner.join("\n")).toContain("A prisoner works at the bar. (seen 12 times, in 2 earlier attempts)");
    expect(lines.warden.join("\n")).toContain("You have seen");
    expect(lines.warden.join("\n")).toContain("A prisoner works at the bar.");
    expect(precedentLines([])).toEqual({ prisoner: [], warden: [] });
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
});
