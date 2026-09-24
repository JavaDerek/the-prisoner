#!/usr/bin/env bash
# Files each finished transcript into its arm by the ONE thing that cannot be
# got wrong: the PROSE SEAT line the transcript prints about itself. Not the
# driver log, not the launch order, not the filename -- PREDICTION.md's
# stopping rule 3 says the header settles which arm a game ran, so the header
# is what files it.
set -uo pipefail
cd /tmp/b6-worktree
B=checkpoints/2026-09-24-phase1-b6
mkdir -p $B/P $B/S
for f in $(find checkpoints -maxdepth 1 -name "2026-09-2*T*.md" -newermt "2026-09-24 18:35" 2>/dev/null); do
  b=$(basename "$f" .md)
  if grep -q 'PROSE SEAT (`PRISONER_PROSE_SEAT=prisoner`)' "$f"; then arm=P; else arm=S; fi
  mv "$f" "$B/$arm/"
  [ -f "checkpoints/$b.referee.json" ] && mv "checkpoints/$b.referee.json" "$B/$arm/"
done
echo "P=$(ls $B/P/*.md 2>/dev/null | wc -l | tr -d ' ') S=$(ls $B/S/*.md 2>/dev/null | wc -l | tr -d ' ')"
