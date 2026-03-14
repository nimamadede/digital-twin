#!/usr/bin/env bash
# Auth flow e2e: register -> login -> me -> refresh
# Usage: ./scripts/auth-flow-e2e.sh [base_url]
# Default base_url: http://localhost:3000/api/v1

set -e
BASE="${1:-http://localhost:3000/api/v1}"
PHONE="13900001111"
PASSWORD="TestPass123!"
NICKNAME="验收用户"

echo "=== 1. Send SMS (mock code 123456) ==="
SMS_RESP=$(curl -s -X POST "$BASE/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"purpose\":\"register\"}")
echo "$SMS_RESP" | head -c 200
echo ""
if echo "$SMS_RESP" | grep -q '"code":0\|"data":'; then
  echo "[OK] SMS send"
else
  echo "[FAIL] SMS send"
  exit 1
fi

echo ""
echo "=== 2. Register ==="
REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\",\"nickname\":\"$NICKNAME\",\"verifyCode\":\"123456\"}")
HTTP_CODE=$(echo "$REG_RESP" | tail -n1)
BODY=$(echo "$REG_RESP" | sed '$d')
echo "$BODY" | head -c 300
echo ""
if [ "$HTTP_CODE" = "201" ] && echo "$BODY" | grep -q "userId\|userId"; then
  echo "[OK] Register (201)"
else
  if echo "$BODY" | grep -q "PHONE_ALREADY_EXISTS"; then
    echo "[OK] Phone already registered, continue with login"
  else
    echo "[FAIL] Register (got $HTTP_CODE)"
    exit 1
  fi
fi

echo ""
echo "=== 3. Login ==="
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN_RESP" | head -c 400
echo ""
ACCESS=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
REFRESH=$(echo "$LOGIN_RESP" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ACCESS" ] || [ -z "$REFRESH" ]; then
  echo "[FAIL] Login - no tokens"
  exit 1
fi
echo "[OK] Login - got tokens"

echo ""
echo "=== 4. GET /auth/me (with Bearer) ==="
ME_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/auth/me" \
  -H "Authorization: Bearer $ACCESS")
ME_CODE=$(echo "$ME_RESP" | tail -n1)
ME_BODY=$(echo "$ME_RESP" | sed '$d')
echo "$ME_BODY" | head -c 350
echo ""
if [ "$ME_CODE" = "200" ] && echo "$ME_BODY" | grep -q '"id"\|"phone"'; then
  echo "[OK] /auth/me (200)"
else
  echo "[FAIL] /auth/me (got $ME_CODE)"
  exit 1
fi

echo ""
echo "=== 5. Refresh Token ==="
REF_RESP=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$REF_RESP" | head -c 300
echo ""
NEW_ACCESS=$(echo "$REF_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
NEW_REFRESH=$(echo "$REF_RESP" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$NEW_ACCESS" ]; then
  echo "[FAIL] Refresh - no new accessToken"
  exit 1
fi
echo "[OK] Refresh - got new tokens"

echo ""
echo "=== 6. GET /auth/me (with new Bearer) ==="
ME2_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/auth/me" \
  -H "Authorization: Bearer $NEW_ACCESS")
ME2_CODE=$(echo "$ME2_RESP" | tail -n1)
if [ "$ME2_CODE" = "200" ]; then
  echo "[OK] /auth/me with new token (200)"
else
  echo "[FAIL] /auth/me with new token (got $ME2_CODE)"
  exit 1
fi

echo ""
echo "=== All steps passed. ==="
