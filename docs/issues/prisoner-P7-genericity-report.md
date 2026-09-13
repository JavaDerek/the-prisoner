title: The genericity report — what the second caller proved through the shared suite, and what it found

A document, not code, appended to `docs/DESIGN.md` as a dated section.

- Which of the six conformance checks went green at which P-step, against a five-field context
  and a three-field proposal, and whether any check needed a change to the *package* to pass here.
  The prediction is "none" — record the actual. A package change needed by this caller and not by
  brink is the finding; a package change needed by both is a bug in S2.
- What #18 was told after P2, with the numbers, and what the engine decided.
- Whether E3 was re-filed at P3 as drafted, what it changed in the engine, and whether the
  "declare-irreversible inside the resolution" half was taken.
- Whether option (A) in DESIGN §7.5 — classify the intent with the engine's turn reader — was
  needed because the local model could not hold both jobs in one answer.
- How often the loudness fired in real play, and with which `SilenceReason`.
- Anything brink's migration (#106) should adopt from this caller's harness, if its harness turned
  out to be the clearer of the two.
