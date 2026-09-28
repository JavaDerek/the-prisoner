import { describe, it, expect } from "vitest";
import { translateEngineEffect, stepUpMagnitude, ENGINE_CHANGE_KINDS, DIRECTIONS, HOLDER_TARGETS } from "../engineRules.js";

/**
 * the-prisoner#5, step 1 (CODER-BRIEF's own scoping): under
 * `PRISONER_OPEN_RULES=engine` the referee answers in run-dmcp's own
 * change-kind vocabulary (plus `reveal`, which is no engine change at all --
 * OPEN-VARIANT.md's new section explains why it stays a leaf key rather than
 * being forced into one of the five). `translateEngineEffect` is the pure
 * mapping table CODER-BRIEF's decision names: "write-down -> wear,
 * write-up -> restore, set-holder -> take/give, create -> derive, and so
 * on" -- tested here in isolation, against a hand-built input, exactly the
 * way `computeRuling` (referee.ts) is tested without ever building a reader.
 */
describe("translateEngineEffect (the-prisoner#5, docs/OPEN-VARIANT.md's mapping table)", () => {
  const base = { targetIsExit: false, targetIsPerson: false, to: "none" as const, direction: "none" as const, property: "none" as const };

  it("write-down on a generic declared property is wear", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "down", property: "integrity" })).toBe("wear");
  });

  it("write-up on a generic declared property is restore", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "up", property: "integrity" })).toBe("restore");
  });

  it("write-up/down on passage is open/close -- the way out's own mechanic, never generic wear/restore", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "up", property: "passage" })).toBe("open");
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "down", property: "passage" })).toBe("close");
  });

  it("write-up/down on concealment is conceal/expose", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "up", property: "concealment" })).toBe("conceal");
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "down", property: "concealment" })).toBe("expose");
  });

  it("write-down on 'concealment' naming a PERSON falls to the generic wear bucket, not expose -- a search stays unreachable, refused for the ordinary reason (no declared property) rather than by accident exempted through custody", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "down", property: "concealment", targetIsPerson: true })).toBe("wear");
  });

  it("write-up/down on a person's own posture or sight is restore/wear -- the same person mechanic any other property uses", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "down", property: "posture", targetIsPerson: true })).toBe("wear");
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "up", property: "sight", targetIsPerson: true })).toBe("restore");
  });

  it("write with no direction answer (safe default) is none -- ungrounded, never a guess", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "write", direction: "none", property: "integrity" })).toBe("none");
  });

  it("set on a way out is leave, whatever `to` answered -- going through changes the actor's own place, not a holder", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "set", targetIsExit: true, to: "actor" })).toBe("leave");
    expect(translateEngineEffect({ ...base, engineEffect: "set", targetIsExit: true, to: "none" })).toBe("leave");
  });

  it("set-holder on an ordinary thing is take (to actor) or give (to other)", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "set", to: "actor" })).toBe("take");
    expect(translateEngineEffect({ ...base, engineEffect: "set", to: "other" })).toBe("give");
  });

  it("set with no holder named is none -- ungrounded", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "set", to: "none" })).toBe("none");
  });

  it("set on a person is unreachable this landing -- a search fans out over what she holds, no single column on her own row", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "set", targetIsPerson: true, to: "actor" })).toBe("none");
  });

  it("create is derive", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "create" })).toBe("derive");
  });

  it("destroy and transfer are unreachable this landing -- no mapped mechanic", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "destroy" })).toBe("none");
    expect(translateEngineEffect({ ...base, engineEffect: "transfer" })).toBe("none");
  });

  it("reveal passes straight through -- it is a read, not one of the five change kinds, so step 1 does not touch it", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "reveal" })).toBe("reveal");
  });

  it("none is none", () => {
    expect(translateEngineEffect({ ...base, engineEffect: "none" })).toBe("none");
  });
});

describe("stepUpMagnitude (CODER-BRIEF: a held instrument bumps the magnitude one step)", () => {
  it("slight becomes moderate", () => {
    expect(stepUpMagnitude("slight")).toBe("moderate");
  });
  it("moderate becomes substantial", () => {
    expect(stepUpMagnitude("moderate")).toBe("substantial");
  });
  it("substantial stays substantial -- already the ceiling", () => {
    expect(stepUpMagnitude("substantial")).toBe("substantial");
  });
});

describe("the closed answer-key sets", () => {
  it("ENGINE_CHANGE_KINDS is the engine's five change kinds, plus reveal and none", () => {
    expect(ENGINE_CHANGE_KINDS).toEqual(["write", "set", "transfer", "create", "destroy", "reveal", "none"]);
  });
  it("DIRECTIONS and HOLDER_TARGETS are closed, three-key sets", () => {
    expect(DIRECTIONS).toEqual(["up", "down", "none"]);
    expect(HOLDER_TARGETS).toEqual(["actor", "other", "none"]);
  });
});
