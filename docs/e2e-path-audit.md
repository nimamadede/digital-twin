# Inbound → Router → Reply → Platform Send (path audit)

> Action 1 of execution plan. Updated: 2026-04-06.

## Intended path

1. **Platform inbound**: WeCom/connector receives a message (webhook or poll).
2. **Normalize & route**: `MessageRouterService.processInboundMessage` (also `POST /api/v1/router/inbound`) creates contact/message, runs `RouteExecutorService`, may trigger reply.
3. **Reply**: `ReplyService.generate` → `ReplyService.review` (auto-approve on `auto_reply`).
4. **Persist outbound**: `MessageService.createOutgoing` stores the sent line in DB.
5. **Platform send**: Third-party API delivers text to the user on the platform.

## Current wiring (code)

| Step | Status | Notes |
|------|--------|--------|
| `POST router/inbound` | OK | Full chain for `auto_reply` / `pending_review` in `message-router.service.ts`. |
| WeCom `POST wecom/callback` | Gap | `WeComConnector.handleMessageCallback` returns `null` (no decrypt, no dispatch to router). |
| Reply DB + AI | OK | `ReplyService` persists candidates; `review` updates status and `sentContent`. |
| Outbound DB record | OK | `createOutgoing` after auto-reply path when `sentContent` is set. |
| **Real platform send** | Partial | `PlatformService.sendOutboundText` + connector `sendTextMessage` stubs (`wechat` / `wecom` / `douyin`); called from `auto_reply` path after DB outbound record. Real qyapi / vendor APIs still TODO in connectors. |

## Secondary gaps

- ~~`MessageRouterService` uses `console.error`~~ — replaced with Nest `Logger`.
- WeCom callback verification and message decryption are TODOs in `wecom.connector.ts`.

## Verification commands

```bash
npm run build
npm test -- --testPathPatterns=message-router
```

## Next action (plan step 5+)

- Second platform: e.g. Douyin `PlatformAuth` on mock OAuth confirm; real OAuth remains TODO.
- WeCom callback: decrypt XML and dispatch into `processInboundMessage` (needs `userId` / tenant mapping strategy).
