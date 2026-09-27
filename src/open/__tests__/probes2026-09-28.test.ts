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
  const { stdout } = await run(TSX, [join(REPO, script), ...argv], { cwd: REPO, env: cleanEnv(), maxBuffer: 64 * 1024 * 1024 });
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
      expect(out).toContain("If Warden Croft stands in a way out, and Warden Croft is on her feet, and Warden Croft can see, then Mara Voss cannot leave through it.");
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
});
