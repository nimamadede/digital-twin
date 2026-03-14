#!/usr/bin/env bash
# Self-test: upload a file and get download link.
# Prerequisites: Server running (npm run start:dev), and a user (register with 13800138000 / TestPass123! and verifyCode 123456 in dev).
set -e

BASE="${BASE_URL:-http://localhost:3000}"
API="${BASE}/api/v1"
PHONE="${TEST_PHONE:-13800138000}"
PASS="${TEST_PASSWORD:-TestPass123!}"
TMP="$(mktemp -t storage-e2e.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

echo "=== 1. Login ==="
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN" | node -e "let d=require('fs').readFileSync(0,'utf8'); try { const j=JSON.parse(d); if(j.data&&j.data.accessToken) process.stdout.write(j.data.accessToken); else process.stderr.write(d); process.exit(j.data?.accessToken?0:1); } catch(e){ process.stderr.write(d); process.exit(1); }")
if [ -z "$TOKEN" ]; then
  echo "Login failed. Response: $LOGIN"
  echo "Tip: Register first: POST $API/auth/sms/send {phone, purpose: register}, then POST $API/auth/register {phone, password, nickname, verifyCode: 123456}"
  exit 1
fi
echo "Token obtained."

echo "=== 2. Upload file ==="
echo "hello self-test" > "$TMP"
UPLOAD=$(curl -s -X POST "$API/storage/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TMP;filename=self-test.txt" \
  -F "purpose=style_analysis")
FILE_ID=$(echo "$UPLOAD" | node -e "let d=require('fs').readFileSync(0,'utf8'); try { const j=JSON.parse(d); if(j.data&&j.data.id) process.stdout.write(j.data.id); else { process.stderr.write(d); process.exit(1); } } catch(e){ process.stderr.write(d); process.exit(1); }")
if [ -z "$FILE_ID" ]; then
  echo "Upload failed. Response: $UPLOAD"
  exit 1
fi
echo "FileId: $FILE_ID"

echo "=== 3. Get download URL ==="
DOWNLOAD=$(curl -s -X GET "$API/storage/files/$FILE_ID/download" \
  -H "Authorization: Bearer $TOKEN")
URL=$(echo "$DOWNLOAD" | node -e "let d=require('fs').readFileSync(0,'utf8'); try { const j=JSON.parse(d); if(j.data&&j.data.downloadUrl) process.stdout.write(j.data.downloadUrl); else { process.stderr.write(d); process.exit(1); } } catch(e){ process.stderr.write(d); process.exit(1); }")
if [ -z "$URL" ]; then
  echo "Get download URL failed. Response: $DOWNLOAD"
  exit 1
fi
echo "Download URL: $URL"
echo "=== Self-test passed ==="
