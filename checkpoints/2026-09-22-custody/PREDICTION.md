# Pre-committed: the referee rules custody (2026-09-22, before any call)

`docs/CUSTODY-DESIGN.md`'s measurement step 2. **VARIANT** is what `main` builds now (`e85d9ca`): the effect question
offers `take` and `give`, and, with a person in view, says a search is `expose` on that person. **BASE** is the same
request with that wording and those two keys removed.

**Instrument.** 21 intents. 12 of batch 1's `unbuilt: custody / search` rows, each built from today's code but with its
OWN recorded perception (the wire and the persons exist there, not in a fresh world). 8 have a clear custody reading;
4 are recorded only (a confiscate-or-search, a derive-then-give, a search of the tray, keeping a thing back from the tray).
The owner's "steal the key ring" and one variant, fresh from the prisoner's seat. 7 controls, fresh from their seats,
that the new keys could pull: "take a wire out of the cot" (the word take, a derive), scooping grit, examining the
spoon, hiding the spoon, scraping the bar, lifting the tile to examine the hollow, attacking the warden. Referee
`qwen3:14b` on doris, thinking ON, N = 3, timeout 120 s.

**Predictions:**
1. VARIANT: of the 10 clear custody intents (8 batch rows + 2 key ring), at least 8 get the expected target AND
   effect in the majority (take/give on the thing, expose on the person searched).
2. Every control's majority target/effect is identical in BASE and VARIANT (7 of 7).
3. Recorded only: the 4 record rows, and what BASE did with the custody intents.

**Ship rule:** custody is already merged (the owner approved the design); this decides whether batch 2 runs on it
as is. If 1 or 2 fails, batch 2 waits and the failure goes to the owner.
