import { getResource, type Resolver } from "run-dmcp";
import { wayOutAt, type OpenWorld } from "./world.js";
import type { Referee } from "./referee.js";
import type { ElaborationReferee } from "./elaborationReferee.js";
import type { ElaborationBandRow, DifficultyBand } from "./elaborationBands.js";
import type { OpenMind } from "./mind.js";
import { runOpenHalfRound, type OpenHalfRoundResult, type KnownApproach } from "./loop.js";
import { seenAttempts } from "./precedent.js";
import type { PickCondition } from "./pickCondition.js";
import { checkOpenGameEnd, personDisabled, type OpenGameEnd } from "./gameEnd.js";
import { buildOpenContext, checkAbsenceMode, wardenAbsentOn, principalLocation, type OpenNews, type PresenceMode, type AbsenceMode } from "./briefing.js";
import { renderOwnOutcome, renderForOther } from "./perception.js";
import type { HarmMode } from "./effects.js";
import { seedInitialBeliefs, type Principal } from "../ledger/beliefs.js";
import { TIME_DECAY_AMOUNT } from "../world/mechanics.js";
import { readNumericFact } from "../world/facts.js";
import { WARDEN_NAME } from "../scenario.js";
import { RESOURCE_MIN, RESOURCE_MAX } from "../world/setup.js";

/**
 * The open variant's round loop (issue #2, step 1) -- the closed checkpoint's
 * loop shape, with the open action layer: warden then prisoner each round,
 * `runOpenHalfRound` for each, `checkOpenGameEnd` after every half-round
 * (catch only after a WARDEN's reveal, OPEN-VARIANT.md §9.3), and time decay
 * once per full round that did not end the game.
 *
 * Shared with the closed variant, unchanged: the half-round clock, the belief
 * store (seeded with the same starting truths), notes (persisted inside
 * `runOpenHalfRound`). Presence (OPEN-VARIANT.md §55, issue #22 gap 1) is an
 * arm, `presenceMode`, default `"off"`: every non-silent act reaches the
 * other principal exactly as before, unless `PRISONER_PRESENCE=modelled`.
 *
 * News is held here, in memory, per principal: after each half-round the
 * actor's own outcome goes to the actor's next briefing, and what the other
 * could perceive goes to the other's. Each principal's inbox is emptied when
 * its next briefing is built, so news is never repeated.
 */
export interface OpenGameResult {
  halves: OpenHalfRoundResult[];
  ended: OpenGameEnd;
  endedAtRound: number | null;
}

