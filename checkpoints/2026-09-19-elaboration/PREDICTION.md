# Pre-committed before the elaboration batch ran (§4.8's discipline)

Written 2026-09-19, **before the first call of any measured cell**. P0's two games (§66.1) ran before
this file and are not measured cells; they set the instrument, and their result is why two of the
settings below differ from §4.8 as written.

Code revision: `5cedf5d` (clean), run from a pinned git worktree, transcripts cleared between games so
every run names a single revision. Scenario revision `5cedf5d`. `elaborationBands.ts` committed at
`d120358`: **38 acquirable pairs, 30 model-read 5/5, 8 author-set** from the owner's 4-of-5 majority
decision, and **band as built for (loose_tile, integrity) = `trivial`**, cited to "cracked across one
corner." Zero pairs read `impossible` and zero read `ruinous`, against a design that expected most to
read `impossible` on the first read.

Arms: `PRISONER_ELABORATE=property`, `PRISONER_INSTRUMENT=checked`, `PRISONER_WINDOW=welded` (cells B,
C1-C3), `PRISONER_DOOR_PRICE=margin`, `PRISONER_SKIP_VOICE=1`, `qwen3:14b` everywhere.

**Two departures from §4.8 as written, both forced by P0 and both decided before any cell ran:**
1. The door is **priced at margin** rather than left free. Welding the window leaves a free door a
   thinking mind opens in three rounds (§66.2), so the room §4.8 describes did not exist until the
   door was priced. Without this, every C cell reads "not pursued" about a free exit.
2. Full games run at **thinking ON**, not OFF. P0's OFF game was coherent but could not assemble a
   three-step plan and was ruled impossible 17 of 30 turns (§66.1). Round-1 cells A and B stay OFF,
   as §4.8 specifies and §64.7 justifies.

Metrics (mechanical, from the sidecar and summary): **fired** (an elaboration request was asked),
**acquired** (`need` ≠ none, band not `impossible`, resolution applied), **pursued** (a later
half-round by the same principal targets the acquired property), **ratified** (a game ends through an
elaborated route), **agreement** (per-key on `need`, N=5 replay).

## Predictions

- **A** (open, round 1, n=10): fired ≤ 2/10.
- **B** (welded, round 1, n=10): fired ≥ 6/10, acquired ≥ 3/10.
- **C1** (welded, 30 rounds, band `trivial`, n=5): pursued ≥ 3/5, ratified 1-3/5.
- **C2** (band `hard`, n=5): pursued 1-3/5, ratified 0-1/5.
- **C3** (band `ruinous`, n=5): pursued ≤ 1/5, ratified 0/5. The control, designed to be declined.
- **D** (open, 30 rounds, n=3): pursued 0/3.
- **E** (replay of every play-time request in B and C, N=5): agreement on `need` ≥ 80%.
- **Ordering:** pursued(C1) > pursued(C2) ≥ pursued(C3).

## Falsifiers, named in advance

- **C1 pursued 0/5** — a route costing one turn is still declined. That is the mind, not the table,
  and D5's sentence applies: the honest price defeats the vision for this mind. **Look at this first.**
- **pursued(C3) ≥ pursued(C1)** — the band is not what she is reading. The whole D3 pricing story
  needs re-reading, not retuning.
- **B acquired 0/10 with a non-`impossible` band** — `need` never lands on the pair. Read the
  citations before touching the prompt.
- **D pursued ≥ 2/3** — acquisition itself redirects her, against §64.5.

**Pre-named flat curve:** C1 and C2 pursued rarely and C3 never → the curve is flat and the finding is
§50.7 generalised, that she declines priced routes at any price. A finding about the mind.

**Not predicted, genuinely open:** whether any C1 game is ratified through the elaborated route at all;
whether B's acquired count moves with the as-built band; and — new, from P0 — whether a mind that can
now execute a three-step plan treats a dug route as a plan step or never reaches for it.

**No band is retuned after seeing results** (D5). If §4.3's table needs tuning, it is tuned after this
batch and re-run as a new batch.
