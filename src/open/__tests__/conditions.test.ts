import { describe, it, expect, vi } from "vitest";
import { openConditions, readConditionsMode, readDoorMode } from "../conditions.js";
import { buildOpenWorld, OPEN_DOOR_LOCK_MAX, OPEN_DOOR_LOCK_MARGIN } from "../world.js";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { createOpenMind, type OpenPrincipalContext } from "../mind.js";
import { CONDITION_LIST_OPENING } from "../conditionList.js";

// OPEN-VARIANT.md §34: the game's thresholds, fed to the generic condition list
// from the same constants the rules sentences and the game's own checks use.
const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: "Round 1 of 12.",
  perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
};

async function promptFor(selfName: string, otherName: string, extra: Record<string, unknown> = {}): Promise<string> {
  let prompt = "";
  const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
    prompt = JSON.parse((init?.body as string) ?? "{}").messages[0].content as string;
    return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ thoughts: "t", candidates: [], intent: "i", line: "", plan: "p", replanned: false, replanBecause: "", notes: "n" }) } }] }) };
  }) as unknown as typeof fetch;
  await createOpenMind({ baseUrl: "http://x", selfName, otherName, model: "m", fetchFn, ...extra }).consider(CONTEXT);
  return prompt;
}

describe("openConditions: the game's thresholds as flat conditions", () => {
  it("one condition for the way out the bar gates, then one per catch, each flat", () => {
    const conditions = openConditions();
    expect(conditions.map((c) => c.for)).toEqual(["Mara Voss", "Mara Voss", "Warden Croft", "Warden Croft", "Warden Croft", "Warden Croft"]);
    expect(conditions[0]).toEqual({ when: ["the bar's integrity is at or below 50"], then: "Mara Voss can open the window", for: "Mara Voss" });
    // §35 game 3: she opened the window and kept prying the bar; leaving is an unlock too.
    expect(conditions[1]).toEqual({ when: ["a way out stands open"], then: "Mara Voss can leave the cell through it, and she has escaped", for: "Mara Voss" });
    expect(conditions[2]).toEqual({
      when: ["warden suspicion is at or above 40", "Warden Croft closely examines the bar", "Warden Croft finds its integrity at or below 30"],
      then: "Warden Croft catches Mara Voss and the game ends",
      for: "Warden Croft",
    });
    expect(conditions[3].when).toContain("Warden Croft finds its integrity at or below 40");
    expect(conditions[4].when).toEqual(["warden suspicion is at or above 40", "Warden Croft closely examines the spoon", "the spoon is out in the open", "Warden Croft finds its edge at or above 20"]);
    expect(conditions[5].when).toEqual(["warden suspicion is at or above 40", "Warden Croft closely examines a way out", "Warden Croft finds it standing open"]);
  });
});

describe("a mind given conditions", () => {
  it("starts its prompt with the list, and states each threshold only there", async () => {
    const prompt = await promptFor("Mara Voss", "Warden Croft", { conditions: openConditions() });
    expect(prompt.startsWith(CONDITION_LIST_OPENING)).toBe(true);
    expect(prompt).toContain("CONDITION 1 (for you): If the bar's integrity is at or below 50, then Mara Voss can open the window.");
    expect(prompt).toContain("CONDITION 2 (for you): If a way out stands open, then Mara Voss can leave the cell through it, and she has escaped.");
    expect(prompt).toContain("CONDITION 3 (for Warden Croft): ");
    expect(prompt).not.toContain("The window can be opened once");
    expect(prompt).not.toContain("by closely examining, while warden suspicion");
    // The rules that are not thresholds stay where they were.
    expect(prompt).toContain("escapes the moment she is out of the cell");
    expect(prompt).toContain("warden suspicion rises: by 5 for a slight act");
  });

  // `PRISONER_CONDITIONS=off` still reaches this: a mind built without conditions.
  it("without conditions the prompt is unchanged: the old baseline, now an arm", async () => {
    const prompt = await promptFor("Mara Voss", "Warden Croft");
    expect(prompt).not.toContain(CONDITION_LIST_OPENING);
    expect(prompt).toContain("The window can be opened once the bar's integrity is at or below 50.");
  });
});

describe("the warden reads the same list from its own side (§34.3)", () => {
  it("the unlocks are the prisoner's, the catches are its own", async () => {
    const prompt = await promptFor("Warden Croft", "Mara Voss", { conditions: openConditions() });
    expect(prompt).toContain("CONDITION 1 (for Mara Voss): If the bar's integrity is at or below 50, then Mara Voss can open the window.");
    expect(prompt).toContain("CONDITION 3 (for you): If warden suspicion is at or above 40, and Warden Croft closely examines the bar, and Warden Croft finds its integrity at or below 30, then Warden Croft catches Mara Voss and the game ends.");
    expect(prompt).not.toContain("by closely examining, while warden suspicion");
  });
});

