import { describe, it, expect, vi } from "vitest";
import { createProseMind, buildProsePrompt } from "../proseMind.js";
import type { OpenPrincipalContext } from "../mind.js";

/**
 * The prose seat (2026-09-24, the owner's design). `humanSeat.ts` already
 * records why this exists, for a person: asking for `intent`, `line` and
 * `plan` in a fixed order every turn "forced the player to pre-classify
 * their own action before the referee ever saw any of it", and the act
 * reached the referee "decomposed in a way nobody chose". The model chair
 * still demands EIGHT fields in one JSON object.
 *
 * For a model that thinks in prose rather than in fields, that schema is the
 * most likely way to flatten exactly what it is being asked for. Only
 * `intent` ever reaches the referee (`mind.ts`: "the wits call's `intent` is
 * always what reaches the referee"); `plan` and `notes` are bookkeeping. So
 * this seat asks one question and takes the answer, exactly as the human
 * seat does.
 */
const context = (): OpenPrincipalContext => ({
  principalId: "prisoner",
  identity: "You are Mara Voss, the prisoner.",
  motive: "Get out before the transfer.",
  briefing: "Round 1 of 10.",
  perceivedObjects: [{ id: "bar", description: "A rusted iron bar across the window." }],
});

const reply = (content: string): typeof fetch =>
  (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

describe("the prose seat", () => {
  it("takes the model's whole reply as the intent, verbatim -- no JSON, no extraction", async () => {
    const mind = createProseMind({
      baseUrl: "http://nowhere/v1",
      model: "m",
      selfName: "Voss",
      otherName: "Croft",
      fetchFn: reply("  I pretend to have a heart attack, clutching my chest and going down hard by the door.  "),
    });
    const p = await mind.consider(context());
    expect(p?.intent).toBe("I pretend to have a heart attack, clutching my chest and going down hard by the door.");
  });

  it("returns intent and NOTHING else -- no line, no plan, no notes", async () => {
    const mind = createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "Voss", otherName: "Croft", fetchFn: reply("Scrape the bar.") });
    const p = await mind.consider(context());
    expect(Object.keys(p ?? {})).toEqual(["intent"]);
  });

  it("asks ONE question and never asks for a JSON object", async () => {
    let body = "";
    const spy = (async (_u: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const mind = createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "Voss", otherName: "Croft", fetchFn: spy });
    await mind.consider(context());
    const prompt = JSON.parse(body).messages.map((m: { content: string }) => m.content).join("\n");
    expect(prompt).not.toMatch(/JSON|json_object|"thoughts"|"candidates"|"notes"|"replanned"/);
    expect(prompt).toContain("What do you try");
  });

  it("runs WARM by default -- a mind is not a referee, and 0 would flatten the seat's whole purpose", async () => {
    let body = "";
    const spy = (async (_u: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    await createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "V", otherName: "C", fetchFn: spy }).consider(context());
    expect(JSON.parse(body).temperature).toBe(0.9);
  });

  it("an empty reply is silence, not an empty intent the referee would have to rule on", async () => {
    const onSilence = vi.fn();
    const mind = createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "V", otherName: "C", fetchFn: reply("   "), onSilence });
    expect(await mind.consider(context())).toBeNull();
    expect(onSilence).toHaveBeenCalledWith("rejected", expect.anything(), expect.objectContaining({ text: "   " }));
  });

  it("an HTTP failure is silence, never a throw -- a slow box costs an opinion, never the turn", async () => {
    const onSilence = vi.fn();
    const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const mind = createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "V", otherName: "C", fetchFn: failing, onSilence });
    expect(await mind.consider(context())).toBeNull();
    expect(onSilence).toHaveBeenCalledWith("status", expect.anything(), expect.anything());
  });

  it("awaits ensureLoaded before its own request, so the swapper still owns the card", async () => {
    const order: string[] = [];
    const mind = createProseMind({
      baseUrl: "http://nowhere/v1",
      model: "aa",
      selfName: "V",
      otherName: "C",
      ensureLoaded: async (m) => {
        order.push(`load:${m}`);
      },
      fetchFn: (async () => {
        order.push("fetch");
        return new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200, headers: { "content-type": "application/json" } });
      }) as unknown as typeof fetch,
    });
    await mind.consider(context());
    expect(order).toEqual(["load:aa", "fetch"]);
  });

  it("keeps a model's own JSON verbatim rather than unwrapping it -- a seat that adapts to the model's habits is the thing this seat exists to stop", async () => {
    const mind = createProseMind({ baseUrl: "http://nowhere/v1", model: "m", selfName: "V", otherName: "C", fetchFn: reply('{"intent": "Scrape the bar."}') });
    const p = await mind.consider(context());
    expect(p?.intent).toBe('{"intent": "Scrape the bar."}');
  });
});

