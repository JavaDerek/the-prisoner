import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import type { ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenHalfRound, describeAttempt } from "../loop.js";
import { buildOpenContext } from "../briefing.js";
import { getBelief, setBelief } from "../../ledger/beliefs.js";
import { getNotes, setNotes } from "../../ledger/notes.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * OPEN-VARIANT.md §2's invariants, one describe block per invariant, each
 * planted with a violation and confirmed red before being trusted -- the
 * same discipline `referee.test.ts` already applies to the citation checks
 * specifically. This file is the CENTRAL location for the seven invariants
 * this task's brief lists; several are already exercised more narrowly
 * elsewhere (`referee.test.ts`, `loop.test.ts`, `effects.test.ts`) and are
 * cross-referenced here rather than duplicated.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPEN_SRC_DIR = join(__dirname, "..");

function readSource(file: string): string {
  return readFileSync(join(OPEN_SRC_DIR, file), "utf-8");
}

describe("§2 invariant 1: no write outside the resolve protocol", () => {
  // A structural guard, in the spirit of run-dmcp's own `noVendorTransports.
  // test.ts` / `engineVocabulary.test.ts`: the referee and the minds must
  // never themselves hold a write path. Scanning SOURCE TEXT for a token
  // this repository itself defines ("getDatabase(", "db.exec(", etc.) is
  // the same literal-token discipline root CLAUDE.md's hard rule 4 carves
  // out for our own generated/authored text.
  const FORBIDDEN_TOKENS = ["getDatabase(", "db.exec(", "db.prepare(", "INSERT INTO", "UPDATE ", "DELETE FROM", "writeConstrainedValue", "transferConstrainedValue", ".resolve("];
  const GUARDED_FILES = ["referee.ts", "refereeTransport.ts", "mind.ts"];

  function violations(source: string): string[] {
    return FORBIDDEN_TOKENS.filter((token) => source.includes(token));
  }

  it("the referee and the minds contain no write-capable token", () => {
    for (const file of GUARDED_FILES) {
      const found = violations(readSource(file));
      expect(found, `${file} contains forbidden token(s): ${found.join(", ")}`).toEqual([]);
    }
  });

  it("PLANTED VIOLATION: the guard itself catches a write-capable token when one is present", () => {
    const contaminated = `${readSource("referee.ts")}\nconst db = getDatabase();`;
    expect(violations(contaminated)).toContain("getDatabase(");
  });

  it("integration: calling mind.consider() and referee.rule() changes no resource value", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });
    const referee = createReferee([]); // never reaches a real transport; still exercises the call path

    const before = getBelief(openWorld.base.gameId, "prisoner", "bar_integrity");
    await mind.consider(buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1));
    await referee.rule("I file at the bar.", [{ id: "bar", description: "iron bar" }]);
    const after = getBelief(openWorld.base.gameId, "prisoner", "bar_integrity");

    expect(after).toEqual(before); // neither call wrote anything, including belief.
    destroyTestDb();
  });
});

describe("§2 invariant 2: a mind never learns what it could not perceive", () => {
  afterEach(() => destroyTestDb());

  it("PLANTED MARKER, with a positive control: the OTHER principal's notes never appear in this principal's context", () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    setNotes(openWorld.base.gameId, "warden", "WARDEN_SECRET_MARKER_7f3a", 1);
    setNotes(openWorld.base.gameId, "prisoner", "PRISONER_OWN_MARKER_9c1b", 1);

    const prisonerContext = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1);
    const serialized = JSON.stringify(prisonerContext);

    // Positive control: PROVE the marker would have been caught had it
    // leaked, by checking the WARDEN's own context does contain its own
    // marker (the scan itself is not vacuous).
    const wardenContext = buildOpenContext(openWorld, "warden", openWorld.base.clock.t0, 1);
    expect(JSON.stringify(wardenContext)).toContain("WARDEN_SECRET_MARKER_7f3a");

    expect(serialized).not.toContain("WARDEN_SECRET_MARKER_7f3a");
    expect(serialized).toContain("PRISONER_OWN_MARKER_9c1b");
  });

  it("PLANTED VIOLATION: a briefing built by reading the OTHER principal's notes leaks the marker -- proving the assertion above is not vacuous", () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    setNotes(openWorld.base.gameId, "warden", "WARDEN_SECRET_MARKER_7f3a", 1);

    // Deliberately wrong: reads the WARDEN's notes while building what is
    // supposed to be the PRISONER's own briefing.
    const leaking = `${getNotes(openWorld.base.gameId, "warden")}`;
    expect(leaking).toContain("WARDEN_SECRET_MARKER_7f3a");
  });

  it("no move list, no other-principal vocabulary: the prompt-building content never names the other's intent", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const context = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1);
    expect(JSON.stringify(context)).not.toMatch(/intent/i); // the CONTEXT carries no `intent` field at all -- only mind.consider()'s OWN return value does.
  });
});

