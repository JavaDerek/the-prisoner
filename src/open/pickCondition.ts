export type PickCondition = { readonly force: (roundN: number) => boolean; readonly onReplan?: boolean; readonly regenerate?: boolean };

/** The pick condition's checkpoint switch. `PRISONER_PICK=even` forces every
 *  even-numbered prisoner turn (OPEN-VARIANT.md §21); `replan` checks each new
 *  plan's first step instead and forces no turn by number (§23); unset is the
 *  baseline. Anything else stops the run rather than guessing. */
export function readPickCondition(raw: string | undefined): PickCondition | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "even") return { force: (roundN) => roundN % 2 === 0 };
  if (raw === "replan") return { force: () => false, onReplan: true };
  // OPEN-VARIANT.md §36: as `even`, and a forced turn with nothing unseen re-asks the mind once.
  if (raw === "even-regenerate") return { force: (roundN) => roundN % 2 === 0, regenerate: true };
  throw new Error(`PRISONER_PICK: unrecognised value ${JSON.stringify(raw)} -- must be "even", "even-regenerate", "replan" or unset`);
}