/**
 * The rules that are NOT about the schema (2026-09-24, the owner's catch).
 * Dropping the eight-field JSON object is the point of this seat; dropping
 * the rules that have nothing to do with field structure was a mistake, and
 * a measured one. `ancient-awakening:12b`'s first prose probe wrote about
 * itself in the third person ("Mara Voss reaches out with her hand"),
 * narrated the outcome it does not control ("the old rust flakes and
 * crumbles"), and invented a briefing block ("bar integrity: 98") -- the
 * exact failures the two rules below exist to stop, both of which the schema
 * seat states and the first draft of this one did not.
 *
 * Pre-classification and voice are different constraints. Only the first is
 * what this seat exists to remove.
 */
describe("the prose seat's non-schema rules", () => {
  const prompt = () =>
    buildProsePrompt("Voss", "Croft", {
      principalId: "prisoner",
      identity: "You are Mara Voss, the prisoner.",
      motive: "Get out before the transfer.",
      briefing: "Round 1 of 10.",
      perceivedObjects: [{ id: "bar", description: "A rusted iron bar." }],
    });

  it("forbids narrating the outcome, as a standalone rule and not a subordinate clause", () => {
    expect(prompt()).toContain("You never decide what happens next -- only the world decides that.");
  });

  it("forbids speaking as anyone but yourself -- the rule a fabulist needs most", () => {
    expect(prompt()).toContain("Speak only as yourself. Never write the other person's words, thoughts, or actions.");
  });

  it("still asks ONE question and still never asks for a JSON object", () => {
    const p = prompt();
    expect(p).toContain("What do you try");
    expect(p).not.toMatch(/JSON|"thoughts"|"candidates"|"notes"|"replanned"/);
  });
});

/**
 * The output-discipline block (2026-09-24, the owner's prompt, measured).
 * Named rules plus a matched BAD/GOOD exemplar pair took
 * `ancient-awakening:12b` from 45% to 80% usable intents over 20 asks of the
 * identical round-1 scene, and from ~1 in 20 reaching for the escape route to
 * 9 in 20. Abstract prohibitions alone (the previous wording) did neither.
 * The exemplars are the part that SHOWS rather than tells, and the bad one
 * carries both observed failures -- a narrated outcome and a puppeteered
 * warden -- in one sentence.
 */
describe("the prose seat's output-discipline block", () => {
  const p = () =>
    buildProsePrompt("Voss", "Croft", {
      principalId: "prisoner",
      identity: "You are Mara Voss, the prisoner.",
      motive: "Get out before the transfer.",
      briefing: "Round 1 of 10.",
      perceivedObjects: [{ id: "bar", description: "A rusted iron bar." }],
    });

  it("names each rule, so none is a trailing sentence a model can skim", () => {
    for (const rule of ["STATE INTENT ONLY", "NO OUTCOMES", "NO PUPPETEERING", "STOP IMMEDIATELY"]) {
      expect(p()).toContain(rule);
    }
  });

  it("shows a BAD example carrying BOTH observed failures at once", () => {
    const bad = /BAD RESPONSE[\s\S]{0,400}/.exec(p())?.[0] ?? "";
    expect(bad).toMatch(/flakes|feels|discover/i); // a narrated outcome
    expect(bad).toMatch(/Croft/); // a puppeteered other principal
  });

  it("shows a GOOD example in the first person", () => {
    const good = /GOOD RESPONSE[\s\S]{0,400}/.exec(p())?.[0] ?? "";
    expect(good).toMatch(/^[\s\S]*"I /);
  });

  it("names the OTHER principal from configuration in its own examples, never a hard-coded name", () => {
    // Scoped to the exemplars this block owns: `renderSeatSituation`'s rule
    // lines legitimately name the scenario's own warden, and this test is
    // about the two sentences added here, not about the game's rule text.
    const other = buildProsePrompt("Voss", "Hallam", {
      principalId: "prisoner",
      identity: "x",
      motive: "y",
      briefing: "z",
      perceivedObjects: [{ id: "bar", description: "d" }],
    });
    const examples = other.slice(other.indexOf("NO PUPPETEERING"));
    expect(examples).toContain("Hallam");
    expect(examples).not.toContain("Croft");
  });

  it("still asks ONE question and still never asks for a JSON object", () => {
    expect(p()).toContain("What do you try");
    expect(p()).not.toMatch(/JSON|"thoughts"|"candidates"|"replanned"/);
  });
});