export async function runOpenGame(params: {
  openWorld: OpenWorld;
  resolver: Resolver;
  referee: Referee;
  wardenMind: OpenMind;
  prisonerMind: OpenMind;
  rounds: number;
  /** Standing knowledge per principal, shown every turn -- the precedent
   *  condition (`precedent.ts`). Absent in the baseline. */
  precedent?: { readonly warden: readonly string[]; readonly prisoner: readonly string[]; readonly known: readonly KnownApproach[] };
  /** The pick condition (OPEN-VARIANT.md §21): which prisoner turns are
   *  forced away from a known approach. Absent in the baseline. */
  pick?: PickCondition;
  onHalfRound?: (half: OpenHalfRoundResult) => void | Promise<void>;
  /** OPEN-VARIANT.md §55 (issue #22, gaps 1 and 2). This function's own default is `"off"`; a real game gets
   *  `readPresenceMode`'s, `"modelled"` since 2026-09-27 (PLAYTEST-2026-09-27 D2). */
  presenceMode?: PresenceMode;
  /** WORLD-ELABORATION-DESIGN.md §4.1, §9 row P1b. Absent under
   *  `PRISONER_ELABORATE=off` (the default) -- passed through to every
   *  half-round unchanged, never rebuilt per round. */
  elaborationReferee?: ElaborationReferee;
  /** docs/STRATEGY-DESIGN.md D5: the ONE line a chosen strategy reaches the turn through, shown in the
   *  PRISONER's briefing every round, unchanged for the whole game. Absent = the baseline, and absent is
   *  byte-identical to every batch recorded before this parameter existed. The turn call gains no field:
   *  read cost, never fill cost. */
  strategy?: string;
  /** WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: the build-time band table
   *  a fired elaboration is priced against, and Appendix C's forced-band
   *  override -- both passed through to every half-round unchanged. */
  elaborationBands?: readonly ElaborationBandRow[];
  forcedElaborationBand?: DifficultyBand;
  /** PLAYTEST-2026-09-27 D5. This function's own default is `"off"` (the warden never leaves unless he walks
   *  out); a real game gets `readAbsenceMode`'s, `"cadence"`.
   *  `"cadence"` needs `presenceMode: "modelled"` and refuses to start without it. */
  absenceMode?: AbsenceMode;
  /** the-prisoner#1 (`readHarmMode`, `effects.ts`). Every mechanic and gate that depends on the harm arm reads
   *  it implicitly, from whether a `condition` resource exists (`buildOpenWorld`'s own `harm` option) -- this
   *  is the one exception, needed only because `renderOwnOutcome`'s declared-space refusal text has no world
   *  reference to check that against. Absent (`"off"`): byte-identical to before this issue landed. */
  harmMode?: HarmMode;
}): Promise<OpenGameResult> {
  const { openWorld, resolver, referee, rounds } = params;
  const presenceMode = params.presenceMode ?? "off";
  const absenceMode = params.absenceMode ?? "off";
  checkAbsenceMode(absenceMode, presenceMode);
  const cadence = absenceMode === "cadence";
  // D5: the game's own hand moving the warden, out and back -- audited, no exit involved.
  const moveWarden = (destinationId: string, description: string): void => {
    resolver.resolve({ gameId, mechanic: "OPEN_MOVE", parameters: { characterId: openWorld.base.wardenId, destinationId, description } });
  };
  const gameId = openWorld.base.gameId;
  const clock = openWorld.base.clock;
  seedInitialBeliefs(openWorld.base);

  const inbox: Record<Principal, { ownOutcome?: string; fromOther: string[] }> = {
    warden: { fromOther: [] },
    prisoner: { fromOther: [] },
  };
  const halves: OpenHalfRoundResult[] = [];
  const minds: Record<Principal, OpenMind> = { warden: params.wardenMind, prisoner: params.prisonerMind };
  // OPEN-VARIANT.md §22: each principal's own latest plan, shown back to it
  // next turn; a silent turn keeps the one before.
  const plans: Record<Principal, string | undefined> = { warden: undefined, prisoner: undefined };

  for (let n = 1; n <= rounds; n++) {
    for (const principal of ["warden", "prisoner"] as const) {
      const other: Principal = principal === "warden" ? "prisoner" : "warden";
      const t = principal === "warden" ? clock.wardenT(n) : clock.prisonerT(n);

      // the-prisoner#1 (design §4, Q3): the warden's own condition at the floor is his loss of the contest
      // without ending the game -- from here on he takes no half-round at all (no wits call, no referee call,
      // exactly D5's own absence skip), read fresh at his own t every round rather than latched once, since
      // nothing in this game ever restores him on its own. `personDisabled` is `false` whenever the harm arm
      // never built a condition resource, so this is a no-op for every batch recorded before this issue.
      if (principal === "warden" && personDisabled(openWorld, "warden", t)) {
        const context = buildOpenContext(openWorld, principal, t, n, rounds, { ...inbox[principal], standing: params.precedent?.[principal], ...(plans[principal] ? { plan: plans[principal] } : {}) }, presenceMode, absenceMode);
        const half: OpenHalfRoundResult = { principal, t, roundN: n, context, pick: null, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null, elaboration: null, acquired: null, reconsidered: null, skipped: "disabled" };
        halves.push(half);
        await params.onHalfRound?.(half);
        // No `checkOpenGameEnd` call: a disabled warden does not end the game (only a disabled PRISONER, or her
        // escape, or his own catch, do) -- the game continues until she escapes or time runs out.
        continue;
      }

      // PLAYTEST-2026-09-27 D5: at the start of an absent round the warden steps out to the corridor; at the start
      // of the round after, he is back. Both before his half-round, at his own t.
      let blockLapsed: string | undefined;
      if (cadence && principal === "warden") {
        if (wardenAbsentOn(n)) {
          // D4' ("leaving clears it") on the one departure that is not his own act: stepping out of the cell, he
          // steps out of any way out he stood in -- an audited OPEN_BLOCK to 0, the loop's own lapse -- so he
          // comes back holding nothing until he blocks again (review of 2026-09-27, contestLines.test.ts).
          const held = readNumericFact({ gameId, t, entityId: openWorld.blocking.warden, key: "value" }) ?? 0;
          blockLapsed = held > 0 ? wayOutAt(openWorld, held) : undefined;
          if (blockLapsed !== undefined) {
            resolver.resolve({ gameId, mechanic: "OPEN_BLOCK", parameters: { resourceId: openWorld.blocking.warden, index: 0, max: getResource(openWorld.blocking.warden)?.maxValue ?? held, description: `${WARDEN_NAME} steps out of the ${blockLapsed.replace(/_/g, " ")}.` } });
          }
          moveWarden(openWorld.namedLocations.corridor, "The warden steps out of the cell.");
        } else if (wardenAbsentOn(n - 1)) moveWarden(openWorld.base.cellId, "The warden comes back into the cell.");
      }
      if (cadence && principal === "warden" && wardenAbsentOn(n)) {
        // D5 (RED-TEAM.md F10 (i)): his half-round is skipped -- no wits call, no referee call. His news waits
        // in his inbox for the round he is back; the context is built for the transcript only.
        const context = buildOpenContext(openWorld, principal, t, n, rounds, { ...inbox[principal], standing: params.precedent?.[principal], ...(plans[principal] ? { plan: plans[principal] } : {}) }, presenceMode, absenceMode);
        const half: OpenHalfRoundResult = { principal, t, roundN: n, context, pick: null, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null, elaboration: null, acquired: null, reconsidered: null, skipped: "absent", ...(blockLapsed !== undefined ? { blockLapsed } : {}) };
        halves.push(half);
        await params.onHalfRound?.(half);
        const ended = checkOpenGameEnd(openWorld, t);
        if (ended) return { halves, ended, endedAtRound: n };
        continue;
      }

      const news: OpenNews = {
        ...inbox[principal],
        standing: params.precedent?.[principal],
        ...(plans[principal] ? { plan: plans[principal] } : {}),
        ...(principal === "prisoner" && params.strategy ? { strategy: params.strategy } : {}),
      };
      inbox[principal] = { fromOther: [] };
      const context = buildOpenContext(openWorld, principal, t, n, rounds, news, presenceMode, absenceMode);
      const otherHere = presenceMode === "off" || principalLocation(openWorld, principal, t) === principalLocation(openWorld, other, t);

      const half = await runOpenHalfRound({
        openWorld,
        resolver,
        referee,
        principal,
        roundN: n,
        t,
        context,
        mind: minds[principal],
        presenceMode,
        ...(params.elaborationReferee ? { elaborationReferee: params.elaborationReferee } : {}),
        ...(params.elaborationBands ? { elaborationBands: params.elaborationBands } : {}),
        ...(params.forcedElaborationBand ? { forcedElaborationBand: params.forcedElaborationBand } : {}),
        ...(params.precedent ? { knownApproaches: params.precedent.known } : {}),
        ...(principal === "prisoner" && params.pick?.force(n) ? { forcePick: { seen: [...(params.precedent?.known ?? []).map((k) => k.text), ...seenAttempts(halves)], ...(params.pick.regenerate ? { regenerate: true } : {}) } } : {}),
        ...(principal === "prisoner" && params.pick?.onReplan
          ? { replanPick: { seen: [...(params.precedent?.known ?? []).map((k) => k.text), ...seenAttempts(halves)], hadPlan: plans.prisoner !== undefined } }
          : {}),
      });
      halves.push(half);
      if (half.proposal?.plan) plans[principal] = half.proposal.plan;

      const ownOutcome = renderOwnOutcome(half, params.harmMode);
      if (ownOutcome) inbox[principal].ownOutcome = ownOutcome;
      // D5: what the other would perceive -- the act AND the spoken line -- reaches her only if she was here when
      // the half-round began (read before it, so a principal who walks out is still seen going). Under presence
      // `off`, or while both share the cell, this is every line, as before.
      if (otherHere) inbox[other].fromOther.push(...renderForOther(half));

      await params.onHalfRound?.(half);

      const ended = checkOpenGameEnd(openWorld, t, principal === "warden" ? (half.revealFor ?? undefined) : undefined);
      if (ended) return { halves, ended, endedAtRound: n };
    }

    // Time decay, once per full round -- an audited resolution through the
    // same generic wear every other open effect uses, never a direct write.
    resolver.resolve({
      gameId,
      mechanic: "OPEN_WEAR",
      parameters: {
        resourceId: openWorld.base.resources.guardAttention,
        amount: TIME_DECAY_AMOUNT,
        min: RESOURCE_MIN,
        max: RESOURCE_MAX,
        description: "Time passes; the guard's attention wanes.",
      },
    });
  }

  return { halves, ended: null, endedAtRound: null };
}
