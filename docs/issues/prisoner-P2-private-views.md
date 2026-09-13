title: viewFor() — each principal's view, built positively, and the measurement #18 asked for

## Scope

DESIGN §5. `viewFor(gameId, characterId)` **selects** the entities the principal can see (the cell
and its unconcealed contents; the other principal's presence; its own items including concealed
ones; its own `knows_*` facts) and renders them with `createStateRenderer` under this repo's
vocabulary. No subtraction step exists.

## Tests first

- Conformance check 4 goes green: the harness's `privateAct` has the warden record a `REPLACE_BAR`
  order whose description is the marker. "withheld" (concealed): the captured context contains it
  nowhere. "shown" (in the prisoner's view): it contains it — without that, absence proves nothing.
- A scripted mind captures its context after the warden's `REPLACE_BAR` order is
  recorded as concealed; the prisoner's `briefing` does not contain it — asserted on the object.
- A concealed item is absent from the warden's view and present in its owner's.
- A `knows_rotation_changed` fact is absent from the prisoner's view until `INSPECT` writes it; the
  renderer emits nothing for its absence (no "does not know" phrase can be produced).
- The vocabulary has an entry for every fact key the mechanics can write; `unnamed` is empty in
  every test world (the renderer's vocabulary-richness contract).

## On landing

Post to `run-dmcp` #18: the number of lines in the selection, and whether any of them subtract. The
recommendation in DESIGN §5.2 is that the engine does nothing unless that answer changes.
