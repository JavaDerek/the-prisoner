#!/usr/bin/env bash
# The batch driver, committed so a batch's conditions are readable rather than remembered
# (batch 2's driver was a shell one-liner and only its logs survive). Batch 3 was the first to
# use it; batch 4 and 5 use this same file, from a worktree pinned at their own commit.
#
#   PRISONER_PRISONER_MODEL=… PRISONER_WARDEN_MODEL=… ./run-batch.sh <logdir> <game numbers...>
#
# One driver per invocation, games run in sequence; two drivers side by side make the batch.
# Run it from a worktree pinned at the batch's commit, never from live main (CLAUDE.md, "Run a
# batch from a pinned commit"). The model router must already be listening on 8799 with its
# local route configured (SETUP.md), and doris's Ollama must hold nothing -- the referee is
# served by llama-server, and `PRISONER_OLLAMA_RESIDENT_MODELS=` (empty) means any model found
# loaded in Ollama stops the run, which is exactly the guard we want on a shared card.
#
# WHICH MODEL SITS IN WHICH CHAIR is this script's only argument of substance, because batch 4
# changes exactly that and nothing else (`../2026-09-24-phase1-b4/PREDICTION.md`). The variables
# below are the ones `src/checkpoint.ts` ITSELF reads (`src/modelRoles.ts`), not names this
# script translates -- batch 3's draft of this file passed `PRISONER_WARDEN_WITS_MODEL`, which
# nothing has ever read, so a mixed batch invoked through it would have run Opus in both chairs
# and said so only in a transcript header nobody re-read.
#
#   PRISONER_PRISONER_MODEL   the prisoner's chair (default: claude-opus-4-6)
#   PRISONER_WARDEN_MODEL     the warden's chair   (default: claude-opus-4-6)
#   PRISONER_REFEREE_MODEL    the referee          (default: the local Muse-Glimmer of batch 3)
#
# Both chairs defaulting to `claude-opus-4-6` reproduces batch 3 byte for byte, header included:
# equal chairs print the one `Wits model:` line every earlier batch printed, and differing chairs
# print a line each (`openModelHeaderLines`, pinned by `src/__tests__/modelRoles.test.ts`).
set -uo pipefail

LOGDIR="$1"; shift
mkdir -p "$LOGDIR"

PRISONER_CHAIR="${PRISONER_PRISONER_MODEL:-claude-opus-4-6}"
WARDEN_CHAIR="${PRISONER_WARDEN_MODEL:-claude-opus-4-6}"
REFEREE="${PRISONER_REFEREE_MODEL:-muse-glimmer-30b-q4_k_m}"

# `PRISONER_WITS_MODEL`/`PRISONER_VOICE_MODEL` are the RUN's pair, which the two chairs above fall
# back to. Both chairs are always named explicitly, so the pair is never consulted -- it is set to
# the prisoner's model anyway, deliberately, so that a future edit that drops a chair's variable
# falls back to a model this batch actually meant rather than to `modelRoles.ts`'s own qwen3:14b
# default, which would be a silently wrong arm rather than a loud one.
for n in "$@"; do
  log="$LOGDIR/O-$n.log"
  before=$(curl -s --max-time 10 http://localhost:8799/api/ps | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable")
  echo "== O#$n prisoner=$PRISONER_CHAIR warden=$WARDEN_CHAIR referee=$REFEREE start=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_before=[$before]" > "$log"

  PRISONER_VARIANT=open \
  PRISONER_MODEL_URL=http://localhost:8799/v1 \
  PRISONER_WITS_MODEL="$PRISONER_CHAIR" \
  PRISONER_VOICE_MODEL="$PRISONER_CHAIR" \
  PRISONER_PRISONER_MODEL="$PRISONER_CHAIR" \
  PRISONER_WARDEN_MODEL="$WARDEN_CHAIR" \
  PRISONER_REFEREE_MODEL="$REFEREE" \
  PRISONER_REFEREE_THINKING=off \
  PRISONER_PRESENCE=modelled \
  PRISONER_ROUNDS=10 \
  PRISONER_THINK_TIMEOUT_MS=300000 \
  PRISONER_REFEREE_TIMEOUT_MS=300000 \
  PRISONER_OLLAMA_RESIDENT_MODELS= \
  PRISONER_CHECKPOINT_DB="/tmp/phase1-O-$n-$$.db" \
    npm run checkpoint >> "$log" 2>&1 &
  game=$!

  # Watchdog: kill a game whose log has not grown in STALL_SECONDS, so the driver moves on to the
  # next one instead of hanging until morning. Batch 3's slowest half-round was 255s, so 30 minutes
  # of silence is well past anything a working game does. Unattended overnight, a driver that hangs
  # takes the rest of its games with it, and waking to three transcripts instead of ten is the
  # failure this guards against -- the stopping rule in a PREDICTION.md catches a hung RULING, which
  # is a different thing. A killed game is recorded as such in its own log and is quarantined by the
  # batch's stopping rule like any other.
  STALL_SECONDS="${STALL_SECONDS:-1800}"
  ( last=0; still=0
    while kill -0 "$game" 2>/dev/null; do
      sleep 60
      size=$(wc -c < "$log" 2>/dev/null || echo 0)
      if [ "$size" -eq "$last" ]; then still=$((still + 60)); else still=0; last=$size; fi
      if [ "$still" -ge "$STALL_SECONDS" ]; then
        echo "== O#$n KILLED BY WATCHDOG: no output for ${STALL_SECONDS}s at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$log"
        pkill -P "$game" 2>/dev/null; kill "$game" 2>/dev/null
        break
      fi
    done ) &
  dog=$!

  wait "$game"; rc=$?
  kill "$dog" 2>/dev/null

  after=$(curl -s --max-time 10 http://localhost:8799/api/ps | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable")
  echo "== O#$n rc=$rc end=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_after=[$after]" >> "$log"
done

# CHECK THE TRANSCRIPT HEADER BEFORE TRUSTING A MIXED BATCH. `openModelHeaderLines` prints
# "Prisoner's chair -- ..." and "Warden's chair -- ..." when the two differ and a single
# "Wits model:" line when they do not, so one glance at line 9 of any transcript says which arm
# actually ran, whatever this script was invoked with.
