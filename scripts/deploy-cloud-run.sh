#!/usr/bin/env sh
set -eu

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${2:-${CLOUD_RUN_REGION:-us-central1}}"
SERVICE="${3:-${CLOUD_RUN_SERVICE:-zonetrip}}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 PROJECT_ID [REGION] [SERVICE]" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  if [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
    PATH="$HOME/google-cloud-sdk/bin:$PATH"
    export PATH
  else
    echo "gcloud CLI is required: https://cloud.google.com/sdk/docs/install" >&2
    exit 1
  fi
fi

cd "$(dirname "$0")/.."

./scripts/audit-standalone.sh

gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars ZONETRIP_HOST=0.0.0.0,ZONETRIP_ROOT=/app

url="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')"

echo "Cloud Run URL: $url"
