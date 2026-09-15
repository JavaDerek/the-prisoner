/** The pick condition's checkpoint switch (OPEN-VARIANT.md §21):
 *  `PRISONER_PICK=even` forces every even-numbered prisoner turn; unset is the
 *  baseline. Half the turns stay free, so what the mind does unforced is still
 *  measured. Anything else stops the run rather than guessing. */
export function readPickCondition(raw: string | undefined): { readonly force: (roundN: number) => boolean } | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "even") return { force: (roundN) => roundN % 2 === 0 };
  throw new Error(`PRISONER_PICK: unrecognised value ${JSON.stringify(raw)} -- must be "even" or unset`);
}
