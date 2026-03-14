#!/usr/bin/env bash
# Self-test: message list pagination and stats (requires app running + DB + Redis).
# Usage: ./scripts/message-self-test.sh [base_url]
# Example: npm run start:dev & sleep 5 && ./scripts/message-self-test.sh

set -e
BASE="${1:-http://localhost:3000/api/v1}"
PHONE="13900009999"
PASSWORD="TestPass1"
NICKNAME="MessageE2EUser"

echo "=== Message module self-test (list pagination + stats) ==="
echo "Base URL: $BASE"
echo ""

echo "=== 1. Send SMS ==="
curl -s -X POST "$BASE/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"purpose\":\"register\"}" | head -c 200
echo ""
echo ""

echo "=== 2. Register (or skip if exists) ==="
REG=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\",\"nickname\":\"$NICKNAME\",\"verifyCode\":\"123456\"}")
HTTP_REG=$(echo "$REG" | tail -n1)
if [ "$HTTP_REG" != "201" ] && ! echo "$REG" | grep -q "PHONE_ALREADY_EXISTS"; then
  echo "Register response (code $HTTP_REG): $(echo "$REG" | sed '$d' | head -c 200)"
fi
echo ""

echo "=== 3. Login ==="
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}")
ACCESS=$(echo "$LOGIN_RESP" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$ACCESS" ]; then
  echo "[FAIL] No accessToken in login response"
  echo "$LOGIN_RESP" | head -c 400
  exit 1
fi
echo "[OK] Got accessToken"
echo ""

echo "=== 4. GET /messages?page=1&pageSize=10 (list pagination) ==="
MSG_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/messages?page=1&pageSize=10" \
  -H "Authorization: Bearer $ACCESS")
MSG_CODE=$(echo "$MSG_RESP" | tail -n1)
MSG_BODY=$(echo "$MSG_RESP" | sed '$d')
if [ "$MSG_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $MSG_CODE"
  echo "$MSG_BODY" | head -c 500
  exit 1
fi
echo "$MSG_BODY" | head -c 600
echo ""
ITEMS=$(echo "$MSG_BODY" | sed -n 's/.*"items":\[\(.*\)\],"total".*/\1/p')
TOTAL=$(echo "$MSG_BODY" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
PAGE=$(echo "$MSG_BODY" | sed -n 's/.*"page":\([0-9]*\).*/\1/p')
PAGE_SIZE=$(echo "$MSG_BODY" | sed -n 's/.*"pageSize":\([0-9]*\).*/\1/p')
TOTAL_PAGES=$(echo "$MSG_BODY" | sed -n 's/.*"totalPages":\([0-9]*\).*/\1/p')
echo "[OK] messages list: page=$PAGE pageSize=$PAGE_SIZE total=$TOTAL totalPages=$TOTAL_PAGES"
if [ -n "$TOTAL" ] && [ -n "$PAGE_SIZE" ] && [ "$TOTAL" -gt 0 ]; then
  EXPECTED_PAGES=$(( (TOTAL + PAGE_SIZE - 1) / PAGE_SIZE ))
  if [ "$TOTAL_PAGES" != "$EXPECTED_PAGES" ]; then
    echo "[WARN] totalPages ($TOTAL_PAGES) != ceil(total/pageSize) ($EXPECTED_PAGES)"
  else
    echo "[OK] totalPages consistent with total and pageSize"
  fi
fi
echo ""

echo "=== 5. GET /messages/stats?period=week (statistics) ==="
STATS_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/messages/stats?period=week" \
  -H "Authorization: Bearer $ACCESS")
STATS_CODE=$(echo "$STATS_RESP" | tail -n1)
STATS_BODY=$(echo "$STATS_RESP" | sed '$d')
if [ "$STATS_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $STATS_CODE"
  echo "$STATS_BODY" | head -c 500
  exit 1
fi
echo "$STATS_BODY" | head -c 800
echo ""
if echo "$STATS_BODY" | grep -q '"summary"' && echo "$STATS_BODY" | grep -q '"totalMessages"' && echo "$STATS_BODY" | grep -q '"timeline"' && echo "$STATS_BODY" | grep -q '"topContacts"'; then
  echo "[OK] stats response has summary, timeline, topContacts"
else
  echo "[FAIL] stats response missing required fields"
  exit 1
fi
echo ""

echo "=== All message self-test steps passed. ==="
