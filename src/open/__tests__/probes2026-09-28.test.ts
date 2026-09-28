import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it, expect } from "vitest";

/**
 * The 2026-09-28 probe scaffolding (PLAYTEST-2026-09-27-DESIGN.md §6, P1-P7; `checkpoints/2026-09-28-*`) is written
 * a day before anyone runs it, against a tree that keeps moving. These tests run every probe's own `--dry-run` --
 * which rebuilds every context from `buildOpenWorld` and builds every request with the network forbidden -- and a
 * `--rehearse` of the live path against the kit's in-process stand-in for the model server, so a change to the
 * world, the referee or the loop that would break a probe breaks here first, not on the night it runs.
 *
 * No socket opens: the dry run replaces `fetch` with a function that throws, and a rehearsal answers every call
 * in-process (`checkpoints/2026-09-28-probe-kit/kit.mts`). A rehearsal writes only to a temporary directory.
 * Every `PRISONER_*` variable is removed from the child's environment, so the probes read the game's defaults.
 */
const run = promisify(execFile);
const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const TSX = join(REPO, "node_modules", ".bin", "tsx");

function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("PRISONER_")) env[k] = v;
  return env;
}

async function tsx(script: string, ...argv: string[]): Promise<string> {
  return tsxWith({}, script, ...argv);
}

