#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Fetch data from local APIs
LOGS_JSON=$(curl -sS http://127.0.0.1:8081/api/wellness/logs?days=14 || echo '{"logs":[]}')
WATCH_JSON=$(curl -sS http://127.0.0.1:8081/api/wellness/watch || echo '{"watch":{}}')
SUMMARY_JSON=$(curl -sS http://127.0.0.1:8081/api/wellness/summary || echo '{}')

# Combine using jq
UPDATED_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TMP=$(mktemp)
# Expected summary fields: quitStart, plan{...}, today{...}
# Normalize structures to avoid nulls
jq -n \
  --argjson logs "$(echo "$LOGS_JSON" | jq '.logs // . // []')" \
  --argjson watch "$(echo "$WATCH_JSON" | jq '.watch // . // {}')" \
  --argjson summary "$(echo "$SUMMARY_JSON" | jq '. // {}')" \
  --arg updated "$UPDATED_ISO" \
  '{
    updated: $updated,
    quitStart: ($summary.quitStart // ""),
    plan: ($summary.plan // {
      week1_2:3, week3_4:2, week5_6:1, week7_plus:0,
      baseline:5, brand:"Marlboro Red", nicotinePer:10.9, deliveredPer:1.1
    }),
    today: ($summary.today // {smokes:0, avgMood:null, date: (now|todateiso8601)}),
    logs: ($logs | map({date:(.date//""), smokes:(.smokes//0), avgMood:(.avgMood//null)})),
    watch: ($watch // {})
  }' > "$TMP"

if ! cmp -s "$TMP" data/wellness.json; then
  mv "$TMP" data/wellness.json
  git add data/wellness.json
  git commit -m "chore(data): sync wellness snapshot $UPDATED_ISO" || true
  git push origin main || true
else
  rm -f "$TMP"
fi
