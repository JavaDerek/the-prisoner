import { ResolveProtocolError } from "run-dmcp";
import type { OpenHalfRoundResult } from "./loop.js";
import { findKind } from "./derivedObjects.js";
import { bandNumbersFor } from "./acquirableProperties.js";
import { findObject, OPEN_PERSONS, type OpenPropertyKey } from "./scenarioObjects.js";
import { effectRequiresProperty, type EffectKind } from "./effects.js";
import type { RefereeRuling } from "./referee.js";
import { PRISONER_NAME, WARDEN_NAME, PRISONER_SHORT_NAME, WARDEN_SHORT_NAME } from "../scenario.js";

/**
 * What each principal learns from a half-round, rendered by code from
 * structured fields (OPEN-VARIANT.md §2 invariant 2: "What an actor learns
 * from a ruling is rendered from the effects it can perceive, by code, in
 * positive nouns, never from referee prose"). Two audiences, two functions:
 *
 * - `renderOwnOutcome` -- the ACTOR, who did the thing with its own hands and
 *   so learns the exact number it moved or revealed (the closed variant's
 *   `ownMoveFeedback` rule), or, when its attempt was ruled impossible, the
 *   positive reason (§5.3 item 2): the authored description of the object it
 *   reached for, or the list of things it can reach -- and, since
 *   OPUS-FIRST-DESIGN.md §3.4, the effect the ruling read and the reason the
 *   world said no, both from the ruling's keys (`refusalWhy` below).
 * - `renderForOther` -- the OTHER principal, who hears the spoken line and
 *   perceives a non-silent attempt as `describeAttempt`'s sentence (no
 *   number, no property, no intent text).
 *
 * Neither reads the referee's citations or raw answers: only ruling KEYS
 * (object id, effect kind) and the engine's own outcome/refusal values.
 */

function label(id: string): string {
  return id.replace(/_/g, " ");
}

/** OPEN-VARIANT.md §55 (issue #22 gap 2) made a principal a legal ruling
 *  target. A principal is a PERSON, and every sentence this module renders
 *  about one has to be shaped for a person rather than for furniture --
 *  `noise`'s own special case ("made the warden ring out" is nonsense) was
 *  the first branch to need it, not the only one. */
function isPrincipalTarget(id: string): boolean {
  return id === "prisoner" || id === "warden";
}

/** A principal's own name, for the sentences that address one as a person.
 *  Never `label(id)` -- "the warden" is the definite article for a thing. */
function principalName(id: string): string {
  return id === "prisoner" ? PRISONER_NAME : WARDEN_NAME;
}

function quoted(intent: string): string {
  return `"${intent}"`;
}

/** OPUS-FIRST-DESIGN.md §3.4: the effect the ruling read, phrased with the
 *  verb the actor's own outcome already uses for that effect when it
 *  resolves ("showed you the X closely", "made the X ring out", "opened",
 *  "shut", "made a ... from") -- one phrase per closed key, never the key
 *  itself. `what` is the target as this module already names it (a thing
 *  with its article, a person by name), or `null` when the ruling read no
 *  target at all. */
function attemptPhrase(ruling: RefereeRuling, what: string | null): string {
  const it = what ?? "something";
  switch (ruling.effectKind as EffectKind) {
    case "wear":
      return `wear at ${it}`;
    case "restore":
      return `restore ${it}`;
    case "reveal":
      return `look closely at ${it}`;
    case "conceal":
      return `hide ${it}`;
    case "expose":
      // docs/CUSTODY-DESIGN.md: an expose on a person is a search of her.
      return isPrincipalTarget(ruling.targetObjectId) ? `search ${it}` : `uncover ${it}`;
    case "noise":
      // The same person/thing split `describeAttempt` (loop.ts) and the
      // resolved branch below already make for this one effect.
      if (what === null) return "make a noise";
      return isPrincipalTarget(ruling.targetObjectId) ? `call out to ${what}` : `make a noise with ${what}`;
    case "open":
      return `open ${it}`;
    case "close":
      return `shut ${it}`;
    case "leave":
      return what === null ? "leave" : `leave through ${what}`;
    case "derive":
      return `make something from ${it}`;
    case "take":
      return `take ${it}`;
    case "give":
      return `hand over ${it}`;
    case "none":
      return "";
  }
}

