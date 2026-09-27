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
});
