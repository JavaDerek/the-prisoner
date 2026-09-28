import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CLAUDE.md "One driver at a time, or the referee is not deterministic"
 * (OPEN-VARIANT.md §75): two processes replaying the SAME recorded request
 * simultaneously returned different rulings on 2 of 4 rows. The scorer's
 * live mode is a driver like any other checkpoint/probe run, so it takes
 * the SAME lock directory every 2026-09-28 probe and `run-batch.sh` already
 * use (`checkpoints/2026-09-28-probe-kit/kit.mts`'s own `DRIVER_LOCK`) --
 * never a second, differently-named lock, so a probe and a scorer run
 * cannot both think they are the only driver.
 */
export const DRIVER_LOCK = "/tmp/the-prisoner-one-driver.lock";

/** Takes the lock or throws naming the current holder -- `mkdir` is atomic
 *  in both node and bash, matching the kit's own mechanism exactly. Returns
 *  a release function; callers should release in a `finally`. */
export function takeDriverLock(label: string, lock: string = DRIVER_LOCK): () => void {
  try {
    mkdirSync(lock);
  } catch {
    const holder = existsSync(join(lock, "holder")) ? readFileSync(join(lock, "holder"), "utf8") : "unknown";
    throw new Error(`refereeData/lock: another driver holds ${lock} (${holder.trim()}): one driver at a time (CLAUDE.md). Remove it only if you know that driver is dead.`);
  }
  writeFileSync(join(lock, "holder"), `${label} pid ${process.pid} since ${new Date().toISOString()}\n`);
  const release = () => rmSync(lock, { recursive: true, force: true });
  process.on("exit", release);
  return release;
}