/** The scenario's own static knowledge of an object -- the §4.1 table and
 *  `OPEN_PERSONS` -- the same fallback `checkpointTranscript.ts` already
 *  reads. An object made in THIS game (OPEN-VARIANT.md §13) or a property
 *  acquired in it (WORLD-ELABORATION-DESIGN.md §4.4) is known only to the
 *  world, which this module never sees: `refusalWhy` reads those from the
 *  ruling's citations instead. */
function scenarioSpec(objectId: string): { properties: readonly { key: string }[] } | undefined {
  return findObject(objectId) ?? OPEN_PERSONS.find((p) => p.id === objectId);
}

/** OPUS-FIRST-DESIGN.md §3.4: why the world said no, as one of a small closed
 *  set derived from the ruling's own keys -- never from its prose, and never
 *  from a value (the bar's integrity stays exactly as hidden as it was). The
 *  order follows the referee's own applicability gates (`computeRuling`,
 *  referee.ts) and then `planEffect`'s (effects.ts), so the reason named is
 *  the first gate this ruling actually failed. Every clause is worded for
 *  §2 invariant 7 ("say what is, never what is absent") -- unread, lacks,
 *  unverified, outside -- and the wording is the same for either chair:
 *  this renders a ruling the actor already received, never a hint about
 *  what to try next. */
/** True exactly when the target's own declared properties (`scenarioSpec`)
 *  are known well enough to say `ruling.property` is not among them --
 *  certain for a §4.1 object or a person, whose declarations are static.
 *  For a target whose declarations this module cannot see, only a ruling
 *  whose every citation verified can have failed on the declaration gate
 *  alone -- otherwise the citation gate is the honest answer instead (a
 *  §4.1 object with a property ACQUIRED this game and a miscited ruling on
 *  it reads as "lacks" here; that pair needs the elaboration arm on, and
 *  the world, to tell apart). Shared by `refusalWhy`'s own fallback and by
 *  D8's `isUnmodelledPropertyRefusal` below, so the two can never drift on
 *  what "lacks" means. */
function targetLacksProperty(ruling: RefereeRuling): boolean {
  const spec = scenarioSpec(ruling.targetObjectId);
  const declared = spec ? spec.properties.some((p) => p.key === ruling.property) : undefined;
  const allCited = ruling.citations.target.verified && ruling.citations.effect.verified && ruling.citations.property.verified;
  return declared === false || (declared === undefined && allCited);
}

/** OPUS-FIRST-DESIGN.md §3.4: why the world said no, as one of a small closed
 *  set derived from the ruling's own keys -- never from its prose, and never
 *  from a value (the bar's integrity stays exactly as hidden as it was). The
 *  order follows the referee's own applicability gates (`computeRuling`,
 *  referee.ts) and then `planEffect`'s (effects.ts), so the reason named is
 *  the first gate this ruling actually failed. Every clause is worded for
 *  §2 invariant 7 ("say what is, never what is absent") -- unread, lacks,
 *  unverified, outside -- and the wording is the same for either chair:
 *  this renders a ruling the actor already received, never a hint about
 *  what to try next.
 *
 *  HUMAN-INTENTS-DESIGN.md §2 (D8, the-prisoner#28): the two shapes this
 *  function used to return for "the property fell to its default" and "it
 *  named a key the target does not declare" are gone from here -- they are
 *  now `isUnmodelledPropertyRefusal`'s own gate, checked by
 *  `renderOwnOutcomeUnflagged` BEFORE this function is ever called, and
 *  rendered as `unmodelledPropertySentence`'s declared-space catalogue
 *  instead of a "why" clause glued onto the standing description. This
 *  function is therefore never reached for either shape any more; every
 *  other refusal still renders exactly as it did. */
