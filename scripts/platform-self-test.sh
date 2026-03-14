#!/usr/bin/env bash
# Self-test: platform authorize + listener start/stop (requires app running + DB).
# Usage: ./scripts/platform-self-test.sh [base_url]
# Example: npm run start:dev & sleep 5 && ./scripts/platform-self-test.sh

set -e
BASE="${1:-http://localhost:3000/api/v1}"
PHONE="13900008888"
PASSWORD="TestPass1"
NICKNAME="PlatformE2EUser"

echo "=== Platform module self-test (authorize + listener start/stop) ==="
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

echo "=== 4. POST /platforms/authorize (create WeChat auth) ==="
AUTH_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/platforms/authorize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"platform":"wechat","authType":"qrcode"}')
AUTH_CODE=$(echo "$AUTH_RESP" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RESP" | sed '$d')
if [ "$AUTH_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $AUTH_CODE"
  echo "$AUTH_BODY" | head -c 500
  exit 1
fi
AUTH_ID=$(echo "$AUTH_BODY" | sed -n 's/.*"authId":"\([^"]*\)".*/\1/p')
if [ -z "$AUTH_ID" ]; then
  echo "[FAIL] No authId in authorize response"
  echo "$AUTH_BODY" | head -c 400
  exit 1
fi
echo "[OK] authId=$AUTH_ID"
echo "$AUTH_BODY" | head -c 400
echo ""
echo ""

echo "=== 5. GET /platforms/authorize/:authId/status (poll until confirmed, mock ~2s) ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  STATUS_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/platforms/authorize/$AUTH_ID/status" \
    -H "Authorization: Bearer $ACCESS")
  STATUS_CODE=$(echo "$STATUS_RESP" | tail -n1)
  STATUS_BODY=$(echo "$STATUS_RESP" | sed '$d')
  if [ "$STATUS_CODE" != "200" ]; then
    echo "[FAIL] status request got HTTP $STATUS_CODE"
    echo "$STATUS_BODY" | head -c 300
    exit 1
  fi
  S=$(echo "$STATUS_BODY" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  echo "  poll $i: status=$S"
  if [ "$S" = "confirmed" ]; then
    PLATFORM_AUTH_ID=$(echo "$STATUS_BODY" | sed -n 's/.*"platformAuthId":"\([^"]*\)".*/\1/p')
    if [ -z "$PLATFORM_AUTH_ID" ]; then
      echo "[FAIL] status=confirmed but no platformAuthId"
      echo "$STATUS_BODY" | head -c 300
      exit 1
    fi
    echo "[OK] confirmed, platformAuthId=$PLATFORM_AUTH_ID"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "[FAIL] Timeout waiting for confirmed"
    exit 1
  fi
  sleep 1
done
echo ""

echo "=== 6. GET /platforms (list) ==="
LIST_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/platforms" \
  -H "Authorization: Bearer $ACCESS")
LIST_CODE=$(echo "$LIST_RESP" | tail -n1)
LIST_BODY=$(echo "$LIST_RESP" | sed '$d')
if [ "$LIST_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $LIST_CODE"
  echo "$LIST_BODY" | head -c 400
  exit 1
fi
echo "[OK] platforms list: $(echo "$LIST_BODY" | head -c 300)..."
echo ""

echo "=== 7. POST /platforms/:platformAuthId/listener/start ==="
START_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/platforms/$PLATFORM_AUTH_ID/listener/start" \
  -H "Authorization: Bearer $ACCESS")
START_CODE=$(echo "$START_RESP" | tail -n1)
if [ "$START_CODE" != "204" ]; then
  echo "[FAIL] Expected 204, got $START_CODE"
  echo "$START_RESP" | sed '$d' | head -c 300
  exit 1
fi
echo "[OK] listener started (204)"
echo ""

echo "=== 8. GET /platforms/:platformAuthId/listener (state) ==="
STATE_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/platforms/$PLATFORM_AUTH_ID/listener" \
  -H "Authorization: Bearer $ACCESS")
STATE_CODE=$(echo "$STATE_RESP" | tail -n1)
STATE_BODY=$(echo "$STATE_RESP" | sed '$d')
if [ "$STATE_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $STATE_CODE"
  echo "$STATE_BODY" | head -c 300
  exit 1
fi
echo "[OK] listener state: $STATE_BODY"
echo ""

echo "=== 9. POST /platforms/:platformAuthId/listener/stop ==="
STOP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/platforms/$PLATFORM_AUTH_ID/listener/stop" \
  -H "Authorization: Bearer $ACCESS")
STOP_CODE=$(echo "$STOP_RESP" | tail -n1)
if [ "$STOP_CODE" != "204" ]; then
  echo "[FAIL] Expected 204, got $STOP_CODE"
  echo "$STOP_RESP" | sed '$d' | head -c 300
  exit 1
fi
echo "[OK] listener stopped (204)"
echo ""

echo "=== 10. GET /platforms/:platformAuthId/listener (after stop) ==="
STATE2_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/platforms/$PLATFORM_AUTH_ID/listener" \
  -H "Authorization: Bearer $ACCESS")
STATE2_BODY=$(echo "$STATE2_RESP" | sed '$d')
echo "[OK] listener state after stop: $STATE2_BODY"
echo ""

echo "=== [PASS] Platform self-test: create auth + start/stop listener ==="
