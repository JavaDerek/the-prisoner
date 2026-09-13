title: Custody through the protocol — SEARCH, CONCEAL, CONFISCATE

Blocked on `run-dmcp` E3 (a non-numeric intended change). Bump the exact pin when it publishes.

## Scope

`SEARCH` (warden; raises suspicion, may find a concealed item and confiscate it — an `owner_id` set
inside the resolution), `CONCEAL` (prisoner; sets `concealed_by` on an owned item), `CONFISCATE` as
the custody leg of a successful search. `cut` becomes a `declare-irreversible` leg of `FILE`'s own
resolution, and the referee's after-the-fact declaration from P1 is deleted.

## Tests first

- Conformance check 6 for a custody move (`actionableProposal` may switch to `CONCEAL` here): exactly one `resolution.recorded` event; the item's `owner_id`
  fact interval opened by that event.
- A search whose custody leg lands with a numeric leg that violates `bounded`: both roll back.
- A confiscation the prisoner's active step `expects` not to have happened (the file still owned by
  the prisoner) becomes `failed` with the hop naming the search.
- No call to `transferItem` anywhere outside `src/mechanics/` — a syntactic import scan, the same
  device the engine's boundary tests use.