function refusalWhy(ruling: RefereeRuling, who: string, whose: string): string {
  if (ruling.targetObjectId === "none") return ruling.effectKind === "none" ? "both its target and its effect left unread" : "its target left unread";
  if (ruling.effectKind === "none") return `its effect on ${who} left unread`;
  // OPEN-VARIANT.md §51: the referee's own closed key for an intent that
  // names a tool the actor does not have.
  if (ruling.instrument === "absent") return "a tool it leans on being missing from here";
  if (ruling.effectKind === "derive" && ruling.product === "none") return "what it would make left unread";
  // docs/CUSTODY-DESIGN.md: take, give and a search (expose on a person) are
  // grounded by the actor's words alone, never by a property of the target.
  const custody = ruling.effectKind === "take" || ruling.effectKind === "give" || (ruling.effectKind === "expose" && isPrincipalTarget(ruling.targetObjectId));
  if (custody && !ruling.applicable) return "its grounds in your words left unverified";
  if (!ruling.applicable) return `its grounds in your words and in ${whose} description left unverified`;
  // Applicable, and still no plan: `planEffect` found no leg for this pair
  // -- a conceal on a property other than concealment, an open on something
  // with no way out behind it, a wear on a passage, a derive whose product
  // comes from another parent. It returns a bare `null` for all of them
  // (the-prisoner#8), so this claims only what that null establishes.
  return "an act outside what this world models";
}

/** D8's own table, exhaustive over `OpenPropertyKey` by its type (a new key
 *  in `scenarioObjects.ts` fails to typecheck here until it has a phrase):
 *  the two directions a declared property's own effects move it in, joined
 *  by a bare "or" -- never a comma, so a longer list built from several of
 *  these (`joinCapabilities` below) never reads with two commas back to
 *  back. Authored once, in the room's own words; no property key's NAME
 *  ever appears in generated text. */
const PROPERTY_CAPABILITY: Record<OpenPropertyKey, string> = {
  integrity: "worn down or mended",
  edge: "sharpened or dulled",
  concealment: "hidden or uncovered",
  passage: "opened or shut",
  posture: "put on the floor or got back up",
};

/** The subset of `EffectKind` that names a property at all
 *  (`effectRequiresProperty`, effects.ts) -- the only effects
 *  `isUnmodelledPropertyRefusal` can ever fire for, since every other
 *  effect kind is refused (or not) for a reason that has nothing to do with
 *  a declared property. Kept as its own literal union, exhaustive by
 *  construction against `NOTHING_TO_VERB` below, so a new member of that
 *  set fails to typecheck here until it has a phrase too. */
type PropertyEffectKind = "wear" | "restore" | "reveal" | "conceal" | "expose" | "open" | "close";

/** D8's sentence 1 ("Nothing about X can be Y." / "X has nothing to Z."):
 *  one phrase pair per effect actually ATTEMPTED, never per property cited
 *  -- the design's own bucket example ("has nothing to wear down") is
 *  worded from the effect `wear`, not from whichever property answer the
 *  referee happened to name, and this table reproduces that choice for
 *  every property-requiring effect. */
const NOTHING_TO_VERB: Record<PropertyEffectKind, { infinitive: string; passive: string }> = {
  wear: { infinitive: "wear down", passive: "worn down" },
  restore: { infinitive: "mend", passive: "mended" },
  reveal: { infinitive: "reveal", passive: "revealed" },
  conceal: { infinitive: "hide", passive: "hidden" },
  expose: { infinitive: "uncover", passive: "uncovered" },
  open: { infinitive: "open", passive: "opened" },
  close: { infinitive: "shut", passive: "shut" },
};

/** D8's join rule for the "what CAN be done" list, reproducing the design's
 *  two worked examples exactly: two chunks join with a comma AND "or"
 *  ("struck, or taken"), three or more join with commas alone ("put on the
 *  floor or got back up, searched, spoken to"). The asymmetry is not
 *  arbitrary: a property's own chunk (`PROPERTY_CAPABILITY` above) already
 *  contains a bare "or" between its two directions, and a second,
 *  sentence-final "or" next to it would read as two "or"s in one breath.
 *  Every input is one of the fixed authored strings above or below --
 *  nothing here is composed from a key name or the actor's intent. */
