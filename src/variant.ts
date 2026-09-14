/**
 * The variant switch (open-variant brief, "What to build"): `PRISONER_VARIANT
 * = closed | open`, default `closed`. This is the ONLY place this
 * repository reads that environment variable -- every other module that
 * needs to know which variant is running takes it as a parameter or calls
 * this function, never `process.env.PRISONER_VARIANT` a second time, so
 * there is exactly one place a typo in the value can be caught.
 *
 * The closed variant's behaviour, tests and transcripts stay exactly as
 * they were before this module existed (`src/__tests__/variant.test.ts`
 * plus every existing closed-variant test, unmodified, proves the default
 * path is unchanged) -- this module adds a read, never a rewrite, of
 * anything closed-variant code already does.
 */
export type Variant = "closed" | "open";

const VARIANTS: readonly Variant[] = ["closed", "open"];

/** `undefined`/`""` -> `"closed"` (the documented default). Any other value
 *  that is not a member of `VARIANTS` throws -- an unrecognised variant
 *  name is a configuration mistake, never something this function guesses
 *  its way past (root CLAUDE.md hard rule 3's discipline applied to
 *  configuration: say what is, never invent a fallback that was never
 *  asked for). */
export function getVariant(): Variant {
  const raw = process.env.PRISONER_VARIANT;
  if (raw === undefined || raw === "") return "closed";
  if ((VARIANTS as readonly string[]).includes(raw)) return raw as Variant;
  throw new Error(`PRISONER_VARIANT: unrecognised value ${JSON.stringify(raw)} -- must be one of ${VARIANTS.join(", ")}`);
}

export function isOpenVariant(): boolean {
  return getVariant() === "open";
}
