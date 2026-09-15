import type { OpenMind } from "./mind.js";

/**
 * OPEN-VARIANT.md §26: whether escape can be done at all is a question about
 * the world, the referee and the prisoner's reasoning; a competent warden is
 * noise in it. `PRISONER_WARDEN=passive` replaces the warden's mind with one
 * that attempts nothing, every turn: a silent half-round, so no model call and
 * no referee call. Everything else is unchanged, the prisoner's briefing
 * included. Unset is the model warden; anything else stops the run.
 */
export type WardenMode = "model" | "passive";

export function readWardenMode(raw: string | undefined): WardenMode {
  if (raw === undefined || raw === "") return "model";
  if (raw === "passive") return "passive";
  throw new Error(`PRISONER_WARDEN: unrecognised value ${JSON.stringify(raw)} -- must be "passive" or unset`);
}

export function passiveWardenMind(): OpenMind {
  return { consider: async () => null };
}
