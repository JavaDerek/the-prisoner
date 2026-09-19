#!/bin/zsh
# §4.8's sweep. Sequential -- one model on the card at a time.
# Transcripts are cleared from the worktree before each game so every run's
# header names a single revision (src/runRevision.ts reads `git status --porcelain`,
# which counts untracked files, and a previous game's output is untracked).
set -u
WT=/tmp/prisoner-batch
OUT=/tmp/batch-out
cd "$WT" || exit 1

run_game() {
  local cell="$1" idx="$2" window="$3" rounds="$4" thinking="$5" band="$6"
  mkdir -p "$OUT/$cell"
  # Only UNTRACKED files: the repository's own committed historical transcripts
  # live in this directory too, and deleting those is what dirties the worktree.
  git clean -fq checkpoints/ 2>/dev/null
  local dirty
  dirty=$(git status --porcelain | wc -l | tr -d ' ')
  echo "[$(date -u +%H:%M:%S)] $cell #$idx  window=$window rounds=$rounds thinking=$thinking band=${band:-as-built} dirty=$dirty" >> "$OUT/manifest.log"

  env PRISONER_VARIANT=open \
      PRISONER_WINDOW="$window" \
      PRISONER_THINKING="$thinking" \
      PRISONER_ELABORATE=property \
      ${band:+PRISONER_ELABORATE_BAND=$band} \
      PRISONER_INSTRUMENT=checked \
      PRISONER_DOOR_PRICE=margin \
      PRISONER_SKIP_VOICE=1 \
      PRISONER_ROUNDS="$rounds" \
      PRISONER_MODEL_URL=http://doris:11434/v1 \
      PRISONER_WITS_MODEL=qwen3:14b \
      PRISONER_REFEREE_TIMEOUT_MS=180000 PRISONER_THINK_TIMEOUT_MS=180000 \
      PRISONER_OLLAMA_RESIDENT_MODELS= \
      PRISONER_CHECKPOINT_DB="/tmp/batch-out/db/${cell}-${idx}.db" \
      npm run checkpoint > "$OUT/$cell/game-$idx.log" 2>&1

  local res
  res=$(grep -m1 "^Result:" "$OUT/$cell/game-$idx.log" || echo "Result: NONE")
  echo "[$(date -u +%H:%M:%S)] $cell #$idx  $res" >> "$OUT/manifest.log"
  # Move out only what this game produced (untracked), leaving history alone.
  for f in $(git ls-files --others --exclude-standard checkpoints/); do
    mv "$WT/$f" "$OUT/$cell/" 2>/dev/null
  done
}

mkdir -p "$OUT/db"
for i in $(seq 1 10); do run_game A  "$i" open   1  off "" ; done
for i in $(seq 1 10); do run_game B  "$i" welded 1  off "" ; done
for i in $(seq 1 5);  do run_game C1 "$i" welded 30 on  trivial ; done
for i in $(seq 1 5);  do run_game C2 "$i" welded 30 on  hard ; done
for i in $(seq 1 5);  do run_game C3 "$i" welded 30 on  ruinous ; done
for i in $(seq 1 3);  do run_game D  "$i" open   30 on  "" ; done
echo "[$(date -u +%H:%M:%S)] BATCH COMPLETE" >> "$OUT/manifest.log"
