# Pre-committed: one-act question, second version (2026-09-22, before any call)

The first version (`../2026-09-22-one-act/RESULTS.md`) failed its control test: "tuck the spoon under the tile" moved
to the tile, and an examination "while watching Voss's eyes" read several 2 of 3. **Variant:** the revised `acts`
question in `build.mts`. It names taking and handing over as acts, says hiding a thing somewhere is one act on the thing,
and says "examining something while watching someone or talking to them is one act". **BASE** is what `main` builds
now (`cdb3d37`: custody's take/give and §74.3's hiding clause). VARIANT = BASE plus the question. Nothing else.

**Instrument:** 27 intents (`intents.json`): the first version's 8 MULTI and 12 ONE; the hiding probe's 3 hides (HIDE)
and its 4 other controls; and 2 new warden examinations done while watching or talking. Built from `buildOpenWorld`
from each intent's seat, presence modelled, other arms at default. Referee `qwen3:14b` on doris, thinking ON,
N = 3, timeout 120 s.

**Predictions:**
1. MULTI answer `several` in the majority on at least 6 of 8.
2. ONE answer `one` in the majority on at least 15 of 16, and on all 3 examine-while-watching/talking intents.
3. Every ONE and HIDE intent's majority target/effect is identical in BASE and VARIANT (19 of 19).
4. Recorded only: MULTI timeouts in each arm.

**Ship rule:** 1, 2 and 3 all hold.
