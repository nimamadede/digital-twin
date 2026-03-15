#!/usr/bin/env bash
# Self-test: platform message -> router -> reply generation -> send (requires app + DB + Redis).
# Usage: ./scripts/router-inbound-self-test.sh [base_url]
# Example: npm run start:dev & sleep 5 && ./scripts/router-inbound-self-test.sh

set -e
BASE="${1:-http://localhost:3000/api/v1}"
PHONE="13900008888"
PASSWORD="TestPass1"
NICKNAME="RouterE2EUser"

echo "=== Router inbound self-test (message -> route -> reply) ==="
echo "Base URL: $BASE"
echo ""

echo "=== 1. Send SMS ==="
curl -s -X POST "$BASE/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"purpose\":\"register\"}" | head -c 120
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

echo "=== 4. Create routing rule (match all -> auto_reply) ==="
RULE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/router/rules" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test auto reply","priority":10,"isEnabled":true,"type":"route","conditions":{},"action":"auto_reply"}')
RULE_CODE=$(echo "$RULE_RESP" | tail -n1)
RULE_BODY=$(echo "$RULE_RESP" | sed '$d')
if [ "$RULE_CODE" != "201" ]; then
  echo "[WARN] Create rule got $RULE_CODE (may already exist). Continuing."
else
  echo "[OK] Rule created"
fi
echo "$RULE_BODY" | head -c 300
echo ""
echo ""

echo "=== 5. POST /router/inbound (simulate platform message) ==="
INBOUND_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/router/inbound" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"platform\":\"wechat\",\"platformContactId\":\"self-test-openid-$(date +%s)\",\"nickname\":\"InboundTest\",\"content\":\"明天下午有时间吗？\"}")
INBOUND_CODE=$(echo "$INBOUND_RESP" | tail -n1)
INBOUND_BODY=$(echo "$INBOUND_RESP" | sed '$d')
if [ "$INBOUND_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $INBOUND_CODE"
  echo "$INBOUND_BODY" | head -c 600
  exit 1
fi
echo "$INBOUND_BODY" | head -c 800
echo ""

ACTION=$(echo "$INBOUND_BODY" | sed -n 's/.*"action":"\([^"]*\)".*/\1/p')
ROUTING_LOG_ID=$(echo "$INBOUND_BODY" | sed -n 's/.*"routingLogId":"\([^"]*\)".*/\1/p')
MESSAGE_ID=$(echo "$INBOUND_BODY" | sed -n 's/.*"messageId":"\([^"]*\)".*/\1/p')
CONTACT_ID=$(echo "$INBOUND_BODY" | sed -n 's/.*"contactId":"\([^"]*\)".*/\1/p')
echo ""
echo "[OK] action=$ACTION messageId=$MESSAGE_ID routingLogId=$ROUTING_LOG_ID contactId=$CONTACT_ID"
if [ -z "$ACTION" ] || [ -z "$ROUTING_LOG_ID" ]; then
  echo "[FAIL] Missing action or routingLogId in response"
  exit 1
fi
if [ "$ACTION" = "auto_reply" ]; then
  SENT=$(echo "$INBOUND_BODY" | sed -n 's/.*"sentContent":"\([^"]*\)".*/\1/p')
  REPLY_ID=$(echo "$INBOUND_BODY" | sed -n 's/.*"replyRecordId":"\([^"]*\)".*/\1/p')
  if [ -n "$REPLY_ID" ]; then
    echo "[OK] auto_reply: replyRecordId=$REPLY_ID sentContent=${SENT:-<present>}"
  else
    echo "[WARN] action=auto_reply but no replyRecordId (AI or config may have failed)"
  fi
fi
echo ""

echo "=== 6. GET /router/logs (verify routing log) ==="
LOGS_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/router/logs?page=1&pageSize=5" \
  -H "Authorization: Bearer $ACCESS")
LOGS_CODE=$(echo "$LOGS_RESP" | tail -n1)
LOGS_BODY=$(echo "$LOGS_RESP" | sed '$d')
if [ "$LOGS_CODE" != "200" ]; then
  echo "[FAIL] Expected 200, got $LOGS_CODE"
  exit 1
fi
if echo "$LOGS_BODY" | grep -q "$ROUTING_LOG_ID"; then
  echo "[OK] Routing log found in list"
else
  echo "[WARN] Routing log id not found in first page"
fi
echo ""

echo "=== All router inbound self-test steps passed. ==="
