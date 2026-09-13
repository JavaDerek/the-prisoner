<!-- A COMMENT on run-dmcp #30, not a new issue. -->

A real caller for the hop this issue records has arrived, and it is the adversarial one §5.2c was
written for.

A consumer with two principals in one location — one human, one model-driven — proposes through
`resolver.resolve()` from both sides, and stores every refusal's `Contradiction[]` verbatim as the
memory of *why a step failed*. That memory is rendered back into the model-driven principal's context
next round. With the hop derived, that memory can read "refused, reason unknown" — the
check-that-cannot-be-argued-with §5.2c names.

The consumer tolerates `null` and tests that path, so this is a dependency rather than a blocker. But
it is the first caller whose product is worse in proportion to how often the hop is null, and the
change described above is already specified down to its test list. Requesting it land as 0.6.0 before
that consumer pins.
