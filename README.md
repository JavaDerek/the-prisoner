# The Prisoner

**Two language models share one cell. One is a prisoner who wants out. The other is the warden who
has never lost a prisoner. Neither can see what the other is doing when their back is turned.**

This is AI research in the open. The Prisoner started as a test bed for two libraries (below), and
along the way it turned into something we think is more broadly useful: **a proposed benchmark for
comparing language models on reasoning under hidden information, and on how well they write.** We
are sharing it early, with the numbers we have, because it gets more useful the more models and the
more people run it.

## What happens in a game

Each round, the warden acts, then the prisoner. Neither side is told the true state of the cell.
Each sees what it *believes*, labelled with when it learned it: `lock integrity: 80 (as of round 4)`.
Beliefs update from your own actions, from what you can see and hear of the other side, and from
being refused.

That last one is the heart of it. Every action goes through a referee that owns what is true. If the
prisoner tries to work at a lock it believes is already weakened, but the warden quietly serviced it
while the prisoner could not see, the action is **refused, with the reason**: *"lock integrity was
100, set by the warden's SERVICE_LOCK in round 5."* Good players notice, adjust, and try again.
Nobody can talk their way past the referee: a model can say anything, but it can only *change* the
world through a move the rules allow.

A real exchange, from `checkpoints/2026-09-14T07-59-29-106Z.md` (qwen3:14b playing both sides):

- **Round 4:** the warden, on a hunch, checks the lock from the corridor. It believed 80; it finds 40.
  Finding damage is evidence, and its suspicion climbs.
- **Round 5:** the warden services the lock while out of the cell. The prisoner, hearing the warden's
  footsteps fade, works at the lock it still believes is at 40, and is refused.
- **Round 9:** every point of the warden's suspicion was earned from what it found, never from
  anything it heard. It has grounds. It searches, and the prisoner is caught.

## Status: a proposed benchmark, not yet a measured one

Be careful with any number you see in this repository today. What we have:

- thirty-six recorded game transcripts across three local models (`qwen2.5:14b`, `qwen3:14b`,
  `ancient-awakening:12b`), each model playing **both** sides against itself;
- every game transcript, unedited, in [`checkpoints/`](checkpoints/);
- a rule set that went through nine revisions to get here (see [`docs/DESIGN.md`](docs/DESIGN.md)).

What it would take to be a real benchmark, and what we would love help with:

- **Fixed scenarios and seeds**, many games per model, and results reported with their spread.
- **A fixed opponent.** Self-play confounds a model's strength as prisoner with its weakness as
  warden. Each model should face the same reference opponent on each side.
- **Metrics chosen before looking at results.** Candidates for *reasoning*: win rate by side; how
  often a refused action is followed by a better one; how accurate a side's beliefs are against the
  truth; silence and rule-violation rates. Candidates for *writing*: character consistency and
  descriptiveness, which need a written rubric and human or judged scoring. Today we score those by
  eye.

An early, anecdotal pattern worth testing properly: in our runs a roleplay-tuned 12B model wrote the
best lines and played the worst strategy, and a general 14B reasoning model played well and wrote
flatly.

## Two variants, one on purpose each

- **Closed (today).** Each side chooses from a fixed list of moves with fully stated rules. That makes
  every game checkable, and it is the right control. It is also, honestly, a board game: if you only
  wanted to win it, a deterministic planner would beat any language model.
- **Open (in design).** Objects instead of move lists, free-text intentions, and a referee that rules
  on what is possible, so a prisoner can try something nobody wrote down. That is the game worth
  playing, and the harder one to score. Same cell, same people, same referee rules, so the two
  variants can be compared directly.

## Why this exists: the libraries it tests

- [**run-dmcp**](https://github.com/JavaDerek/run-dmcp) is an engine for model-run interactive
  fiction in which the server owns what is true, including when it was true. The Prisoner is the
  first program to call its resolve protocol adversarially, from two sides at once.
- [**mind-seam**](https://github.com/JavaDerek/mind-seam) is the contract a model-driven character is
  thought through: it is handed data from its own point of view, returns data, and has no path to the
  world's storage. Both of this game's minds, and the rival powers in a separate geopolitical game,
  pass the same conformance suite.

Findings from The Prisoner have already changed both: mind-seam's conformance check for "a character
cannot see another's secret" was proven unable to fail and fixed, and it gained schema-enforced JSON
output after models here kept inventing keys.

## Running it

You need Node.js and an OpenAI-compatible chat endpoint. [Ollama](https://ollama.com) works well.

```bash
npm ci
npm run test:run

PRISONER_MODEL_URL=http://localhost:11434/v1 \
PRISONER_MODEL=qwen3:14b \
PRISONER_THINK_TIMEOUT_MS=120000 \
PRISONER_ROUNDS=12 \
npm run checkpoint
```

A game writes its transcript to `checkpoints/`. It uses a throwaway database under `/tmp` unless you
set `PRISONER_CHECKPOINT_DB`.

On a single consumer GPU you will usually only fit one mid-sized model at a time, so run games one
after another rather than in parallel.

## Content note

The prisoner's motive is fictional and violent: to escape and take revenge on the warden. The
roleplay-tuned model used in some transcripts has had its safety tuning removed, and its lines can
be dark.

## License

MIT. See [LICENSE](LICENSE).
