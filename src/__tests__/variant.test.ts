import { describe, it, expect, afterEach } from "vitest";
import { getVariant, isOpenVariant } from "../variant.js";

/**
 * The variant switch (open-variant brief, "A variant switch"):
 * `PRISONER_VARIANT=closed|open`, default `closed`. This is the whole
 * surface area of the switch -- everything else (which mind, which world,
 * which loop) branches on this one function's return value, never on a
 * second read of the environment.
 */
describe("PRISONER_VARIANT (open-variant §1)", () => {
  const original = process.env.PRISONER_VARIANT;

  afterEach(() => {
    if (original === undefined) delete process.env.PRISONER_VARIANT;
    else process.env.PRISONER_VARIANT = original;
  });

  it("defaults to 'closed' when unset", () => {
    delete process.env.PRISONER_VARIANT;
    expect(getVariant()).toBe("closed");
    expect(isOpenVariant()).toBe(false);
  });

  it("defaults to 'closed' when set to the empty string", () => {
    process.env.PRISONER_VARIANT = "";
    expect(getVariant()).toBe("closed");
  });

  it("recognises 'open'", () => {
    process.env.PRISONER_VARIANT = "open";
    expect(getVariant()).toBe("open");
    expect(isOpenVariant()).toBe(true);
  });

  it("recognises 'closed' explicitly", () => {
    process.env.PRISONER_VARIANT = "closed";
    expect(getVariant()).toBe("closed");
    expect(isOpenVariant()).toBe(false);
  });

  it("throws on an unrecognised value -- never silently falls back", () => {
    process.env.PRISONER_VARIANT = "experimental";
    expect(() => getVariant()).toThrow(/PRISONER_VARIANT/);
  });
});
