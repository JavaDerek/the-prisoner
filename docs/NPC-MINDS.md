# NPC minds — what this game takes from the game-independent work

The game-independent NPC-mind architecture (open, closed and mixed worlds; the measured findings; the
measuring method) is no longer kept in this repository. It moved on 2026-10-17 to a separate home that
belongs to no game. What The Prisoner itself needs from it:

- **This is the mixed world:** an open physical cell *and* an opponent. The intended mind proposes a few
  candidate acts, has the referee rule each one inside a rolled-back probe, and chooses among the ruled
  candidates against its belief about the warden. Not built yet, and deliberately not first: the owner
  decided on 2026-10-16 to prove the open-world loop on generic puzzles, with a cloud referee, before this game.
- **The world does not wait.** Every attempt here is a real move the warden answers, so retries belong in
  imagination (a probe), not in the cell, and the number to measure is first-try quality.
- **Unlisted is not impossible** (#16, the heart attack): an act no mechanic lists still happens, and may get a
  bounded improvised ruling on a declared soft value (`PRISONER_IMPROVISE=suspicion`); values that decide escape
  are never improvisable. run-dmcp's `docs/AUTHORING-GUIDE.md` carries the lesson in neutral words.
- **The judge must be stronger than what it judges:** a measured NPC result needs a referee stronger than the
  NPC, which is why `checkpoints/2026-10-16-improvise-suspicion/PREDICTION-2.md` (local referee) was not run.
