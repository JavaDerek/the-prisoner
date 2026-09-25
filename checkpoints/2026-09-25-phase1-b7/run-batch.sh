#!/usr/bin/env bash
# Batch 6's driver: batch 3's (`../2026-09-23-phase1-b3/run-batch.sh`) with ONE addition, because
# batch 6 moves ONE thing batch 3's driver has no variable for -- the prisoner's SEAT SHAPE.
#
#   PRISONER_PROSE_SEAT=prisoner ./run-batch.sh <logdir> <game numbers...>   # arm P
#   PRISONER_PROSE_SEAT=          ./run-batch.sh <logdir> <game numbers...>  # arm S
#
# WHY THIS FILE EXISTS AT ALL, rather than exporting the variable around batch 3's driver. Bare
# inheritance would have worked -- `ENV=val cmd` adds to the environment rather than replacing it,
# so an exported `PRISONER_PROSE_SEAT` reaches `npm run checkpoint` untouched. It is exactly that
# invisibility that makes it the wrong way to run an arm: the arm would then be recorded nowhere
# the driver writes, and a reader checking which arm a log belongs to would have to trust the shell
# history of whoever ran it. Batch 3's own draft made this mistake in the other direction -- it
# passed `PRISONER_WARDEN_WITS_MODEL`, which nothing has ever read -- and batch 4's PREDICTION had
# to name a header line as the check. The rule both incidents point at is the same: THE DRIVER
# NAMES THE ARM, in the log, per game.
#
# Everything else is batch 3's file byte for byte, deliberately: batch 6 keeps ten rounds, voice on,
# modelled presence, the condition list, custody, the free unstated door and 300000 ms timeouts, and
# a driver that quietly differed would be a second moved variable nobody declared.
#
#   PRISONER_PRISONER_MODEL   the prisoner's chair (batch 6: muse-glimmer-30b-q4_k_m, both arms)
#   PRISONER_WARDEN_MODEL     the warden's chair   (batch 6: muse-glimmer-30b-q4_k_m, both arms)
#   PRISONER_REFEREE_MODEL    the referee          (batch 6: the same, both arms)
#   PRISONER_PROSE_SEAT       the ARM: `prisoner` = prose seat, empty/unset = the eight-field schema
#
# CHECK THE TRANSCRIPT HEADER, NOT THIS SCRIPT. `checkpoint.ts` prints `Strategy: ON` with the chosen
# index, the declared ids and BOTH raw replies when and only when the step ran; PREDICTION.md stopping
# rule 2 discards an arm-T game whose header lacks it.
# (batch 6's note follows) `checkpoint.ts` prints a `PROSE SEAT
# (PRISONER_PROSE_SEAT=prisoner)` paragraph when and only when the seat is on. A game in P/ whose
# header lacks it, or a game in S/ whose header has it, did not run the arm its directory claims and
# is discarded (PREDICTION.md, stopping rule 3).
set -uo pipefail

LOGDIR="$1"; shift
mkdir -p "$LOGDIR"

PRISONER_CHAIR="${PRISONER_PRISONER_MODEL:-claude-opus-4-6}"
WARDEN_CHAIR="${PRISONER_WARDEN_MODEL:-claude-opus-4-6}"
REFEREE="${PRISONER_REFEREE_MODEL:-muse-glimmer-30b-q4_k_m}"
PROSE_SEAT="${PRISONER_PROSE_SEAT:-}"
# Batch 7's ONE addition over batch 6's driver, for batch 7's ONE moved variable. Same reasoning as the
# line above it, and the same rule both earlier incidents point at: THE DRIVER NAMES THE ARM, in the log,
# per game. A strategy arm recorded nowhere the driver writes would leave a reader checking shell history.
STRATEGY="${PRISONER_STRATEGY:-}"
STRENGTH="${PRISONER_STRATEGY_STRENGTH:-high}"

for n in "$@"; do
  log="$LOGDIR/O-$n.log"
  before=$(curl -s --max-time 10 http://localhost:8799/api/ps | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable")
  echo "== O#$n prisoner=$PRISONER_CHAIR warden=$WARDEN_CHAIR referee=$REFEREE prose_seat=[${PROSE_SEAT:-off}] strategy=[${STRATEGY:-off}] strength=[$STRENGTH] start=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_before=[$before]" > "$log"

  PRISONER_VARIANT=open \
  PRISONER_MODEL_URL=http://localhost:8799/v1 \
  PRISONER_WITS_MODEL="$PRISONER_CHAIR" \
  PRISONER_VOICE_MODEL="$PRISONER_CHAIR" \
  PRISONER_PRISONER_MODEL="$PRISONER_CHAIR" \
  PRISONER_WARDEN_MODEL="$WARDEN_CHAIR" \
  PRISONER_REFEREE_MODEL="$REFEREE" \
  PRISONER_PROSE_SEAT="$PROSE_SEAT" \
  PRISONER_STRATEGY="$STRATEGY" \
  PRISONER_STRATEGY_STRENGTH="$STRENGTH" \
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