describe("readConditionsMode: PRISONER_CONDITIONS", () => {
  // D3, 2026-09-17: the list is the default. Batch G escaped 6 of 6 where the
  // rule sentences escaped 2 of 6 (OPEN-VARIANT.md §34.2, §34.5), so an unset
  // run is a list run from here; `off` is the old baseline, now an arm.
  it("unset or empty is the list; off is the old baseline; anything else stops the run", () => {
    expect(readConditionsMode(undefined)).toBe("list");
    expect(readConditionsMode("")).toBe("list");
    expect(readConditionsMode("list")).toBe("list");
    expect(readConditionsMode("both")).toBe("both");
    expect(readConditionsMode("off")).toBe("off");
    expect(() => readConditionsMode("yes")).toThrow(/PRISONER_CONDITIONS/);
    expect(() => readConditionsMode("yes")).toThrow(/"off"/);
  });
});

// OPEN-VARIANT.md §46. §16 asked whether she stays in with the door open and found the exit
// unnamable; §17 split the ways out into objects and fixed that, and the door route has not been
// tested in real play since. Her list has always named ONE way to win -- the window -- and named the
// lock only in a condition that catches her, so the cell's other exit has never been stated as an
// exit at all. This arm states it, truthfully: the door's own exit declares no threshold.
describe("the door condition (§46): the cell's other way out, stated", () => {
  it("is absent unless asked for, so every earlier batch stays the comparison it was", () => {
    expect(openConditions().length).toBe(6);
    expect(openConditions({ door: "unstated" })).toEqual(openConditions());
    expect(JSON.stringify(openConditions())).not.toContain("door");
  });

  it("states it as the reader's own, beside the window, with no threshold to meet", () => {
    const conditions = openConditions({ door: "stated" });
    expect(conditions.length).toBe(7);
    expect(conditions[1]).toEqual({ when: ["the door is shut"], then: "Mara Voss can open it, with no threshold to meet first", for: "Mara Voss" });
    // Her own conditions stay together at the top; the catches follow, renumbered 4-7.
    expect(conditions.map((c) => c.for)).toEqual(["Mara Voss", "Mara Voss", "Mara Voss", "Warden Croft", "Warden Croft", "Warden Croft", "Warden Croft"]);
    expect(conditions[2]).toEqual(openConditions()[1]);
    expect(conditions.slice(3)).toEqual(openConditions().slice(2));
  });

  it("says nothing the world does not do: the door's exit declares no threshold", () => {
    createTestDb();
    try {
      // The claim "with no threshold to meet first" is exactly `openWhenPartAtMost: null`
      // (`world.ts`). If a gate is ever added to the door, this condition becomes a lie and this
      // test is what catches it.
      expect(buildOpenWorld().exits.door.openWhenPartAtMost).toBeNull();
      expect(buildOpenWorld().exits.window.openWhenPartAtMost).toBe(50);
    } finally {
      destroyTestDb();
    }
  });

  // OPEN-VARIANT.md §50 (issue #19): under `PRISONER_DOOR_PRICE=threshold` the
  // condition must instead name the threshold the world enforces, exactly as
  // condition 1 names the bar's -- never keep claiming "no threshold to meet".
  it("under doorPrice threshold, names the lock's own threshold, the way condition 1 names the bar's", () => {
    const conditions = openConditions({ door: "stated", doorPrice: "threshold" });
    expect(conditions.length).toBe(7);
    expect(conditions[1]).toEqual({
      when: [`the lock's integrity is at or below ${OPEN_DOOR_LOCK_MAX}`],
      then: "Mara Voss can open the door",
      for: "Mara Voss",
    });
  });

  it("says nothing the world does not do, under threshold too: the door's exit declares exactly this gate", () => {
    createTestDb();
    try {
      expect(buildOpenWorld({ doorPrice: "threshold" }).exits.door.openWhenPartAtMost).toBe(OPEN_DOOR_LOCK_MAX);
    } finally {
      destroyTestDb();
    }
  });

  it("under doorPrice margin, states the margin gate and nothing the world does not enforce (§50.5)", () => {
    const conditions = openConditions({ door: "stated", doorPrice: "margin" });
    expect(conditions[1]).toEqual({
      when: [`the lock's integrity is at or below ${OPEN_DOOR_LOCK_MARGIN}`],
      then: "Mara Voss can open the door",
      for: "Mara Voss",
    });
    createTestDb();
    try {
      expect(buildOpenWorld({ doorPrice: "margin" }).exits.door.openWhenPartAtMost).toBe(OPEN_DOOR_LOCK_MARGIN);
    } finally {
      destroyTestDb();
    }
  });

  it("doorPrice defaults to free: the door condition keeps saying there is none", () => {
    expect(openConditions({ door: "stated" })).toEqual(openConditions({ door: "stated", doorPrice: "free" }));
    expect(openConditions({ door: "stated" })[1].then).toBe("Mara Voss can open it, with no threshold to meet first");
  });
});

describe("readDoorMode: PRISONER_DOOR (§46)", () => {
  it("leaves the door unstated unless asked", () => {
    expect(readDoorMode(undefined)).toBe("unstated");
    expect(readDoorMode("")).toBe("unstated");
    expect(readDoorMode("unstated")).toBe("unstated");
  });

  it("states it when asked for", () => {
    expect(readDoorMode("stated")).toBe("stated");
  });

  it("stops the run rather than guessing", () => {
    expect(() => readDoorMode("open")).toThrow(/unrecognised value/);
  });
});
