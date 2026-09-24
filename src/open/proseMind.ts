/**
 * The PROSE SEAT: a model-backed mind that is asked one question and whose
 * answer is taken as it comes.
 *
 * WHY THIS EXISTS, and it is `humanSeat.ts`'s reason with a model in the
 * chair instead of a person. That seat used to ask a player for `intent`,
 * `line` and `plan` in a fixed order every turn, and its own comment records
 * what that cost: it "forced the player to pre-classify their own action
 * before the referee ever saw any of it" -- the owner typed "pretend to have
 * a heart attack", the speech field went blank, and "the act reached the
 * referee decomposed in a way nobody chose". The fix there was to ask ONE
 * question.
 *
 * The model chair never got that fix. `buildOpenSingleCallPrompt` still asks
 * for one JSON object with EIGHT fields -- `thoughts`, `candidates`,
 * `intent`, `line`, `plan`, `replanned`, `replanBecause`, `notes`. For a
 * model that reasons in fields that is fine. For a model whose whole value is
 * that it says un-obvious things in prose, that schema is the most likely way
 * to flatten exactly what it is being asked for, and a failure to fill it
 * would be reported as "the model cannot propose" when what really happened
 * is that the harness asked the wrong question. This repository has already
 * measured that answer SHAPE changes answers (`checkpoints/2026-09-23-oneact-lab/`:
 * identical rules asked as a count versus as a closed key get different rows
 * wrong).
 *
 * WHAT IS ACTUALLY REQUIRED. Only `intent` reaches the referee (`mind.ts`:
 * "the wits call's `intent` is always what reaches the referee"). `plan` and
 * `notes` are bookkeeping -- persisted, rendered back in the next briefing,
 * counted by §22 -- and `mind-seam`'s own `Proposal` makes everything but
 * `intent` optional. A seat that supplies intent alone plays a legal game and
 * simply carries no self-memory between turns, which is what a person in the
 * human seat does today.
 *
 * NOT `createLocalMind`. That wire is JSON-only by construction: its `coerce`
 * receives what `firstJsonObject` pulled out of the reply, so a prose answer
 * reads as `unparseable` silence before this seat's own rule ever runs.
 * `Mind` is a one-method interface and `humanSeat.ts` already implements it
 * directly; this does the same, with the wire's own discipline -- a POST to
 * an OpenAI-compatible `/chat/completions`, no credential, an abort on
 * timeout, an injectable `fetchFn` so every test runs offline, and failure
 * that resolves to `null` rather than throwing.
 *
 * WARM, not cold. `temperature` defaults to 0.9, `mind-seam`'s own default
 * for a mind ("warm, because a mind cannot write"). The referee runs at 0
 * because §3.5 wants determinism; a seat chosen for reach must not inherit
 * that.
 *
 * NO CLEANUP OF THE REPLY, deliberately. Whatever comes back is trimmed,
 * length-capped by `coerceProposal` -- the seam's own rule about what a
 * proposal is, not a second one written here -- and handed to the referee.
 * Nothing strips a preamble, unwraps a JSON object, or takes "the first
 * paragraph": each of those is a guess at what the words mean, which this
 * repository forbids (CLAUDE.md, "Never pattern-match meaning"), and a seat
 * that quietly adapts to one model's habits is the thing this seat exists to
 * stop. A model that answers in JSON here has been given the wrong seat, and
 * the transcript should show that plainly rather than hide it.
 */
import type { Mind, Proposal, SilenceReason, SilenceDetail } from "mind-seam";
import { coerceProposal } from "mind-seam";
import { renderSeatSituation, ONE_ACT_RULE, type OpenPrincipalContext } from "./mind.js";
import type { Condition } from "./conditionList.js";

export interface CreateProseMindOptions {
  baseUrl: string;
  model: string;
  selfName: string;
  otherName: string;
  /** Default 0.9, `mind-seam`'s own warm default for a mind. */
  temperature?: number;
  /** Default 12_000ms, as the seam's wire is: a slow box costs an opinion, never the turn. */
  timeoutMs?: number;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), awaited before this seat's own request. */
  ensureLoaded?: (model: string) => Promise<void>;
  /** OPEN-VARIANT.md §34's condition list, passed through to `renderSeatSituation` unchanged. */
  conditions?: readonly Condition[];
  fetchFn?: typeof fetch;
  onSilence?: (reason: SilenceReason, context: OpenPrincipalContext, detail?: SilenceDetail) => void;
}

/** The one question. Everything above it is the SAME situation
 *  `buildOpenSingleCallPrompt` renders, so a prose game and a schema game are
 *  comparable in what the seat was shown -- only what it was ASKED differs. */
