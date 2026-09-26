import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/**
 * Item 10 (owner's finding: the checkpoint's own scenario header hard-coded
 * "mind-seam@0.1.0" long after the dependency moved to 0.2.0). Reads the
 * real pinned version straight out of this repository's own package.json
 * -- the same file `npm install --save-exact` writes -- so the transcript
 * can never again say a version this repository is not actually running.
 */
export function pinnedDependencyVersion(name: string): string {
  const pkgPath = join(moduleDir, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { dependencies?: Record<string, string> };
  const version = pkg.dependencies?.[name];
  if (!version) {
    throw new Error(`packageInfo: '${name}' is not a declared dependency in package.json`);
  }
  return version;
}

/**
 * This repository's OWN version (`docs/HUMAN-INTENTS-DESIGN.md` §8.2's
 * report row: "run-dmcp and game versions"), read straight out of the same
 * `package.json` `pinnedDependencyVersion` already reads -- never a second,
 * hand-copied literal that could drift the moment this package is bumped and
 * one of the two copies is forgotten (item 10's own lesson, applied to this
 * package instead of a dependency's).
 */
export function ownPackageVersion(): string {
  const pkgPath = join(moduleDir, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
  if (!pkg.version) {
    throw new Error("packageInfo: this package's own package.json has no 'version' field");
  }
  return pkg.version;
}
