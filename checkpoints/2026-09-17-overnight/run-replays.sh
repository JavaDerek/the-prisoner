#!/bin/bash
# Replays each named game's recorded referee requests N times on the default referee (qwen3:14b),
# one after another, writing <stamp>-replay-N<N>.txt next to this script. Unloads qwen3:14b after.
set -u
N=$1; shift
cd "$(dirname "$0")/../.."
for STAMP in "$@"; do
  curl -s -m 10 http://doris:11434/api/ps | grep -q '"models":\[\]' || { echo "doris not empty before replay $STAMP -- stopping"; exit 3; }
  env PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=180000 PRISONER_OLLAMA_RESIDENT_MODELS= \
    npm run -s referee-replay -- checkpoints/$STAMP.referee.json $N > checkpoints/2026-09-17-overnight/$STAMP-replay-N$N.txt 2>&1
  echo "replay $STAMP exit $? $(date)"
  curl -s -m 30 http://doris:11434/api/generate -d '{"model":"qwen3:14b","keep_alive":0}' > /dev/null
  for _ in $(seq 1 30); do curl -s -m 10 http://doris:11434/api/ps | grep -q '"models":\[\]' && break; sleep 2; done
done
echo "replays done $(date)"