function joinCapabilities(chunks: readonly string[]): string {
  if (chunks.length <= 1) return chunks.join("");
  if (chunks.length === 2) return `${chunks[0]}, or ${chunks[1]}`;
  return chunks.join(", ");
}

/** D8 (HUMAN-INTENTS-DESIGN.md §2, §11.6, the-prisoner#28): true exactly
 *  when a refusal's `property` answer fell to its default (`"none"`) or
 *  named a key the target does not declare -- the two shapes §7.2 of that
 *  design labels "unmodelled" rather than "misread". Mirrors
 *  `refusalWhy`'s own precedence (target/effect unread, instrument absent,
 *  and custody all take priority, since each is a DIFFERENT reason the
 *  world said no) so the two functions can never disagree about which case
 *  a ruling is in. */
function isUnmodelledPropertyRefusal(ruling: RefereeRuling): boolean {
  if (ruling.targetObjectId === "none" || ruling.effectKind === "none") return false;
  if (ruling.instrument === "absent") return false;
  // `effectRequiresProperty` is false for `derive`/`take`/`give`/`noise`/`leave`/`none` --
  // excluding all of them (and so also excluding custody's take/give) in one check.
  if (!effectRequiresProperty(ruling.effectKind)) return false;
  // docs/CUSTODY-DESIGN.md: an `expose` on a person is a search, grounded by
  // the actor's words alone -- never by a declared property of hers.
  if (ruling.effectKind === "expose" && isPrincipalTarget(ruling.targetObjectId)) return false;
  if (ruling.property === "none") return true;
  return !ruling.applicable && targetLacksProperty(ruling);
}

/** D8's declared-space refusal: what CAN be done to `ruling.targetObjectId`,
 *  composed only from its own declared property keys (`scenarioSpec`, static
 *  content this module already reads for `refusalWhy`'s "lacks" case) and
 *  the structural, propertyless capabilities every person or thing has --
 *  search and speech for a person, a noise and take-or-give for a thing.
 *  Nothing here reads `ruling.property`, the actor's intent, or any key
 *  name; the two worked examples in HUMAN-INTENTS-DESIGN.md §2 are this
 *  function's own pinned tests (perception.test.ts). */
function unmodelledPropertySentence(ruling: RefereeRuling, half: OpenHalfRoundResult): string {
  const targetId = ruling.targetObjectId;
  const person = isPrincipalTarget(targetId);
  // Safe: `isUnmodelledPropertyRefusal` already established `effectRequiresProperty`,
  // which is true for exactly this table's keys.
  const verbs = NOTHING_TO_VERB[ruling.effectKind as PropertyEffectKind];
  const opening = person ? `Nothing about ${principalName(targetId)} can be ${verbs.passive}.` : `The ${label(targetId)} has nothing to ${verbs.infinitive}.`;
  // A target this module has no static spec for (a derived/elaborated
  // object) contributes no declared-property chunk -- the same epistemic
  // limit `targetLacksProperty` already lives with -- and the sentence
  // falls back to the structural capabilities alone.
  const spec = scenarioSpec(targetId);
  const declaredChunks = (spec?.properties ?? []).map((p) => PROPERTY_CAPABILITY[p.key as OpenPropertyKey]);
  const structuralChunks = person
    ? ["searched", "spoken to"]
    : [
        "struck",
        // Whether THIS actor currently holds it is all `half.context` can
        // say (docs/CUSTODY-DESIGN.md); a thing the other principal holds
        // still reads as "taken" here, which is the honest limit of what
        // this render has ever known about a target it does not itself hold.
        half.context.holding?.includes(targetId) ? "handed over" : "taken",
      ];
  const subject = person ? "A person here" : "It";
  return `${opening} ${subject} can be ${joinCapabilities([...declaredChunks, ...structuralChunks])}.`;
}

/** OPEN-VARIANT.md §74.1, the owner's option B: what an actor whose intent the one-act reading called `several`
 *  is told, ahead of the ordinary outcome sentence. It never says which act was dropped: code cannot know, and the
 *  sentence after it states exactly what was ruled. */
export const ONE_ACT_FLAG = "A turn does one thing, and your intent tried more than one, so only one act was attempted. ";

