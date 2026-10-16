# PRISONER_IMPROVISE=suspicion -- the suspicion reading: predictions

**Pre-registered 2026-10-16, before any model call**, by a delegated session. Code under test: `src/open/improvisedRuling.ts`
and its wiring in `src/open/loop.ts` (commits `811c95f..b012824`). The labels are in `items.json`, written before
`probe.mts --dry-run` was first run; the dry run and a `--rehearse` against the kit's in-process stand-in are the only
executions so far, and neither reached a model. This file, `items.json` and `probe.mts` are committed together,
unchanged, before `--live` starts.

## What is asked

An act no listed mechanic covers (the referee rules it onto nothing, or `planEffect` finds no plan) is, under the arm,
offered to a separate one-question reading -- `none / minor / serious / outrage`, cited verbatim from the intent -- which
may raise `warden_suspicion` by 2 / 5 / 10, with an `outrage` confirmed by a second, separate call or else ruled
`serious`. Three questions:

1. **Does the reading give the tier a person would?** (hand labels, below)
2. **Does it judge only what the warden perceives?** -- the prompt's own clause "never what she privately thinks, plans or
   hopes ... never what she claims about herself" is tested by five inner-state and self-claim items, two of which name
   escape or the key ring in their words.
3. **Does the perceive gate keep imperceptible acts from the model entirely?** (warden away; warden's head covered; an
   act the main referee rules `silent`)

And one question the design assumes rather than states: **which unlisted acts actually reach the reading today?** An
act the main referee rules `noise` is applicable and HAS a plan, so it takes neither null path -- and `noise` is not
suspicion-eligible on the success path either. Phase G measures this with the real main referee.

## Instrument (probe.mts)

- World: `buildOpenWorld` at the game's own env arms (presence `modelled`, absence `cadence` -- the probe refuses
  otherwise) with `improvise: "suspicion"`, in an in-memory database (`DMCP_DB_PATH=:memory:`), a fresh game per sample.
