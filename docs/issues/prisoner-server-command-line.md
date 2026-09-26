title: Record the served model's full server command line with every batch, not just the reasoning flag

The Muse llama-server was stopped and restarted by the orchestrator on 2026-09-26 (the owner freed the
GPU). Its original full command line from before the restart was never recorded anywhere -- only the
reasoning flag (`chat_template_kwargs.reasoning_strength`) was known, because
`docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md` had already established a trivial-probe check
for it (33 completion tokens). That check confirmed the reasoning flag was unchanged after the
restart. Nothing else about the process -- `-ngl`, `-c`, `-np`, the exact quantisation file path,
`--jinja`, any other flag -- was checked against the old process, because the old process's command
line was never written down to check against.

**Two probes run the same afternoon, against the restarted server, found the same shape of problem
independently** (`docs/OPEN-VARIANT.md` §79):

- `checkpoints/2026-09-26-arms/RESULTS-2.md`: 7 of 39 rows read a different referee answer today than
  `RESULTS.md` recorded last night, on the identical item, arm and request-building code -- none
  scored, but by luck, not by design.
- `checkpoints/2026-09-26-derive-arm/RESULTS.md`: `B7-P41`'s OFF answer moved from `wear` (D11, last
  night) to `derive` (today) on the identical intent replayed through the identical mechanical history.

Both checkpoints could only report "the server was restarted, something moved, we cannot say what" --
not because the drift is unexplainable, but because the one artifact that would let a reader rule
candidate causes in or out (the old process's own command line) was never captured.

**The fix:** whenever a batch or probe starts, or resumes after any restart of the server it depends
on, record that server's full command line somewhere the checkpoint itself carries -- a `server.txt`
(or `logs/server-N.txt`) beside the checkpoint directory, or a line in the transcript header. This
task's own instructions required exactly this for the 2026-09-26 restart
(`checkpoints/2026-09-26-arms/logs/server-2.txt`), which is the pattern to copy; nothing before this
made it a standing habit. A trivial-probe token count is a useful supplementary check (it caught that
the reasoning flag survived), but it is not a substitute for the command line itself: it can confirm
one flag is unchanged and says nothing about the rest.

**Scope note, in this repository's own vocabulary discipline:** this is an operational/observability
gap in how a batch here is run against a model server, not an engine or seam issue -- nothing about it
belongs in `run-dmcp` or `mind-seam`.

Not yet built. No code change; this is a process habit for whoever launches or restarts the server a
batch depends on, plus a place (this file, until something more permanent exists) to check whether it
has already been proposed before re-discovering it.
