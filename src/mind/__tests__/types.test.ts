import { describe, it, expect } from "vitest";
import type { Mind, InertRecord } from "mind-seam";
import { assertInert } from "mind-seam";
import type { PrisonerContext, PrisonerProposal } from "../prisonerMind.js";
import type { WardenContext } from "../wardenMind.js";
import { PRISONER_MOVES } from "../../world/mechanics.js";

describe("PrisonerContext/WardenContext are structurally InertRecord", () => {
  it("a PrisonerContext with an extra resolver field does not satisfy InertRecord -- tsc catches it, not a runtime check", () => {
    type BadContext = PrisonerContext & { resolver: () => void };

    // @ts-expect-error -- a function field is not Inert; BadContext cannot
    // be used as the C parameter of Mind<C, P>. This is the compile-time
    // half of "the mind cannot write" (this repository's CLAUDE.md).
    const _bad: Mind<BadContext, PrisonerProposal> = null as unknown as Mind<BadContext, PrisonerProposal>;
    void _bad;
  });

  it("a real PrisonerContext passes assertInert at runtime", () => {
    const context: PrisonerContext = {
      principalId: "p1",
      identity: "the prisoner",
      motive: "escape",
      briefing: "You are in a cell.",
      moves: PRISONER_MOVES,
    };
    expect(() => assertInert(context)).not.toThrow();
  });

  it("a getter that type-checks as a string is still caught by assertInert -- the hole tsc cannot close", () => {
    const sneaky = {
      principalId: "p1",
      identity: "the prisoner",
      motive: "escape",
      get briefing() {
        return "reads a live source, not a field";
      },
      moves: PRISONER_MOVES,
    };
    // TypeScript sees `briefing: string` here -- the property descriptor is
    // what assertInert actually inspects, which `typeof` cannot.
    expect(() => assertInert(sneaky as unknown as InertRecord)).toThrow(/accessor/);
  });

  it("a WardenContext with an extra database-handle-shaped field does not satisfy InertRecord", () => {
    type BadWardenContext = WardenContext & { db: object };
    // @ts-expect-error -- an object whose prototype is not Object.prototype
    // (a class instance) is not Inert either, but the type-level check here
    // is over any additional field's TYPE, not its runtime shape; `object`
    // is too wide to be Inert (it admits functions), so this alone is
    // enough to fail InertRecord's index signature.
    const _bad: Mind<BadWardenContext, PrisonerProposal> = null as unknown as Mind<BadWardenContext, PrisonerProposal>;
    void _bad;
  });
});
