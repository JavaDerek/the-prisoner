import { describe, it, expect, afterEach } from "vitest";
import type { ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame } from "../game.js";
import { readWardenMode, passiveWardenMind } from "../passiveWarden.js";
import type { OpenMind } from "../mind.js";
import { scriptedReferee, RULINGS, OPEN_DOOR, LEAVE_DOOR } from "./helpers/scriptedReferee.js";

// OPEN-VARIANT.md §26: whether escape can be done at all, with the warden taken out of the question.
describe("the passive warden (§26)", () => {
  afterEach(() => destroyTestDb());

  it("PRISONER_WARDEN: unset is the model warden, 'passive' is the passive one, anything else stops the run", () => {
    expect(readWardenMode(undefined)).toBe("model");
    expect(readWardenMode("")).toBe("model");
    expect(readWardenMode("passive")).toBe("passive");
    expect(() => readWardenMode("asleep")).toThrow(/PRISONER_WARDEN/);
  });

  it("does nothing every turn and costs no referee call; the prisoner's game runs exactly as before, to escape", async () => {
    createTestDb();
    let wardenAsked = 0;
    const counting: ReaderTransport = async (request) => {
      const intent = request.sources.find((s) => s.id === "intent")?.text ?? "";
      if (intent !== OPEN_DOOR && intent !== LEAVE_DOOR) wardenAsked += 1;
      return scriptedReferee(RULINGS)(request);
    };
    let turn = 0;
    const prisonerMind: OpenMind = { async consider() { turn += 1; return { intent: turn === 1 ? OPEN_DOOR : LEAVE_DOOR }; } };
    const game = await runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([counting]),
      wardenMind: passiveWardenMind(),
      prisonerMind,
      rounds: 5,
    });
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.halves.filter((h) => h.principal === "warden").every((h) => h.proposal === null && h.ruling === null)).toBe(true);
    expect(wardenAsked).toBe(0);
  });
});