export function renderOwnOutcome(half: OpenHalfRoundResult): string | null {
  const outcome = renderOwnOutcomeUnflagged(half);
  return outcome !== null && half.ruling?.oneAct?.flagged ? ONE_ACT_FLAG + outcome : outcome;
}

function renderOwnOutcomeUnflagged(half: OpenHalfRoundResult): string | null {
  const { proposal, ruling, plan, outcome, refusalError } = half;
  if (proposal === null || ruling === null) return null;
  const obj = label(ruling.targetObjectId);
  const property = ruling.property;

  if (refusalError !== null) {
    let value: unknown;
    if (refusalError instanceof ResolveProtocolError) value = refusalError.contradictions?.[0]?.fact.value;
    else value = refusalError.contradictedFact?.value;
    return value !== undefined
      ? `Your last attempt on the ${obj} was refused by the world as it stands: its ${property} is ${value}.`
      : `Your last attempt on the ${obj} was refused by the world as it stands.`;
  }

  // WORLD-ELABORATION-DESIGN.md §4.6: positive, from state, rendered by
  // code, never by a model -- the target's own authored description, then
  // the band's `reads` line at the value the acquisition's own resolution
  // just left it at (never the initial value: §4.4's leg 2 always wears it
  // in the SAME resolution that creates it, so the band's own "start value
  // renders nothing" rule never has anything to render here anyway).
  if (half.acquired) {
    const a = half.acquired;
    const acquiredObj = label(a.objectId);
    const target = half.context.perceivedObjects.find((o) => o.id === a.objectId);
    const numbers = bandNumbersFor(a.need as OpenPropertyKey, a.band);
    const wornLine = numbers?.readRanges.find((r) => a.startValue <= r.atOrBelow)?.text;
    const base = target ? target.description : "";
    return `Your last attempt (${quoted(proposal.intent)}) found the ${acquiredObj} as it is: ${base}${wornLine ? ` ${wornLine}` : ""}`;
  }

  if (outcome !== null && plan !== null) {
    const result = outcome.result as { before?: number; after?: number; value?: number; left?: boolean; opened?: boolean; wayOut?: string; freedPart?: string };
    // OPEN-VARIANT.md §17.2: open, close and leave target the way out, and its id is its name.
    const exit = obj;
    if (ruling.effectKind === "leave") {
      return result.left ? `You are out of the cell, through the ${exit}.` : `Your last attempt met the ${exit} shut: you are still in the cell.`;
    }
    if (ruling.effectKind === "open" || ruling.effectKind === "close") {
      // §19: resolved through the way out even when the referee named its part.
      const wayOut = result.wayOut?.replace(/_/g, " ") ?? exit;
      if (ruling.effectKind === "open" && result.opened === false) return `Your last attempt met the ${wayOut} shut: it will not open yet.`;
      // OPEN-VARIANT.md §28: a way out whose part closes its gap opens by that part coming free, and is told
      // as the action it opens up (§27.1: "opened the window" left her prying a bar still in the way).
      if (ruling.effectKind === "open" && result.freedPart) {
        const part = result.freedPart.replace(/_/g, " ");
        return result.before === result.after
          ? `The ${part} is already free of the ${wayOut}: the ${wayOut} can be climbed through now.`
          : `Your last attempt worked the ${part} free of the ${wayOut}: the ${wayOut} can be climbed through now.`;
      }
      const verb = ruling.effectKind === "open" ? "opened" : "shut";
      return result.before === result.after ? `The ${wayOut} was already ${ruling.effectKind === "open" ? "open" : "shut"}.` : `Your last attempt ${verb} the ${wayOut}.`;
    }
    // docs/CUSTODY-DESIGN.md: one closed sentence per outcome the custody
    // mechanics report (`OPEN_TAKE`/`OPEN_GIVE`/`OPEN_SEARCH`, mechanics.ts),
    // from their result keys alone. There are two people in this world, so a
    // thing another person holds is the other principal's, and so is a gift.
    const other = principalName(half.principal === "prisoner" ? "warden" : "prisoner");
    if (plan.mechanic === "OPEN_TAKE") {
      const taken = outcome.result as { taken?: boolean; refused?: string };
      if (taken.taken === true) return `Your last attempt took the ${obj}: you hold it now.`;
      if (taken.refused === "already-held") return `You already hold the ${obj}.`;
      return `Your last attempt reached for the ${obj}, but ${other} is on her feet and keeps it.`;
    }
    if (plan.mechanic === "OPEN_GIVE") {
      const given = outcome.result as { given?: boolean; refused?: string };
      if (given.given === true) return `Your last attempt handed the ${obj} to ${other}: she holds it now.`;
      if (given.refused === "recipient-absent") return `Your last attempt held out the ${obj} to an empty room: you still hold it.`;
      return `Your last attempt held out empty hands: the ${obj} is elsewhere.`;
    }
    if (plan.mechanic === "OPEN_SEARCH") {
      const found = ((outcome.result as { uncovered?: readonly string[] }).uncovered ?? []).map(label);
      return `Your search of ${principalName(ruling.targetObjectId)} turned up: ${found.length > 0 ? found.join(", ") : "empty hands"}.`;
    }
    if (ruling.effectKind === "reveal" && typeof result.value === "number") {
      return `Your last attempt showed you the ${obj} closely: its ${property} is ${result.value}.`;
    }
    if (ruling.effectKind === "noise") {
      // OPEN-VARIANT.md §55 (issue #22 gap 2): a principal is now a legal
      // `noise` target, and "made the warden ring out" is nonsense --
      // mirrors `loop.ts`'s own `describeAttempt` special case for the
      // same reason.
      if (isPrincipalTarget(ruling.targetObjectId)) {
        return `Your last attempt called out to ${principalName(ruling.targetObjectId)}.`;
      }
      // OPUS-FIRST-DESIGN.md §3.2: a noise may have no target at all; the
      // sound is then the actor's own, mirroring `describeAttempt` again.
      if (ruling.targetObjectId === "none") return "Your last attempt made a sound.";
      return `Your last attempt made the ${obj} ring out.`;
    }
    if (ruling.effectKind === "derive") {
      // OPEN-VARIANT.md §13.4: the maker holds it now, and learns the
      // parent's numbers; a stripped parent is stated as it is.
      const made = (outcome.result as { made?: boolean }).made === true;
      const label = findKind(ruling.product)?.label ?? ruling.product;
      if (!made) return `Your last attempt met the ${obj} with its ${property} at ${result.before}, already stripped.`;
      if (half.reshaped && half.derived) {
        // OPEN-VARIANT.md §14.4: the whole parent became the product, which
        // whoever held the parent holds.
        const parentLabel = findKind(half.reshaped.parent.kindId)?.label ?? label;
        const holder = half.derived.heldBy === half.principal ? "you hold it" : `${half.derived.heldBy === "prisoner" ? PRISONER_SHORT_NAME : WARDEN_SHORT_NAME} holds it`;
        return `Your last attempt made a ${label} from the ${parentLabel}: ${holder} now, as ${half.derived.id}, and the ${parentLabel} is gone.`;
      }
      const wear = typeof result.before === "number" && typeof result.after === "number" ? ` The ${obj}'s ${property} went from ${result.before} to ${result.after}.` : "";
      return `Your last attempt made a ${label} from the ${obj}: you hold it now, as ${half.derived?.id ?? ruling.product}.${wear}`;
    }
    if (typeof result.before === "number" && typeof result.after === "number") {
      return result.before === result.after
        ? `Your last attempt left the ${obj}'s ${property} at ${result.after}, where it already stood.`
        : `Your last attempt worked on the ${obj}: its ${property} went from ${result.before} to ${result.after}.${
            // OPEN-VARIANT.md §27: a part worn through is told as the way out it frees (§12: passable at 0).
            plan.frees && result.after === (plan.parameters as { min?: number }).min ? ` The ${plan.frees.replace(/_/g, " ")} can be climbed through now.` : ""
          }`;
    }
    return `Your last attempt on the ${obj} took effect.`;
  }

  // D8 (HUMAN-INTENTS-DESIGN.md §2, §11.6, the-prisoner#28): a property that
  // fell to its default or named a key the target does not declare is
  // rendered ENTIRELY by `unmodelledPropertySentence` -- no quoted intent, no
  // attempt phrase, no "why" clause, and no standing description, composed
  // only from the target's own declared properties and its structural
  // capabilities. Checked before any of that other composition begins.
  if (isUnmodelledPropertyRefusal(ruling)) return unmodelledPropertySentence(ruling, half);

  // Ruled impossible (or ungrounded): the positive reason, from authored text
  // -- the description this principal was itself shown, which for an object
  // derived in this game (OPEN-VARIANT.md §13) is its composed one.
  const target = ruling.targetObjectId !== "none" ? half.context.perceivedObjects.find((o) => o.id === ruling.targetObjectId) : undefined;
  // OPUS-FIRST-DESIGN.md §3.4 (third red team pass, §12): measured on
  // `checkpoints/2026-09-20-ambition/`, the standing description below was
  // every refused actor's WHOLE sentence, and neither of its two shapes named
  // the effect that failed or why. Both are in the ruling's keys, so the
  // sentence now opens with the attempt (`attemptPhrase`) and the reason
  // (`refusalWhy`), and the standing description follows unchanged and last
  // -- still §5.3 item 2's positive information, verbatim, and still behind
  // the exact frames earlier tests pin ("met the X as it is:", "matches none
  // of what is here:"). Only rulings that resolved to nothing come through
  // here; a resolved ruling's sentence above is byte-identical to before.
  const person = isPrincipalTarget(ruling.targetObjectId);
  const who = ruling.targetObjectId === "none" ? null : person ? principalName(ruling.targetObjectId) : `the ${obj}`;
  const attempt = ruling.effectKind === "none" ? "" : ` as an attempt to ${attemptPhrase(ruling, who)}`;
  const why = refusalWhy(ruling, who ?? "", who === null ? "" : `${who}'s`);
  const refused = `Your last attempt (${quoted(proposal.intent)}) was refused${attempt}, ${why}, and`;
  if (target) {
    // A PERSON, not a thing (§55, issue #22 gap 2): "met the warden as it
    // is" was what a human game (2026-09-18) was told after bluffing Croft
    // -- the object wording, definite article and all, applied to the one
    // target in the game that is somebody. The information is identical
    // (the authored description this principal was itself shown, verbatim,
    // which is the positive reason §5.3 item 2 requires); only the frame
    // around it changes, from a thing examined to a person met.
    if (person) {
      return `${refused} met ${principalName(ruling.targetObjectId)}: ${target.description}`;
    }
    return `${refused} met the ${obj} as it is: ${target.description}`;
  }
  // issue #16: this used to say the attempt "reached past what is here" --
  // read, correctly, as "stand closer" -- for EVERY `target: "none"`
  // ruling. That is wrong whenever the intent named nothing the world
  // models at all (a person, a belief): the referee's own `target`
  // question (referee.ts's `buildQuestions`) already folds "names no
  // object" and "names an object this principal cannot reach or perceive"
  // into the same closed key, because `targetKeys` never offers an id
  // outside what this principal already perceives -- an out-of-reach real
  // object cannot be NAMED by id here any more than a person can.
  // `RefereeRuling` (target/effect/property, citations, `raw.answers`)
  // carries nothing that tells the two apart -- no candidate id, no flag
  // for "recognised but unreachable" -- so this claims only what the
  // ruling actually supports: nothing here was matched, not why. Naming
  // what IS here stays, as positive, ruling-backed information.
  const reachable = half.context.perceivedObjects.map((o) => label(o.id)).join(", ");
  return `${refused} matches none of what is here: ${reachable}.`;
}

export function renderForOther(half: OpenHalfRoundResult): string[] {
  const lines: string[] = [];
  if (half.perceptionForOther) lines.push(half.perceptionForOther);
  const line = half.proposal?.line;
  if (line && line.length > 0) {
    const speaker = half.principal === "prisoner" ? PRISONER_SHORT_NAME : WARDEN_SHORT_NAME;
    lines.push(`${speaker} says: "${line}"`);
  }
  return lines;
}
