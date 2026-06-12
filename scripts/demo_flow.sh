#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "$ curl -X POST $BASE_URL/api/analysis -H 'content-type: application/json' -d @analysis-request.json"
ANALYSIS_RESPONSE="$(
  curl -sS -X POST "$BASE_URL/api/analysis" \
    -H "content-type: application/json" \
    -d '{
      "channel": "slack",
      "requester": "ops-lead",
      "question": "Show revenue by month for the last quarter",
      "semanticProfile": "saas"
    }'
)"
echo "$ANALYSIS_RESPONSE"

ANALYSIS_ID="$(printf '%s' "$ANALYSIS_RESPONSE" | python -c "import json,sys; print(json.load(sys.stdin)['analysisRequestId'])")"

echo
echo "$ curl $BASE_URL/api/analysis/$ANALYSIS_ID"
for _ in 1 2 3 4 5; do
  curl -sS "$BASE_URL/api/analysis/$ANALYSIS_ID"
  echo
  sleep 1
done