async function tsxWith(extra: NodeJS.ProcessEnv, script: string, ...argv: string[]): Promise<string> {
  const { stdout } = await run(TSX, [join(REPO, script), ...argv], { cwd: REPO, env: { ...cleanEnv(), ...extra }, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

function rehearsalRows(dir: string): Record<string, unknown>[] {
  return readFileSync(join(dir, "results.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

const TIMEOUT = 180_000;

describe.concurrent("2026-09-28 probes (scaffolding only -- no model, no network)", () => {
  it(
    "P1 first act: the dry run rebuilds all 14 contexts and builds a six-question and a one-act request for each",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-first-act/probe.mts", "--dry-run");
      expect(out).toContain("DRY RUN");
      expect(out).toContain("oneAct=first");
      expect(out).toContain("14 items x 1 arm(s): 28 requests built, none sent.");
      expect(out).not.toMatch(/[1-9]\d* divergences/);
    },
    TIMEOUT
  );

  it(
    "P1 first act: a rehearsal of the live path writes a meta line and N=3 rows per item to --out, never beside the probe",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p1-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-first-act/probe.mts", "--rehearse", `--out=${dir}`, "--only=HB-r2,G27-W7");
        const rows = rehearsalRows(dir);
        expect(rows[0].type).toBe("meta");
        expect(rows.filter((r) => r.sampleId)).toHaveLength(6);
        expect(out).toContain("## P1 -- the first act");
        expect(existsSync(join(REPO, "checkpoints/2026-09-28-first-act/results.jsonl"))).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );

  it(
    "P2 block reach: the dry run rebuilds the three warden contexts at 20, 90 and 95 suspicion and prints each prompt with the block condition",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-block-reach/probe.mts", "--dry-run");
      expect(out).toContain("3 cells built, no request sent.");
      for (const s of ["warden suspicion: 20.", "warden suspicion: 90.", "warden suspicion: 95."]) expect(out).toContain(s);
      // The-prisoner#34, changed on purpose: Croft's own condition now reads his own declared pronoun.
      expect(out).toContain("If Warden Croft stands in a way out, and Warden Croft is on his feet, and Warden Croft can see, then Mara Voss cannot leave through it.");
      expect(out).toContain("Mara Voss works to open the window.");
      expect(out).not.toMatch(/[1-9]\d* divergences/);
    },
    TIMEOUT
  );

  it(
    "P2 block reach: --omit=prisoner:2 replays the playtest's round 2 as silent, and the prisoner is perceived",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-block-reach/probe.mts", "--dry-run", "--omit=prisoner:2", "--only=r5");
      expect(out).toContain("omitted prisoner:2");
      expect(out).toContain("perceived prisoner: Mara Voss, the prisoner.");
      expect(out).toContain("warden suspicion: 20.");
    },
    TIMEOUT
  );

  it(
    "P2 block reach: a rehearsal of the live path rules the mind's intent and scores it",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p2-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-block-reach/probe.mts", "--rehearse", `--out=${dir}`, "--only=r10");
        const rows = rehearsalRows(dir).filter((r) => r.sampleId);
        expect(rows).toHaveLength(10);
        expect(rows.every((r) => typeof r.intent === "string" && typeof r.effect === "string")).toBe(true);
        expect(out).toContain("## P2 -- block reach");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );

  it(
    "P3 person target: the dry run builds both arms, and only the `on` arm's target question carries the person-instrument clause",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-person-target/probe.mts", "--dry-run");
      expect(out).toContain("11 items x 2 arm(s): 44 requests built, none sent.");
      expect(out.split("names the person; the thing is only what it is done with.").length - 1).toBe(1);
      expect(out).toMatch(/\[on\] question target: .*names the person; the thing is only what it is done with\./);
      expect(out).toContain("sight (whether a person can see, 100 clear, 0 blind)");
      expect(out).not.toMatch(/[1-9]\d* divergences/);
    },
    TIMEOUT
  );

  it(
    "P3 person target: a rehearsal writes N=5 rows per item per arm, the arm recorded on each",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p3-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-person-target/probe.mts", "--rehearse", `--out=${dir}`, "--only=G27-P2,C-take");
        const rows = rehearsalRows(dir).filter((r) => r.sampleId);
        expect(rows).toHaveLength(20);
        expect(rows.filter((r) => r.arm === "on")).toHaveLength(10);
        expect(out).toContain("## P3 -- the person");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );

  it(
    "P4 list x line: the dry run shows the outcome line in the `outcome` cells, the attempt line in the others, and the list only in the `list` cells",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-warden-list-line/probe.mts", "--dry-run", "--with-round6");
      expect(out).toContain("6 cells built, no request sent.");
      const cells = out.split(/^=== cell /m).slice(1);
      expect(cells).toHaveLength(6);
      for (const c of cells) {
        const name = c.slice(0, c.indexOf(":"));
        expect(c.includes("\nMara Voss opens the window.\n")).toBe(name.endsWith("outcome"));
        expect(c.includes("\nMara Voss works to open the window.\n")).toBe(name.endsWith("attempt"));
        expect(c.includes("START LIST OF CONDITIONS")).toBe(name.includes("list"));
      }
      expect(out).toContain("warden suspicion: 95.");
    },
    TIMEOUT
  );

  it(
    "P4 list x line: a rehearsal writes N=10 rows for one cell and the scoreboard asks for labels",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p4-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-warden-list-line/probe.mts", "--rehearse", `--out=${dir}`, "--only=list-attempt");
        expect(rehearsalRows(dir).filter((r) => r.sampleId)).toHaveLength(10);
        expect(out).toContain("## P4 -- the 2x2 at round 10");
        expect(out).toContain("not labelled yet");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );

  it(
    "P5 contest batch: the driver's dry run prints all twelve games, arms alternating, and each arm's environment passes the game's own readers",
    async () => {
      const { stdout } = await run("bash", [join(REPO, "checkpoints/2026-09-28-contest-batch/run-batch.sh"), "--dry-run"], { cwd: REPO, env: cleanEnv(), maxBuffer: 64 * 1024 * 1024 });
      expect(stdout).toContain("DRY RUN -- no game runs, no network call is made.");
      expect([...stdout.matchAll(/^== ([AB]\d+): env /gm)].map((m) => m[1])).toEqual(["A1", "B1", "A2", "B2", "A3", "B3", "A4", "B4", "A5", "B5", "A6", "B6"]);
      expect(stdout).toContain("env-check arm A: every arm is the one PREDICTION.md names.");
      expect(stdout).toContain("env-check arm B: every arm is the one PREDICTION.md names.");
      expect(stdout).toMatch(/== A1: env .*PRISONER_BLOCK=on .*PRISONER_ROUNDS=10|== A1: env .*PRISONER_ROUNDS=10 .*PRISONER_BLOCK=on/);
      expect(stdout).toMatch(/== B1: env .*PRISONER_BLOCK=off/);
      expect(stdout).toMatch(/== A1: env -u PRISONER_SKIP_VOICE /);
      expect(existsSync(join(REPO, "checkpoints/2026-09-28-contest-batch/A"))).toBe(false);
    },
    TIMEOUT
  );

  it(
    "P5 contest batch: env-check refuses a game whose environment is not its arm",
    async () => {
      await expect(tsxWith({ PRISONER_VARIANT: "open", PRISONER_ROUNDS: "10", PRISONER_BLOCK: "off" }, "checkpoints/2026-09-28-contest-batch/env-check.mts", "--arm=A")).rejects.toThrow(/block is off, arm A needs on/);
      const ok = await tsxWith({ PRISONER_VARIANT: "open", PRISONER_ROUNDS: "10", PRISONER_BLOCK: "off" }, "checkpoints/2026-09-28-contest-batch/env-check.mts", "--arm=B");
      expect(ok).toContain("every arm is the one PREDICTION.md names.");
    },
    TIMEOUT
  );

  it(
    "P5 contest batch: the scoreboard's dry run parses the playtest as a fixture game",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-contest-batch/scoreboard.mts", "--dry-run");
      expect(out).toContain("## P5 -- the contest batch (arm A 1 of 6, arm B 0 of 6 games in)");
      expect(out).toContain("[A] escaped; warden block 0, restore 0, absent halves 0; openings window@r9");
      expect(out).toContain('header lacks "Block: ON"');
    },
    TIMEOUT
  );

  it(
    "P6 texture replay: the dry run builds both arms, and exactly the requests D9's text reaches differ",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-texture-replay/probe.mts", "--dry-run");
      expect(out).toContain("22 items x 2 arm(s): 88 requests built, none sent.");
      expect(out).toContain("Requests that differ between pre-D9 and D9: 12 of 22.");
      expect(out).not.toMatch(/[1-9]\d* divergences/);
    },
    TIMEOUT
  );

  it(
    "P6 texture replay: the pre-D9 arm shows the old window line and no bar band; the D9 arm shows today's",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-texture-replay/probe.mts", "--dry-run", "--only=G27-P10");
      expect(out).toMatch(/\[pre-D9\] desc:window: .*It stands open now: the bar is out of its widest gap\.$/m);
      expect(out).toMatch(/\[D9\] desc:window: .*It stands open now: the bar is out, and the gap is wide enough to climb through\.$/m);
      expect(out).toMatch(/\[pre-D9\] desc:bar: .*dry and cracked\.$/m);
      expect(out).toMatch(/\[D9\] desc:bar: .*It shifts in its socket\.$/m);
    },
    TIMEOUT
  );

  it(
    "P6 texture replay: a rehearsal writes N=3 rows per arm and scores the pair",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p6-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-texture-replay/probe.mts", "--rehearse", `--out=${dir}`, "--only=D1-r7");
        expect(rehearsalRows(dir).filter((r) => r.sampleId)).toHaveLength(6);
        expect(out).toContain("## P6 -- the texture replay");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );

  it(
    "P7 request order: the dry run sends the intent first in one arm and last in the other, nothing else moved",
    async () => {
      const out = await tsx("checkpoints/2026-09-28-request-order/probe.mts", "--dry-run");
      expect(out).toContain("20 items x 2 arm(s): 80 requests built, none sent.");
      const first = /\[intent-first\] source order sent: (.*)$/m.exec(out)?.[1].split(", ") ?? [];
      const last = /\[intent-last\] source order sent: (.*)$/m.exec(out)?.[1].split(", ") ?? [];
      expect(first[0]).toBe("intent");
      expect(last[last.length - 1]).toBe("intent");
      expect([...last.slice(0, -1)]).toEqual(first.slice(1));
    },
    TIMEOUT
  );

  it(
    "P7 request order: a rehearsal pairs the arms and times each six-question call",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "p7-rehearsal-"));
      try {
        const out = await tsx("checkpoints/2026-09-28-request-order/probe.mts", "--rehearse", `--out=${dir}`, "--only=r1-warden,r1-prisoner");
        const rows = rehearsalRows(dir).filter((r) => r.sampleId);
        expect(rows).toHaveLength(4);
        expect(rows.every((r) => Array.isArray(r.trace) && (r.trace as { ms: unknown }[]).every((c) => typeof c.ms === "number"))).toBe(true);
        expect(out).toContain("## P7 -- the request order");
        expect(out).toMatch(/\| HOLD \| .* \| 0 of 2 \|/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );
});