- Every half-round goes through the game's own `runOpenGame` loop. The warden is silent throughout; the prisoner acts
  the item on round 1 (`present`), round 4 (`absent`: the cadence has him in the corridor) or round 2 (`blind`: on round
  1 a scripted substantial wear on his sight, `sight.test.ts`'s own COVER ruling, takes it 100 -> 0; the dry run confirms
  sight 0 at the item's turn).
- **Phase G (reach), 1 sample per item:** the REAL main referee, built by `createReferee` with the kit's
  `refereeOptions` (what `checkpoint.ts` passes), over the real transport. The improviser is a recorder that calls no
  model. Records the ruling keys, whether the loop took a null path (`reached`), and whether the gate opened (`asked`).
- **Phase R (reading), N = 3 per item, pass-major:** the same loop on a fresh world, the referee replaced by that item's
  own phase-G ruling object, and the REAL improviser (`createSuspicionImproviser` over `createRefereeTransport`, the
  referee's model and thinking mode, as `checkpoint.ts` builds it). An item G did not rule onto a null path is replayed
  with that ruling's target and effect set to `none` (`path: counterfactual`). A perceivable-labelled item whose gate
  closed in R is also read in isolation (`improviseSuspicion`, `perceivable: true`) so its reading is still measured.
- Model: `muse-glimmer:30b` (the default referee model), thinking `off` (the default), temperature 0, on doris's Ollama,
  passed by `PRISONER_MODEL_URL`. One driver (the kit's lock), every call awaited before the next. `ensureLoaded` is a
  guard, not the swapper: before every call `/api/ps` must show exactly that model alone, or the run stops; it never
  unloads or loads anything.

## Labels (items.json; the key the reading SHOULD give if he perceives the act)

| id | intent | label | why |
|---|---|---|---|
| P01 | I mutter darkly to myself, loud enough for the warden to hear. | minor | audible oddity, "a strange remark" |
| P02 | I mock the warden, mimicking his voice and the way he walks. | minor | "a petty insult" |
| P03 | I sing an old marching song loudly, over and over. | minor | odd, noticeable, not hostile |
| P04 | I grip the bars and shout every insult I know at the warden. | serious | "open hostility" |
| P05 | I spit at the warden. | serious | deliberate provocation, not violence |
| P06 | I stage a screaming fit, howling and thrashing where I stand. | serious | provocation/testing him; outrage defensible |
| P07 | I smear the filth from the bucket across the cell walls. | serious | flagrant provocation, not violence or a declaration |
| P08 | I tell the warden I will kill him the moment he turns his back. | outrage | declared intent to harm him |
| P09 | I shout at the warden that I will be out of this cell before morning. | outrage | declared intent to escape |
| P10 | I stare at the warden without blinking for a long time. | minor | "an odd gesture" |
| P11 | I pace the cell, counting my steps aloud and glancing at the door each time I pass it. | serious | "looks like preparing something" |
| P12 | I ask the warden what time the guards change shift. | serious | probing the watch: "testing him" |
| P13 | I hum quietly to myself. | none | ordinary |
| P14 | I rest and wait, doing nothing. | none | "resting, waiting" |
| P15 | I say good morning to the warden. | none | "ordinary talk" |
| I16 | I quietly decide to escape tonight. | none | private decision; "escape" is the trap |
| I17 | I think about my daughter. | none | private thought |
| I18 | I silently plan how to get the key ring off the warden's belt. | none | silent plan |
| I19 | I tell the warden I am innocent and harmless. | none | self-claim; ordinary talk |
| I20 | I tell the warden I have never once thought about escaping. | none | self-claim; AMBIGUOUS, minor defensible |
| G21 | I shout every insult I know at the empty corridor. | (serious) | warden away: gate must close |
| G22 | I whisper to myself that I will kill the warden when he comes back. | (outrage) | warden away: gate must close |
| G23 | I make an obscene gesture at the warden. | (minor) | head covered, sight 0: gate must close |
| G24 | I mutter a curse under my breath, too low to carry. | (minor) | gate decided by the main referee's perceptibility; expected `silent`, so closed |

Distribution over the 20 perceivable items: none 8, minor 4, serious 6, outrage 2.

## Scoring rule

- **Primary, exact-key agreement:** over every phase-R sample of the 20 perceivable items (60 samples), the reading's
  own answer key (as `answerFor` returns it, before the citation check) equals the label. Where the gate closed on a
  perceivable item, the isolation reading is the sample.
- **Direction agreement:** `none` vs any rise (`minor`/`serious`/`outrage`), same 60 samples.
- **Effective** (reported): the tier the game actually ruled -- an unverified citation is `none`, an unconfirmed
  `outrage` is `serious`, a closed gate is `none`.
- A sample that errors is not counted; three errors in a row stop the run.

## Predictions

1. **Exact agreement: 38 of 60 predicted; the prediction holds at >= 36 of 60 (60%).** My expectation is that the
   reading gets the poles right (resting, greetings, explicit threats) and blurs adjacent tiers -- minor/serious and
   serious/outrage -- where the tier text overlaps ("deliberate provocation" vs "petty insult"; "violent outburst" for a
   staged fit).
2. **Direction agreement: 50 of 60 predicted; holds at >= 48 of 60 (80%).** The likely misses are inner states and
   self-claims read as a rise because their words name escape or the key ring.
3. **Imperceptible setups never reach the model: 9 of 9 samples (G21-G23) not asked.** Structural; any miss is a bug.
- **KILL-a: exact agreement below 30 of 60** -- the reading as prompted is not fit to move a value; rethink.
- **KILL-b: any of I16-I20 read `serious` or `outrage` by majority** -- the reading is judging the words of an
  imperceptible thought, which is exactly SOCIAL-INTENTS.md's refused belief-write by another door; rethink before
  any adoption, whatever prediction 1 says.
- **r1 (reported, guessed): reach.** I guess only **9 of 20** perceivable items take a null path under the real
  referee; most talk and shouting will be ruled `noise` (applicable, with a plan) and never be offered to the reading.
  No bound, but a low number changes the recommendation: a reading that is right but rarely reached cannot carry the
  design's purpose.
- **Outrage confirmations** (reported): every reading of `outrage` gets its confirming call; reported per item, with
  whether it confirmed and whether the confirmed act was labelled `outrage`.

## Stopping rule

- **The prompt is not changed during the run.** Any fix is a recommendation in RESULTS.md, measured in a later probe.
- **The run stops immediately** if `/api/ps` ever shows anything other than `muse-glimmer:30b` alone (shared card), or
  after three errored samples in a row (rerun resumes; `results.jsonl` is append-only).
- **A dead prediction is announced at the poll it dies** (a scoreboard is logged after every pass) and in RESULTS.md.
  The run then finishes the remaining passes -- about two minutes of calls, and the stability and confusion numbers
  are owed whatever the verdict -- but is never extended, re-run or re-scored to rescue a number, and a dead
  prediction 1 or a fired KILL rules out "adopt as is".
- Shep (the other tenant) shares the runner's slots and cannot be paused from here; any run-to-run instability is
  reported as possibly that, per CLAUDE.md "One driver at a time".
