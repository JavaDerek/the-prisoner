title: The conformance suite — six executable checks any caller runs against its own context builder and its own mind; release 0.1.0

DESIGN §9. The product. Asserts with `node:assert/strict`; depends on no test framework.

## Deliverables

`src/conformance/index.ts`, exported as `mind-seam/conformance`:

- `SeamHarness<C, P>`: `fields`, `loudProposal`, `actionableProposal?`, `privateAct: "supported" | { unsupported }`, `pass(mind, { privateAct?: "shown" | "withheld" })
  → PassReport`, `wire?: { create({ baseUrl, model, fetchFn }), context }`.
- `PassReport`: `before`, `after`, `resolutions`, `privateMarker?`.
- `seamConformance(harness)`: returns six `{ name, run }` checks in the order DESIGN §9.1 lists
  them — keys enumerated and inert; nothing callable (`assertInert` over the *captured* context);
  a loud proposal moves nothing; the other principal's private act is absent **and the same act, shown, is present** (a literal
  search for the harness's own marker across every string leaf; a marker missing from the "shown"
  pass fails the check as vacuous); the wire's shape and every failure `null`
  (skipped with a named reason if `wire` is absent); state changes only where `resolutions > 0`,
  and exactly one resolution for `actionableProposal` when supplied.

## Tests first

- A **reference harness** in this repository: a toy world with one bounded counter and a
  one-function referee, no dependencies. All six checks green.
- Four **planted violations**, each a harness that differs from the reference in one line:
  - a context built with a getter → check 2 red, naming the path;
  - a `pass` that reads `loudProposal.intent` and moves the counter → checks 3 and 6 red;
  - a `wire.create` that sends an `Authorization` header → check 5 red;
  - a `pass` whose context never renders the planted act → check 4 red as *vacuous* on the "shown" pass.
- The checks are written before `seamConformance` exists, so the first red is the missing export.
- Every `run()` is idempotent: calling the suite twice against the reference harness produces
  the same result, because `pass` is required to build a fresh world.

## Release

`npm version 0.1.0 --no-git-tag-version`, commit, `git tag v0.1.0`, push the tag. The trusted
publisher registered in S0 does the rest. Both consumers then pin `0.1.0` exactly (brink M1,
The Prisoner P0), each in its own commit naming this one.
