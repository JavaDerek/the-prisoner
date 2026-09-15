export type PickCondition = { readonly force: (roundN: number) => boolean; readonly onReplan?: boolean };

/** The pick condition's checkpoint switch. `PRISONER_PICK=even` forces every
 *  even-numbered prisoner turn (OPEN-VARIANT.md §21); `replan` checks each new
 *  plan's first step instead and forces no turn by number (§23); unset is the
 *  baseline. Anything else stops the run rather than guessing. */
export function readPickCondition(raw: string | undefined): PickCondition | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "even") return { force: (roundN) => roundN % 2 === 0 };
  if (raw === "replan") return { force: () => false, onReplan: true };
  throw new Error(`PRISONER_PICK: unrecognised value ${JSON.stringify(raw)} -- must be "even", "replan" or unset`);
}
