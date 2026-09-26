<!-- A COMMENT on run-dmcp #43, not a new issue. NOT YET POSTED -- see the
     honesty note at the top before anyone does. Drafted from
     docs/HUMAN-INTENTS-DESIGN.md §8 (D12) and checkpoints/2026-09-26-human-intents/
     (D11), commits 876e87a and 45d2cf6. -->

**Read this paragraph before posting it.** The design behind this comment says the report
shape should go over the wall after one *labelled audit of a game's own rows* — a caller
that has actually read a row back and called it right, wrong, or a gap it cannot yet fill.
What ran tonight is that audit, but against a **replayed corpus** (95 requests rebuilt from
recorded turns and paraphrases, one process, thinking off, never a live session), not
against a person's own rows from a live game with another principal actually answering
back. The first live game meant to carry this — a second human-played session — has not
been played yet. So: this comment is ready, and I think the corpus below is informative
enough to post now, but the more conservative reading is to wait for that live game's own
rows to be labelled first. Your call; I'd rather flag the gap than paper over it.

## What we built

A row per human-played turn, written by the caller, carrying:

- the actor's intent text, verbatim;
- the turn reader's own request for that turn (the questions asked, their answer keys, the
  sources offered) and its own result (every question's final answer key and its citation);
- **separately**, whether each citation was checked against the *specific* source that
  question required — more on why this is a caller-side field below;
- the outcome text the actor was actually shown (the caller's own rendering of the ruling
  into fiction, not the keys themselves);
- how the row was captured: refused outright, a target that fell to its safe default while
  the accompanying effect was cited (a structural "verb parsed, noun missing" signal, read
  from the reader's own bookkeeping, never from parsing the ruling's English), or an
  actor-initiated retry — three buckets where the issue's own text proposed two, because the
  middle one turned out to be common enough, and detectable structurally, to need its own
  name;
- one field this issue didn't ask for and we added anyway: which version of the caller's
  *own outcome wording* the actor had been reading when the row was produced. We changed
  that wording mid-project, on purpose, and a row is not comparable across the change unless
  something says which side of it the actor was on. This is squarely caller-side — the
  engine has no opinion about how a consumer narrates a ruling — but it is the kind of field
  a report collector needs a place for, and it seemed worth naming here in case anyone
  else's shape needs the same slot.
- engine and caller package versions, plus the caller's own code revision;
- a label field, left empty by the code that writes the row, for a person to fill in later
  from reading it.

## Which of these are already `createTurnReader`'s own `ReaderResult`, and which are ours

Worth stating plainly, because the two are easy to blur together in one "ruling" object.

**Already yours, unmodified:** every question's final answer key, whether it came from a
transport or a safe default, and its citation (source id and quote) when it has one. That's
`ReaderResult.answers` exactly as `createTurnReader` returns it — nothing here needed
building.

**Ours:** whether a given citation's source id matches the *specific* source that particular
question was declared to require. `ReaderResult` knows a citation matched *some* declared
source (that's the "quote-not-in-source" rejection you already enforce); it has no way to
know, and shouldn't, that our second question's answer was only supposed to be cited against
the target object's own description and not against the actor's original words. That
association — which question needs which source — is a fact about our own question set, not
yours, so the "verified" flag in our row is entirely caller-side bookkeeping layered on top
of a citation you already gave us for free.

## The open question: version the answer-key vocabulary?

First data point, and it argues against adding this as *engine* scope, for a reason the
audit surfaced by accident rather than by design.

Every report row already carries the full request it was answered against —
`ReaderQuestion.answerKeys` included — so a row is self-describing about the vocabulary in
force for that one call without any separate version number. That much argues a version
field is redundant.

But the audit also found the sharper reason a bare version number wouldn't have been enough
even if we'd added one: three separate rows this pass had to be hand-corrected, before
scoring, because our own scoring notes had the wrong idea of what a key actually meant --
a property our own current code never reads at all for one effect (so two differently-keyed
answers are mechanically identical), a property we expected on one object that it turns out
was never declared on it in the first place, and two nominally different target objects whose
effects resolve through the very same underlying resource. None of the three is a changed
key STRING; every one is our own bookkeeping about what a still-unchanged string actually
means coming apart from the code. A version number keyed to "which set of key strings
exists" would have read "unchanged" against all three, and caught none of them. What actually
caught them was a person re-reading the current code path against the recorded answer. That's
a caller-side audit discipline, not something a version counter attached to the request could
do for us.

So: no, we would not ask the engine to version this. The request already carries what
vocabulary was in force per call, which is the useful half of "versioning," and the
half that actually would have helped — catching a key's *meaning* drifting under an
unchanged name — is a fact about our own code, not about the wire format, and no version
number stamped on the request would have surfaced it either.

## The first audit (D11), tonight

95 requests, built fresh against the live scenario (never a recorded request), one process,
thinking off, zero transport errors. Two populations:

- **70 terse, method-first paraphrases** of an existing, previously-scored set of
  model-written intents — deliberately clipped and instrumental in phrasing ("press it at the
  base again," not "I want to weaken the fastening holding the way out shut"), to see whether the
  reader that scored well against explicit intents holds up against the compressed phrasing a
  time-pressed actor actually reaches for.
- **25 real, human-typed rows** pulled from actual play (including four rows aimed at two
  object descriptions flagged in an earlier audit as accidentally sharing a word with an
  unrelated declared property, to see whether either bait actually fired).

Results: **11 of 70 (15.7%) of the paraphrase set misread** — the reader's own answer
differed from the correct one on a target or effect that already has a home in the world,
not a case of the world lacking a place to put the actor's meaning. That is above the
threshold we set before running, so by our own pre-registered rule this counts as a genuine finding: the
reader we'd measured at high sensitivity against explicit, spelled-out intents reads
measurably worse against terse, compressed phrasing. The real-human population's own
not-misread rate (84%, 21 of 25) lands within a point of the paraphrase population's (84.3%),
which is itself informative: what breaks the reader in this corpus is terseness and
instrumental phrasing in general, not "a person wrote it" specifically.

The one finding worth flagging here specifically, because it isn't a reading problem at
all: **9 of the 70 paraphrase rows landed on the wrong specific instance among several
structurally identical objects the world had derived over the course of one game** (a
mechanic that lets an actor make a new thing from an existing one, applied repeatedly,
produces several successors with byte-identical descriptions). A terse reference to "the
[thing]" has no textual basis to prefer the fourth one made over the first — every
candidate's description supports the citation equally, so this scores as neither a reading
miss nor a missing mechanism, but a third thing: the world modelled enough copies of a
thing to make one of them individually unaddressable by name. That's the single largest
contributor to a secondary band's own failure (9 of 18 rows scored this way), and it isn't
anywhere in the caller's own worklist yet — worth a line here because "the reader answered
correctly against an ambiguous reference" is exactly the kind of thing a raw refusal count,
or even a well-labelled misread/unmodelled split, would never surface on its own.

Full per-row detail lives in our own repository; I've kept this comment to the counts and the
two findings that seemed likely to matter to anyone building the collector this issue
describes.
