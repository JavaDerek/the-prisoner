import type { Resolver } from "run-dmcp";
import type { OpenWorld } from "./world.js";
import type { Referee } from "./referee.js";
import type { ElaborationReferee } from "./elaborationReferee.js";
import type { OpenMind } from "./mind.js";
import { runOpenHalfRound, type OpenHalfRoundResult, type KnownApproach } from "./loop.js";
import { seenAttempts } from "./precedent.js";
import type { PickCondition } from "./pickCondition.js";
import { checkOpenGameEnd, type OpenGameEnd } from "./gameEnd.js";
import { buildOpenContext, type OpenNews, type PresenceMode } from "./briefing.js";
import { renderOwnOutcome, renderForOther } from "./perception.js";
import { seedInitialBeliefs, type Principal } from "../ledger/beliefs.js";
import { TIME_DECAY_AMOUNT } from "../world/mechanics.js";
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
  /** OPEN-VARIANT.md §55 (issue #22, gaps 1 and 2). Default `"off"`. */
  presenceMode?: PresenceMode;
  /** WORLD-ELABORATION-DESIGN.md §4.1, §9 row P1b. Absent under
   *  `PRISONER_ELABORATE=off` (the default) -- passed through to every
   *  half-round unchanged, never rebuilt per round. */
  elaborationReferee?: ElaborationReferee;
}): Promise<OpenGameResult> {
  const { openWorld, resolver, referee, rounds } = params;
  const presenceMode = params.presenceMode ?? "off";
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

      const news: OpenNews = { ...inbox[principal], standing: params.precedent?.[principal], ...(plans[principal] ? { plan: plans[principal] } : {}) };
      inbox[principal] = { fromOther: [] };
      const context = buildOpenContext(openWorld, principal, t, n, rounds, news, presenceMode);

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
        ...(params.precedent ? { knownApproaches: params.precedent.known } : {}),
        ...(principal === "prisoner" && params.pick?.force(n) ? { forcePick: { seen: [...(params.precedent?.known ?? []).map((k) => k.text), ...seenAttempts(halves)], ...(params.pick.regenerate ? { regenerate: true } : {}) } } : {}),
        ...(principal === "prisoner" && params.pick?.onReplan
          ? { replanPick: { seen: [...(params.precedent?.known ?? []).map((k) => k.text), ...seenAttempts(halves)], hadPlan: plans.prisoner !== undefined } }
          : {}),
      });
      halves.push(half);
      if (half.proposal?.plan) plans[principal] = half.proposal.plan;

      const ownOutcome = renderOwnOutcome(half);
      if (ownOutcome) inbox[principal].ownOutcome = ownOutcome;
      inbox[other].fromOther.push(...renderForOther(half));

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
