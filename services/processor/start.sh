#!/usr/bin/env sh
set -eu

export OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-/models/ollama}"
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
export PORT="${PORT:-8080}"

if command -v ollama >/dev/null 2>&1; then
  ollama serve &
  ollama_pid="$!"

  for _ in $(seq 1 90); do
    if curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if [ "${ZONETRIP_PULL_MODELS:-1}" = "1" ]; then
    ollama pull "${ZONETRIP_OLLAMA_MODEL:-llama3.1:8b-instruct-q4_K_M}"
  fi
else
  ollama_pid=""
fi

shutdown() {
  if [ -n "${ollama_pid:-}" ]; then
    kill "$ollama_pid" 2>/dev/null || true
  fi
}
trap shutdown INT TERM EXIT

exec uvicorn app:app --host 0.0.0.0 --port "$PORT"
