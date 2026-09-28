import { describe, it, expect } from "vitest";
import { PRISONER_PRONOUNS, WARDEN_PRONOUNS, pronounsFor, PRISONER_MOTIVE, WARDEN_NAME } from "../scenario.js";

/**
 * The-prisoner#34: one declaration per principal (docs/ARCHITECTURE.md discrepancy 8), the
 * coordinator's decision on the owner's behalf -- Croft is "he/him/his/himself", Voss is
 * "she/her/her/herself". Every other module builds its sentences from these two constants; this
 * pins the declaration itself.
 */
describe("scenario.ts: one pronoun set per principal (the-prisoner#34)", () => {
  it("declares Mara Voss she/her/her/herself and Warden Croft he/him/his/himself", () => {
    expect(PRISONER_PRONOUNS).toEqual({ subject: "she", object: "her", possessive: "her", reflexive: "herself" });
    expect(WARDEN_PRONOUNS).toEqual({ subject: "he", object: "him", possessive: "his", reflexive: "himself" });
  });

  it("pronounsFor fetches by principal id", () => {
    expect(pronounsFor("prisoner")).toBe(PRISONER_PRONOUNS);
    expect(pronounsFor("warden")).toBe(WARDEN_PRONOUNS);
  });

  it("PRISONER_MOTIVE builds Croft's pronoun from WARDEN_PRONOUNS, never a literal 'they'", () => {
    expect(PRISONER_MOTIVE).toContain(`make sure ${WARDEN_PRONOUNS.subject} never locks a door on you again`);
    expect(PRISONER_MOTIVE).toContain(WARDEN_NAME);
    expect(PRISONER_MOTIVE.toLowerCase()).not.toContain("they");
  });
});
