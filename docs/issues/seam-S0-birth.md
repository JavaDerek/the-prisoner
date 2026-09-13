title: Repository birth — the types, assertInert, the two stubs, and three guards, before any wire exists

DESIGN §2.2, §3, Appendix C. A fifth repository beside the four root `CLAUDE.md` lists:
`~/rpg/mind-seam`, `JavaDerek/mind-seam`, npm `mind-seam`.

## Deliverables

- `git init`; `CLAUDE.md` from DESIGN Appendix C; CI on `lint`, `typecheck`, `test:run`, `build`.
  TypeScript, vitest, double quotes (match the neighbours). `release.yml` copied from `run-dmcp`
  (tag-triggered, npm trusted publisher, no token) — the one-time publisher registration on
  npmjs.com is a human step and is named in the file's header.
- `package.json` with `"dependencies": {}` and two exports: `.` and `./conformance` (the second
  lands in S2; declare it now so the shape is settled).
- `src/types.ts`: `Inert`, `InertRecord`, `Proposal`, `Mind<C, P>`, `assertInert()`.
- `src/minds.ts`: `SILENT_MIND`, `scriptedMind()` (a function script captures the context it was
  handed and runs `assertInert` on it).
- Three guards, each modelled on `run-dmcp/src/__tests__/engineVocabulary.test.ts` (tracked and
  untracked files, each forbidden entry carrying its *why*):
  1. **zero dependencies** — reads `package.json` and asserts `dependencies` is `{}`;
  2. **vocabulary** — both consumers' words forbidden (seat, rival, archetype, prestige, DEFCON,
     flashpoint, accord; warden, prisoner, cell, bar, file, custody, spoon); principal, context,
     proposal, intent, line, mind, briefing explicitly *not* forbidden;
  3. **no network outside `src/wire/`** — `fetch(`, `https?://`, `baseUrl`, `process.env`,
     `Authorization`, `api-key` forbidden in every other file.

## Tests first, red before any of the above compiles

- `assertInert` throws, naming the path, for: a function value; an accessor property (`get x()`);
  a class instance; a `Map`; a symbol-keyed property; a nested one of each three levels down. It
  passes for strings, numbers, booleans, null, undefined, arrays and plain objects of those,
  including `Object.create(null)`.
- A `type` alias with a `db: Database`-shaped field does not satisfy `C extends InertRecord` —
  a `// @ts-expect-error` test, so the compile-time half is pinned too.
- `SILENT_MIND` is assignable to `Mind<{ a: string }, Proposal>` and to
  `Mind<{ b: readonly string[] }, Proposal & { c?: string }>` — one constant, every caller.
- `scriptedMind` returns a fixed proposal twice without consuming it; returns `null` for `null`;
  a function script sees the context it was given; a function script declines with `null`.
- Each guard validated by planting a violation and watching it go red before it is trusted.
