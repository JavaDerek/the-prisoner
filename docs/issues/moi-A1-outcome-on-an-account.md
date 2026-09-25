title: An `Account` records what was tried, never how it fared — so a ledger cannot answer the second half of "what has been tried and how did it go"

**Written in the package's own neutral vocabulary**, per `docs/issues/README.md`'s standing rule: no
caller's words appear below, because this text has to be able to sit in that tree.

## What exists

The precedent ledger records, per account: the text of an attempt, its actor, its observer, and the
episode it belongs to. `precedentLines` renders those accounts back to an agent as standing knowledge.
That is a faithful answer to **"what has been tried"**.

## What does not

Nothing on an `Account` says **what happened next**. An agent reading the ledger cannot distinguish an
attempt that was tried once and worked from one tried five times and never moved anything. Both render
as the same line. An agent asked to choose among approaches on the strength of the ledger is therefore
choosing on familiarity alone, which is the opposite of what a precedent is for.

## Why it is filed rather than built

The admission test is the package's own — **generic, with at least one real caller** — and the honest
position today is that the caller is *prospective*: a pre-episode commitment step
(`the-prisoner`'s `docs/STRATEGY-DESIGN.md` §3.6, D4) is designed against this field and would read it
first, but it is not built and has not been measured. `mother-of-invention#2` and the memory note
`minds-decline-new-affordances` are the reason that matters here rather than being pedantry: three
mechanisms built in a day were each reached for by a person within four rounds and by no model at all.
An outcome field added before a caller measurably reaches for it is the fourth.

## The shape, when it is built

- `outcome` on `Account`, **optional**, so every existing ledger stays readable and no caller is broken.
- Written by `recordGame` (or whatever a caller's equivalent is) **after** an episode ends, never during
  one. A ledger that grows inside a batch turns N independent samples into one N-step trajectory, which
  destroys every count computed over it — see `STRATEGY-DESIGN.md` §4 for that argument in full.
- The value is **keyed, not prose**: whatever the caller's referee already answers is the vocabulary, so
  the package judges no meaning and compares no text to any text.
- A batch reads **one frozen snapshot**, identical for every episode in it. Cross-batch learning is what
  a snapshot is for; cross-episode learning inside a batch is the bug.

## The test that should come with it

An account written with no outcome renders byte-identically to how it renders today. That is the
guard that makes this additive, and it should be written before the field exists.