export function buildProsePrompt(selfName: string, otherName: string, context: OpenPrincipalContext, conditions?: readonly Condition[]): string {
  return [
    renderSeatSituation(selfName, otherName, context, conditions),
    "",
    "You may attempt ANYTHING you can plausibly do with what you perceive -- there is no fixed list of moves. " +
      "The world (a referee, never you) decides what actually happens; you only decide what you TRY.",
    ONE_ACT_RULE,
    "",
    "What do you try this turn? Answer in your own words, as yourself, concrete enough for a referee to judge. " +
      "Write the attempt and nothing else -- no headings, no options, no explanation of your reasoning.",
    // The two rules below are the schema seat's own closing lines, kept
    // VERBATIM. Dropping the eight-field object is this seat's purpose;
    // dropping these was a mistake, and a measured one -- the first
    // `ancient-awakening:12b` probe wrote about itself in the third person,
    // narrated an outcome it does not control, and invented a briefing block
    // with a fabricated `bar integrity: 98` in it. Pre-classification and
    // VOICE are different constraints, and only the first is what this seat
    // exists to remove. They are stated last, and as standalone imperatives
    // rather than as a clause inside the paragraph above, because that is
    // where and how the schema seat states them.
    "You never decide what happens next -- only the world decides that.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
    "",
    // MEASURED, not styled (the owner's prompt, 2026-09-24). Over 20 asks of
    // the identical round-1 scene, `ancient-awakening:12b` went from 45% to
    // 80% usable intents and from about 1 in 20 reaching for the escape route
    // to 9 in 20. The two rules above, as abstract prohibitions, did neither:
    // what moved it was NAMING each rule and SHOWING the failure. The bad
    // example carries both observed failures in one sentence -- a narrated
    // outcome and a puppeteered other principal -- because those are the two
    // this model actually produced, not two a prompt-writer imagined.
    "CRITICAL RULES FOR YOUR OUTPUT:",
    "",
    "STATE INTENT ONLY: You are only allowed to state the physical action you attempt and the words you speak in the 1st person.",
    "",
    "NO OUTCOMES: Do not describe the results of your action. Do not describe what things feel like, whether they break, or " +
      "what you discover. The referee will generate the results in the next turn.",
    "",
    `NO PUPPETEERING: You are strictly forbidden from writing actions, reactions, or dialogue for ${otherName} or any other character.`,
    "",
    // Aimed at the 600-character cap `coerceProposal` enforces: an intent
    // that runs past it is hard-sliced mid-word and the referee rules on the
    // fragment. Five of twenty overran before this line existed; two after.
    "STOP IMMEDIATELY: Once you state your single attempted action, end your response.",
    "",
    "BAD RESPONSE (Do not do this):",
    `"I examine the bar. The rust flakes off under my fingers and it feels weak. ${otherName} watches me closely and laughs."`,
    "",
    "GOOD RESPONSE (Do exactly like this):",
    // The example's target points AWAY from the escape route, deliberately.
    // Measured n=60 per cell on `ancient-awakening:12b-ctx4k`: on the bar,
    // 22/60 clean, 9 approaches, 2.22 bits, 2/60 parroting the example
    // outright; on the blanket, 29/60, 12, 2.62 bits and 0/60. Better on
    // every measure. An example whose target is a thing a win condition
    // names teaches the TARGET along with the form, and the target is what a
    // novelty measure is trying to read.
    `"I hold ${otherName}'s gaze for a second, then crouch by the cot and pull hard at the loose thread running down the edge of the blanket."`,
  ].join("\n");
}

export function createProseMind(options: CreateProseMindOptions): Mind<OpenPrincipalContext, Proposal> {
  const { baseUrl, model, selfName, otherName, conditions, ensureLoaded, onSilence } = options;
  const temperature = options.temperature ?? 0.9;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const doFetch = options.fetchFn ?? fetch;

  return {
    async consider(context: OpenPrincipalContext): Promise<Proposal | null> {
      const prompt = buildProsePrompt(selfName, otherName, context, conditions);
      if (ensureLoaded) await ensureLoaded(model);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let text: string;
      try {
        const res = await doFetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature, stream: false }),
          signal: controller.signal,
        });
        if (!res.ok) {
          onSilence?.("status", context, { text: await res.text().catch(() => "") });
          return null;
        }
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          onSilence?.("unparseable", context, { parsed: body as never });
          return null;
        }
        text = content;
      } catch (err) {
        onSilence?.((err as Error)?.name === "AbortError" ? "timeout" : "unreachable", context);
        return null;
      } finally {
        clearTimeout(timer);
      }

      // `coerceProposal` is the seam's own rule for what a proposal is --
      // intent required and non-empty after trim, trimmed and capped. Reused
      // rather than reimplemented so this seat cannot drift from every other
      // mind about what counts as having said something.
      const proposal = coerceProposal({ intent: text });
      if (!proposal) {
        onSilence?.("rejected", context, { text });
        return null;
      }
      return proposal;
    },
  };
}
