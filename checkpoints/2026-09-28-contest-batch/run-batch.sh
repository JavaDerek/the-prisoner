#!/usr/bin/env bash
# P5's driver (PLAYTEST-2026-09-27-DESIGN.md §6 P5; BUILD-SPEC "Landing order" step 4): the contest batch, N=6 per
# arm, ten rounds, all-Muse, ONE driver, serial, from a pinned commit. Scaffolding written 2026-09-27, NOT RUN.
#
#   ./run-batch.sh --dry-run [TOKENS...]    print every precondition and every game's environment, and check that
#                                           environment through the game's own readers; no network, no game
#   ./run-batch.sh [TOKENS...]              the batch
#
# TOKENS name games as <arm><n>: A1 B1 A2 B2 ... The default is the whole batch, arms ALTERNATING (A1 B1 A2 B2 ...
# A6 B6): one serial driver, so alternating costs nothing in determinism (CLAUDE.md "One driver at a time" is
# about two PROCESSES on one server) and spreads the card's drift -- Shep's traffic, time of day -- over both arms.
# A rerun of a token whose transcript is already in its arm directory is skipped, so a stopped batch resumes.
#
#   arm A: every default the build landed (PLAYTEST-2026-09-27 D1-D12, the spec's defaults), `PRISONER_BLOCK=on`
#   arm B: identical, `PRISONER_BLOCK=off` (the R2 kill's control)
#
# THE DRIVER NAMES THE ARM (batch 6's lesson): every variable a game reads is set here, explicitly, per game --
# including the ones equal to their defaults -- and `env-check.mts` refuses to start a game whose environment,
# read through the game's own `read*Mode` functions, is not the arm this file says it is. The transcript header
# (`Block:`, `Absence:`, `Conditions:`, `Door:`, `Door price:`, `Presence:`, `One act:`, `Code revision:`) is the
# final word, and `scoreboard.mts` quarantines a game whose header disagrees with its directory.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi
TOKENS=("$@")
if [ ${#TOKENS[@]} -eq 0 ]; then TOKENS=(A1 B1 A2 B2 A3 B3 A4 B4 A5 B5 A6 B6); fi

MODEL="muse-glimmer:30b"                         # CLAUDE.md: local play is all-Muse, every chair
PRISONER_CHAIR="${P5_PRISONER_CHAIR:-$MODEL}"    # PREDICTION.md's one open question; the default is the spec's all-Muse
MODEL_URL="${PRISONER_MODEL_URL:-http://doris:11434/v1}"
NATIVE_URL="${MODEL_URL%/v1}"
LOCK=/tmp/the-prisoner-one-driver.lock            # the same lock every 2026-09-28 probe takes

say() { echo "$@"; }

# ---- preconditions -------------------------------------------------------------------------------------------
cd "$REPO" || exit 1
REV="$(git rev-parse --short HEAD)"
DIRTY="$(git status --porcelain | grep -v '^?? checkpoints/' | grep -v '^?? node_modules' || true)"
if [ $DRY -eq 1 ]; then
  say "DRY RUN -- no game runs, no network call is made."
  say "precondition: pinned commit $REV; tracked changes: ${DIRTY:-none} (a live run refuses any unless ALLOW_DIRTY=1)"
  say "precondition: one driver -- would take $LOCK and refuse if held; would refuse if another src/checkpoint.ts runs"
  say "precondition: would read $NATIVE_URL/api/ps and refuse any model loaded other than $MODEL (Shep's $MODEL is ours)"
else
  if [ -n "$DIRTY" ] && [ "${ALLOW_DIRTY:-0}" != "1" ]; then
    echo "run-batch: the tree has tracked changes -- run from a pinned commit (CLAUDE.md), or ALLOW_DIRTY=1 and say so in RESULTS:" >&2
    echo "$DIRTY" >&2
    exit 1
  fi
  if ! mkdir "$LOCK" 2>/dev/null; then
    echo "run-batch: another driver holds $LOCK ($(cat "$LOCK/holder" 2>/dev/null)). One driver at a time." >&2
    exit 1
  fi
  echo "P5 run-batch.sh pid $$ since $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK/holder"
  trap 'rm -rf "$LOCK"' EXIT
  if pgrep -f "src/checkpoint.ts" >/dev/null; then
    echo "run-batch: a src/checkpoint.ts process is already running. One driver at a time." >&2
    exit 1
  fi
fi

ps_names() {
  curl -s --max-time 10 "$NATIVE_URL/api/ps" | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable"
}

# ---- the games -----------------------------------------------------------------------------------------------
for token in "${TOKENS[@]}"; do
  ARM="${token:0:1}"; N="${token:1}"
  if { [ "$ARM" != "A" ] && [ "$ARM" != "B" ]; } || ! [[ "$N" =~ ^[0-9]+$ ]]; then echo "run-batch: bad token $token (want A1..A6, B1..B6)" >&2; exit 1; fi
  BLOCK=$([ "$ARM" = "A" ] && echo on || echo off)
  ARMDIR="$HERE/$ARM"; mkdir -p "$ARMDIR"
  MARK="$ARMDIR/.game-$N"
  if [ -f "$MARK" ]; then say "== $token already ran ($(cat "$MARK")), skipped"; continue; fi
  LOG="$HERE/logs/$ARM-$N.txt"

  GAME_ENV=(
    -u PRISONER_SKIP_VOICE -u PRISONER_THINKING -u PRISONER_MODEL -u PRISONER_STRATEGY -u PRISONER_STRATEGY_STRENGTH
    -u PRISONER_PROSE_SEAT -u PRISONER_PICK -u PRISONER_PRECEDENT_LEDGER -u PRISONER_PRECEDENT_PRICE -u PRISONER_WARDEN
    -u PRISONER_HUMAN -u PRISONER_VIEW -u PRISONER_NARRATOR_MODEL -u PRISONER_ELABORATE_BAND
    PRISONER_VARIANT=open
    PRISONER_MODEL_URL="$MODEL_URL"
    PRISONER_WITS_MODEL="$MODEL"
    PRISONER_VOICE_MODEL="$MODEL"
    PRISONER_PRISONER_MODEL="$PRISONER_CHAIR"
    PRISONER_WARDEN_MODEL="$MODEL"
    PRISONER_REFEREE_MODEL="$MODEL"
    PRISONER_ROUNDS=10
    PRISONER_PRESENCE=modelled
    PRISONER_ABSENCE=cadence
    PRISONER_CONDITIONS=both
    PRISONER_DOOR=stated
    PRISONER_DOOR_PRICE=margin
    PRISONER_WINDOW=open
    PRISONER_BLOCK="$BLOCK"
    PRISONER_PERSON_INSTRUMENT=off
    PRISONER_ONE_ACT=first
    PRISONER_INSTRUMENT=off
    PRISONER_DERIVE_WORDING=baseline
    PRISONER_ELISION=on
    PRISONER_CONTAINER_CLAUSE=on
    PRISONER_DERIVE_REPEAT=off
    PRISONER_ELABORATE=off
    PRISONER_REFEREE_THINKING=off
    PRISONER_WITS_THINKING=off
    PRISONER_THINK_TIMEOUT_MS=300000
    PRISONER_REFEREE_TIMEOUT_MS=300000
    PRISONER_OLLAMA_RESIDENT_MODELS="$MODEL"
    PRISONER_CHECKPOINT_DB="/tmp/p5-$ARM-$N-$$.db"
  )

  if [ $DRY -eq 1 ]; then
    say ""
    say "== $token: env ${GAME_ENV[*]} npm run checkpoint"
    # The environment differs between arms only, so each arm's is checked once (every game's is checked live).
    if [[ " ${CHECKED:-} " != *" $ARM "* ]]; then
      env "${GAME_ENV[@]}" npx tsx "$HERE/env-check.mts" --arm="$ARM" || exit 1
      CHECKED="${CHECKED:-} $ARM"
    fi
    continue
  fi

  env "${GAME_ENV[@]}" npx tsx "$HERE/env-check.mts" --arm="$ARM" > "$LOG" 2>&1 || { cat "$LOG" >&2; exit 1; }
  before="$(ps_names)"
  if [ "$before" != "none" ] && [ "$before" != "$MODEL" ]; then
    echo "run-batch: $NATIVE_URL/api/ps shows [$before] -- a model other than $MODEL is loaded (someone else's). Stopping." >&2
    exit 1
  fi
  echo "== $token arm=$ARM block=$BLOCK prisoner=$PRISONER_CHAIR warden=$MODEL referee=$MODEL rev=$REV start=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_before=[$before]" >> "$LOG"

  env "${GAME_ENV[@]}" npm run checkpoint >> "$LOG" 2>&1 &
  game=$!
  # Watchdog (batch 7's): kill a game whose log has not grown in STALL_SECONDS, so one hang cannot take the rest
  # of the batch with it. A killed game is recorded in its log and quarantined by PREDICTION.md's stopping rule.
  STALL_SECONDS="${STALL_SECONDS:-1800}"
  ( last=0; still=0
    while kill -0 "$game" 2>/dev/null; do
      sleep 60
      size=$(wc -c < "$LOG" 2>/dev/null || echo 0)
      if [ "$size" -eq "$last" ]; then still=$((still + 60)); else still=0; last=$size; fi
      if [ "$still" -ge "$STALL_SECONDS" ]; then
        echo "== $token KILLED BY WATCHDOG: no output for ${STALL_SECONDS}s at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
        pkill -P "$game" 2>/dev/null; kill "$game" 2>/dev/null
        break
      fi
    done ) &
  dog=$!
  wait "$game"; rc=$?
  kill "$dog" 2>/dev/null

  # checkpoint.ts writes <repo>/checkpoints/<stamp>.md (and .referee.json); move this game's into its arm directory.
  md="$(grep -Eo '(Partial )?[Tt]ranscript written to .*\.md' "$LOG" | tail -1 | sed -E 's/^.*written to //')"
  if [ -n "$md" ] && [ -f "$md" ]; then
    stem="${md%.md}"
    for f in "$stem.md" "$stem.referee.json" "$stem.rows.jsonl"; do [ -f "$f" ] && mv "$f" "$ARMDIR/"; done
    echo "$(basename "$md") rc=$rc" > "$MARK"
  else
    echo "== $token: no transcript found in the log (rc=$rc) -- quarantined" >> "$LOG"
    echo "none rc=$rc" > "$MARK"
  fi
  after="$(ps_names)"
  echo "== $token rc=$rc end=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_after=[$after]" >> "$LOG"
  say "== $token done rc=$rc -> $ARMDIR/$(basename "${md:-none}")"
  npx tsx "$HERE/scoreboard.mts" "$HERE" || true
done