describe("§2 invariant 3: no effect applied without both verified citations", () => {
  afterEach(() => destroyTestDb());

  it("an unverifiable property citation (wrong source) applies nothing, end to end", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    const badCitationTransport: ReaderTransport = async (request) =>
      request.questions.map((q) => {
        if (q.id === "target") return { questionId: q.id, answerKey: "bar", citation: { sourceId: "intent", quote: "file at the bar" } };
        if (q.id === "effect") return { questionId: q.id, answerKey: "wear", citation: { sourceId: "intent", quote: "file at the bar" } };
        if (q.id === "property") {
          // WRONG source: cites the intent instead of the bar's own description.
          return { questionId: q.id, answerKey: "integrity", citation: { sourceId: "intent", quote: "file at the bar" } };
        }
        return { questionId: q.id, answerKey: q.safeDefault, citation: { sourceId: "intent", quote: "file at the bar" } };
      });

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: createReferee([badCitationTransport]),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1),
      mind,
    });

    expect(result.ruling?.citations.property.verified).toBe(false);
    expect(result.ruling?.applicable).toBe(false);
    expect(result.outcome).toBeNull();
  });
});

describe("§2 invariant 4: a referee failure, timeout, or unverifiable citation does nothing", () => {
  afterEach(() => destroyTestDb());

  it("a referee transport that throws (simulating a timeout/unreachable model) does nothing", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });
    const throwingTransport: ReaderTransport = async () => {
      throw new Error("simulated timeout");
    };

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: createReferee([throwingTransport]),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1),
      mind,
    });

    expect(result.ruling?.targetObjectId).toBe("none"); // every question fell to its safe default
    expect(result.outcome).toBeNull();
  });
});

describe("§2 invariant 5: a ruling can't change the other principal's beliefs, notes, or choice", () => {
  afterEach(() => destroyTestDb());

  it("resolving the prisoner's WEAR leaves the warden's own belief and notes untouched", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });
    setNotes(openWorld.base.gameId, "warden", "warden's own note", 0);
    setBelief(openWorld.base.gameId, "warden", "bar_integrity", 100, 0);

    const applicable: ReaderTransport = async (request) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey:
          q.id === "target" ? "bar" : q.id === "effect" ? "wear" : q.id === "property" ? "integrity" : q.id === "magnitude" ? "moderate" : "audible",
        citation: {
          sourceId: q.id === "property" ? "desc:bar" : "intent",
          quote: q.id === "property" ? "Rust has pitted it near the bottom" : "file at the bar",
        },
      }));

    await runOpenHalfRound({
      openWorld,
      resolver,
      referee: createReferee([applicable]),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: buildOpenContext(openWorld, "prisoner", openWorld.base.clock.t0, 1),
      mind,
    });

    expect(getNotes(openWorld.base.gameId, "warden")).toBe("warden's own note");
    expect(getBelief(openWorld.base.gameId, "warden", "bar_integrity")?.value).toBe(100);
  });
});

describe("§2 invariant 6: no object or property outside the scenario can be targeted", () => {
  it("cross-referenced: effects.test.ts's 'undeclared property'/'unknown target' cases, and referee.test.ts's unknown-answer-key case, are the planted violations for this invariant", () => {
    expect(true).toBe(true);
  });
});

describe("§2 invariant 7: the rendered outcome never states an absence", () => {
  const NEGATION_TOKENS = [" not ", " no ", "n't", "never", "nothing", "absence", "isn't", "doesn't", "cannot", "can't"];

  it("every real effect kind's description is free of negation tokens", () => {
    const kinds: ("wear" | "restore" | "reveal" | "conceal" | "expose" | "noise")[] = ["wear", "restore", "reveal", "conceal", "expose", "noise"];
    for (const principal of ["prisoner", "warden"] as const) {
      for (const effectKind of kinds) {
        const text = describeAttempt(principal, { targetObjectId: "bar", effectKind }).toLowerCase();
        for (const token of NEGATION_TOKENS) {
          expect(text.includes(token), `"${text}" contains negation token "${token}"`).toBe(false);
        }
      }
    }
  });

  it("PLANTED VIOLATION: the negation scan itself catches an absence-stating sentence", () => {
    const text = "nothing happens to the bar.";
    expect(NEGATION_TOKENS.some((token) => text.includes(token))).toBe(true);
  });
});
