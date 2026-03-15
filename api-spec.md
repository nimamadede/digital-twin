# 数字分身 - 完整 API 接口文档

> 基础路径: `/api/v1`
> 认证方式: Bearer Token (JWT)
> 内容类型: `application/json`

---

## 目录

1. [用户认证模块 (Auth)](#1-用户认证模块)
2. [用户风格画像模块 (Style)](#2-用户风格画像模块)
3. [智能回复模块 (Reply)](#3-智能回复模块)
4. [平台接入模块 (Platform)](#4-平台接入模块)
5. [联系人管理模块 (Contact)](#5-联系人管理模块)
6. [场景模式模块 (Scene)](#6-场景模式模块)
7. [消息记录模块 (Message)](#7-消息记录模块)
8. [消息路由模块 (MessageRouter)](#8-消息路由模块)
9. [WebSocket 接口](#9-websocket-接口)

---

## 通用说明

### 请求头

| Header | 值 | 说明 |
|--------|-----|------|
| `Authorization` | `Bearer <token>` | JWT 访问令牌（除登录/注册外必传） |
| `Content-Type` | `application/json` | 请求体格式 |
| `X-Request-Id` | UUID | 请求追踪 ID（可选） |

### 通用响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```

### 错误响应格式

```json
{
  "code": 401,
  "message": "Unauthorized",
  "error": "TOKEN_EXPIRED",
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```

### 通用错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `TOKEN_EXPIRED` | 401 | Token 已过期 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页条数 (最大100) |

### 分页响应

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

---

## 1. 用户认证模块

> 功能需求: F001
> 路由前缀: `/api/v1/auth`

### 1.1 用户注册

```
POST /api/v1/auth/register
```

**请求体:**

```json
{
  "phone": "13800138000",
  "password": "MySecurePass123!",
  "nickname": "小明",
  "verifyCode": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号 (正则: `/^1[3-9]\d{9}$/`) |
| password | string | 是 | 密码 (8-32位, 含大小写+数字) |
| nickname | string | 是 | 昵称 (2-20字符) |
| verifyCode | string | 是 | 短信验证码 (6位数字) |

**成功响应 (201):**

```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "userId": "uuid-string",
    "phone": "138****8000",
    "nickname": "小明",
    "createdAt": "2026-03-14T10:00:00.000Z"
  }
}
```

**错误响应:**

| 错误码 | 说明 |
|--------|------|
| `PHONE_ALREADY_EXISTS` | 手机号已注册 |
| `INVALID_VERIFY_CODE` | 验证码错误或已过期 |

---

### 1.2 发送短信验证码

```
POST /api/v1/auth/sms/send
```

**请求体:**

```json
{
  "phone": "13800138000",
  "purpose": "register"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号 |
| purpose | string | 是 | 用途: `register` / `login` / `reset_password` |

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "验证码已发送",
  "data": {
    "expireIn": 300
  }
}
```

---

### 1.3 用户登录

```
POST /api/v1/auth/login
```

**请求体:**

```json
{
  "phone": "13800138000",
  "password": "MySecurePass123!"
}
```

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "user": {
      "id": "uuid-string",
      "phone": "138****8000",
      "nickname": "小明",
      "avatarUrl": "https://...",
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  }
}
```

---

### 1.4 刷新 Token

```
POST /api/v1/auth/refresh
```

**请求体:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

---

### 1.5 退出登录

```
POST /api/v1/auth/logout
🔒 需要认证
```

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "已退出登录"
}
```

---

### 1.6 获取当前用户信息

```
GET /api/v1/auth/me
🔒 需要认证
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "id": "uuid-string",
    "phone": "138****8000",
    "nickname": "小明",
    "avatarUrl": "https://...",
    "status": "active",
    "createdAt": "2026-03-14T10:00:00.000Z",
    "settings": {
      "defaultSceneId": "uuid-string",
      "autoReply": true,
      "notificationEnabled": true
    }
  }
}
```

---

### 1.7 修改密码

```
PUT /api/v1/auth/password
🔒 需要认证
```

**请求体:**

```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

---

## 2. 用户风格画像模块

> 功能需求: F002, F003
> 路由前缀: `/api/v1/styles`
> 🔒 所有接口需要认证

### 2.1 上传聊天数据文件

```
POST /api/v1/styles/upload
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 聊天记录文件 (.txt, .csv, .json, 最大 50MB) |
| platform | string | 是 | 来源平台: `wechat` / `douyin` / `other` |
| description | string | 否 | 文件描述 |

**成功响应 (201):**

```json
{
  "code": 201,
  "message": "文件上传成功，分析任务已创建",
  "data": {
    "fileId": "uuid-string",
    "fileName": "wechat_export_2026.txt",
    "fileSize": 1024000,
    "taskId": "uuid-string",
    "status": "pending"
  }
}
```

---

### 2.2 查询分析任务状态

```
GET /api/v1/styles/tasks/:taskId
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "taskId": "uuid-string",
    "status": "processing",
    "progress": 65,
    "startedAt": "2026-03-14T10:00:00.000Z",
    "estimatedCompletion": "2026-03-14T10:00:30.000Z"
  }
}
```

| status 值 | 说明 |
|-----------|------|
| `pending` | 等待处理 |
| `processing` | 分析中 |
| `completed` | 分析完成 |
| `failed` | 分析失败 |

---

### 2.3 获取风格画像列表

```
GET /api/v1/styles/profiles
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid-string",
        "name": "日常聊天风格",
        "description": "轻松随意的日常聊天方式",
        "traits": {
          "formality": 0.3,
          "humor": 0.7,
          "verbosity": 0.5,
          "emoji_frequency": 0.6,
          "response_length": "medium",
          "tone": "casual",
          "vocabulary_richness": 0.65,
          "keywords": ["哈哈", "好的", "嗯嗯"]
        },
        "sampleCount": 150,
        "status": "active",
        "createdAt": "2026-03-14T10:00:00.000Z",
        "updatedAt": "2026-03-14T12:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

### 2.4 获取风格画像详情

```
GET /api/v1/styles/profiles/:profileId
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "id": "uuid-string",
    "name": "日常聊天风格",
    "description": "轻松随意的日常聊天方式",
    "traits": {
      "formality": 0.3,
      "humor": 0.7,
      "verbosity": 0.5,
      "emoji_frequency": 0.6,
      "response_length": "medium",
      "tone": "casual",
      "vocabulary_richness": 0.65,
      "keywords": ["哈哈", "好的", "嗯嗯"],
      "sentence_patterns": ["...吧", "...呢", "哈哈哈"]
    },
    "samples": [
      {
        "id": "uuid-string",
        "content": "哈哈好的，那我们明天见吧",
        "platform": "wechat",
        "createdAt": "2026-03-14T10:00:00.000Z"
      }
    ],
    "sampleCount": 150,
    "status": "active",
    "createdAt": "2026-03-14T10:00:00.000Z"
  }
}
```

---

### 2.5 更新风格画像

```
PUT /api/v1/styles/profiles/:profileId
```

**请求体:**

```json
{
  "name": "工作聊天风格",
  "description": "正式的工作沟通风格",
  "traits": {
    "formality": 0.8,
    "humor": 0.2
  }
}
```

---

### 2.6 删除风格画像

```
DELETE /api/v1/styles/profiles/:profileId
```

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "风格画像已删除"
}
```

---

### 2.7 重新分析风格

```
POST /api/v1/styles/profiles/:profileId/reanalyze
```

**说明:** 基于已有样本重新进行风格分析，返回新的任务 ID。

**成功响应 (202):**

```json
{
  "code": 202,
  "message": "重新分析任务已创建",
  "data": {
    "taskId": "uuid-string"
  }
}
```

---

## 3. 智能回复模块

> 功能需求: F004, F005
> 路由前缀: `/api/v1/replies`
> 🔒 所有接口需要认证

### 3.1 生成回复（手动触发）

```
POST /api/v1/replies/generate
```

**请求体:**

```json
{
  "incomingMessage": "明天下午有时间吗？想约你喝咖啡",
  "contactId": "uuid-string",
  "profileId": "uuid-string",
  "sceneId": "uuid-string",
  "context": [
    {
      "role": "contact",
      "content": "最近在忙什么呀",
      "timestamp": "2026-03-14T09:00:00.000Z"
    },
    {
      "role": "user",
      "content": "在搞一个新项目",
      "timestamp": "2026-03-14T09:01:00.000Z"
    }
  ],
  "count": 3
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| incomingMessage | string | 是 | 收到的消息内容 |
| contactId | string | 否 | 联系人 ID（用于个性化） |
| profileId | string | 否 | 风格画像 ID（不传则用默认） |
| sceneId | string | 否 | 场景模式 ID（不传则用当前活跃场景） |
| context | array | 否 | 上下文对话历史（最近 N 条） |
| count | number | 否 | 生成候选回复数量 (1-5, 默认3) |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "replyId": "uuid-string",
    "candidates": [
      {
        "index": 0,
        "content": "好呀！明天下午没事，几点呢？去老地方？",
        "confidence": 0.92
      },
      {
        "index": 1,
        "content": "可以呀，明天下午三四点钟？",
        "confidence": 0.85
      },
      {
        "index": 2,
        "content": "行啊，明天下午有空，你定地方吧～",
        "confidence": 0.80
      }
    ],
    "profileUsed": "uuid-string",
    "sceneUsed": "uuid-string"
  }
}
```

---

### 3.2 获取待审核回复列表

```
GET /api/v1/replies/pending
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| contactId | string | 按联系人筛选 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid-string",
        "incomingMessage": "明天有时间吗？",
        "candidates": [
          {
            "index": 0,
            "content": "有啊，什么事？",
            "confidence": 0.90
          }
        ],
        "contact": {
          "id": "uuid-string",
          "nickname": "张三",
          "platform": "wechat"
        },
        "createdAt": "2026-03-14T10:00:00.000Z",
        "expiresAt": "2026-03-14T10:05:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

### 3.3 审核回复（通过/拒绝/编辑）

```
POST /api/v1/replies/:replyId/review
```

**请求体:**

```json
{
  "action": "approve",
  "selectedIndex": 0,
  "editedContent": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | `approve` / `reject` / `edit` |
| selectedIndex | number | 条件 | 选择的候选回复序号 (action=approve 时必填) |
| editedContent | string | 条件 | 编辑后的内容 (action=edit 时必填) |

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "回复已发送",
  "data": {
    "replyId": "uuid-string",
    "status": "sent",
    "sentContent": "好呀！明天下午没事，几点呢？去老地方？",
    "sentAt": "2026-03-14T10:01:00.000Z"
  }
}
```

---

### 3.4 提交回复反馈

```
POST /api/v1/replies/:replyId/feedback
```

**请求体:**

```json
{
  "rating": 4,
  "feedback": "tone_mismatch",
  "comment": "语气稍微正式了一些"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rating | number | 是 | 评分 (1-5) |
| feedback | string | 否 | 反馈标签: `tone_mismatch` / `too_long` / `too_short` / `inappropriate` / `perfect` |
| comment | string | 否 | 文字反馈 |

---

### 3.5 获取回复历史

```
GET /api/v1/replies/history
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| contactId | string | 按联系人筛选 |
| status | string | 按状态筛选: `sent` / `rejected` / `expired` |
| startDate | string | 起始日期 (ISO 8601) |
| endDate | string | 结束日期 (ISO 8601) |

---

## 4. 平台接入模块

> 功能需求: F006
> 路由前缀: `/api/v1/platforms`
> 🔒 所有接口需要认证

### 4.1 获取已接入平台列表

```
GET /api/v1/platforms
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": [
    {
      "id": "uuid-string",
      "platform": "wechat",
      "displayName": "微信",
      "status": "connected",
      "accountInfo": {
        "nickname": "小明的微信",
        "avatar": "https://..."
      },
      "connectedAt": "2026-03-14T10:00:00.000Z",
      "lastActiveAt": "2026-03-14T15:00:00.000Z"
    }
  ]
}
```

---

### 4.2 发起平台授权

```
POST /api/v1/platforms/authorize
```

**请求体:**

```json
{
  "platform": "wechat",
  "authType": "qrcode"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 是 | 平台标识: `wechat` / `douyin` |
| authType | string | 是 | 授权方式: `qrcode` / `token` |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "authId": "uuid-string",
    "qrcodeUrl": "https://...",
    "expiresIn": 300,
    "status": "waiting_scan"
  }
}
```

---

### 4.3 查询授权状态

```
GET /api/v1/platforms/authorize/:authId/status
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "authId": "uuid-string",
    "status": "confirmed",
    "platformAuthId": "uuid-string"
  }
}
```

| status 值 | 说明 |
|-----------|------|
| `waiting_scan` | 等待扫码 |
| `scanned` | 已扫码，等待确认 |
| `confirmed` | 授权成功 |
| `expired` | 已过期 |
| `failed` | 授权失败 |

---

### 4.4 断开平台连接

```
DELETE /api/v1/platforms/:platformAuthId
```

---

### 4.5 更新平台配置

```
PUT /api/v1/platforms/:platformAuthId
```

**请求体:**

```json
{
  "autoListen": true,
  "listenGroups": false,
  "messageTypes": ["text", "image"]
}
```

---

### 4.6 获取平台消息监听状态

```
GET /api/v1/platforms/:platformAuthId/listener
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "isListening": true,
    "startedAt": "2026-03-14T10:00:00.000Z",
    "messagesReceived": 42,
    "messagesProcessed": 38,
    "errors": 0
  }
}
```

---

### 4.7 启动/停止消息监听

```
POST /api/v1/platforms/:platformAuthId/listener/start
POST /api/v1/platforms/:platformAuthId/listener/stop
```

---

## 5. 联系人管理模块

> 功能需求: F007
> 路由前缀: `/api/v1/contacts`
> 🔒 所有接口需要认证

### 5.1 获取联系人列表

```
GET /api/v1/contacts
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| platform | string | 按平台筛选 |
| level | string | 按等级筛选: `important` / `normal` / `low` |
| isWhitelist | boolean | 仅白名单 |
| isBlacklist | boolean | 仅黑名单 |
| keyword | string | 搜索昵称 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid-string",
        "platformId": "wxid_xxx",
        "platform": "wechat",
        "nickname": "张三",
        "remark": "同事",
        "avatar": "https://...",
        "level": "important",
        "isWhitelist": true,
        "isBlacklist": false,
        "tags": ["同事", "技术部"],
        "lastMessageAt": "2026-03-14T15:00:00.000Z",
        "messageCount": 128,
        "createdAt": "2026-03-14T10:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

---

### 5.2 获取联系人详情

```
GET /api/v1/contacts/:contactId
```

---

### 5.3 更新联系人信息

```
PUT /api/v1/contacts/:contactId
```

**请求体:**

```json
{
  "level": "important",
  "isWhitelist": true,
  "isBlacklist": false,
  "remark": "重要客户",
  "tags": ["客户", "VIP"],
  "customReplyProfile": "uuid-string",
  "notes": "需要特别注意回复语气"
}
```

---

### 5.4 批量更新联系人

```
PUT /api/v1/contacts/batch
```

**请求体:**

```json
{
  "contactIds": ["uuid-1", "uuid-2", "uuid-3"],
  "updates": {
    "level": "normal",
    "isWhitelist": false
  }
}
```

---

### 5.5 添加/移出白名单

```
POST /api/v1/contacts/:contactId/whitelist
DELETE /api/v1/contacts/:contactId/whitelist
```

---

### 5.6 添加/移出黑名单

```
POST /api/v1/contacts/:contactId/blacklist
DELETE /api/v1/contacts/:contactId/blacklist
```

---

### 5.7 从平台同步联系人

```
POST /api/v1/contacts/sync
```

**请求体:**

```json
{
  "platformAuthId": "uuid-string"
}
```

**成功响应 (202):**

```json
{
  "code": 202,
  "message": "同步任务已创建",
  "data": {
    "taskId": "uuid-string",
    "estimatedCount": 200
  }
}
```

---

## 6. 场景模式模块

> 功能需求: F008
> 路由前缀: `/api/v1/scenes`
> 🔒 所有接口需要认证

### 6.1 获取场景列表

```
GET /api/v1/scenes
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": [
    {
      "id": "uuid-string",
      "name": "工作模式",
      "description": "工作时间自动回复，语气正式",
      "replyStyle": "formal",
      "autoReply": true,
      "isActive": true,
      "rules": {
        "schedule": {
          "enabled": true,
          "startTime": "09:00",
          "endTime": "18:00",
          "weekdays": [1, 2, 3, 4, 5]
        },
        "contactLevels": ["important", "normal"],
        "platforms": ["wechat"],
        "autoApprove": false,
        "maxReplyDelay": 30,
        "excludeKeywords": ["转账", "红包"]
      },
      "profileId": "uuid-string",
      "createdAt": "2026-03-14T10:00:00.000Z"
    },
    {
      "id": "uuid-string",
      "name": "休息模式",
      "description": "下班后简短回复",
      "replyStyle": "casual",
      "autoReply": true,
      "isActive": false,
      "rules": {
        "schedule": {
          "enabled": true,
          "startTime": "18:00",
          "endTime": "09:00",
          "weekdays": [1, 2, 3, 4, 5, 6, 7]
        },
        "contactLevels": ["important"],
        "autoApprove": true,
        "maxReplyDelay": 120
      },
      "profileId": "uuid-string",
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  ]
}
```

---

### 6.2 创建场景

```
POST /api/v1/scenes
```

**请求体:**

```json
{
  "name": "会议模式",
  "description": "会议期间统一回复稍后联系",
  "replyStyle": "brief",
  "autoReply": true,
  "rules": {
    "schedule": {
      "enabled": false
    },
    "contactLevels": ["important", "normal", "low"],
    "autoApprove": true,
    "customPrompt": "简短回复对方稍后联系，语气友好",
    "maxReplyDelay": 5
  },
  "profileId": "uuid-string"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 场景名称 (2-30字符) |
| description | string | 否 | 场景描述 |
| replyStyle | string | 是 | 回复风格: `formal` / `casual` / `brief` / `humorous` / `custom` |
| autoReply | boolean | 是 | 是否自动回复 |
| rules | object | 是 | 场景规则配置 |
| profileId | string | 否 | 关联风格画像 ID |

---

### 6.3 更新场景

```
PUT /api/v1/scenes/:sceneId
```

---

### 6.4 删除场景

```
DELETE /api/v1/scenes/:sceneId
```

---

### 6.5 激活/切换场景

```
POST /api/v1/scenes/:sceneId/activate
```

**说明:** 激活指定场景，自动停用当前活跃的同类场景。

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "场景已激活",
  "data": {
    "activatedScene": "uuid-string",
    "deactivatedScene": "uuid-string-old"
  }
}
```

---

### 6.6 停用场景

```
POST /api/v1/scenes/:sceneId/deactivate
```

---

### 6.7 获取当前活跃场景

```
GET /api/v1/scenes/active
```

---

## 7. 消息记录模块

> 功能需求: F009
> 路由前缀: `/api/v1/messages`
> 🔒 所有接口需要认证

### 7.1 获取消息列表

```
GET /api/v1/messages
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| contactId | string | 按联系人筛选 |
| platform | string | 按平台筛选 |
| direction | string | 消息方向: `incoming` / `outgoing` |
| msgType | string | 消息类型: `text` / `image` / `voice` / `file` |
| startDate | string | 起始日期 |
| endDate | string | 结束日期 |
| keyword | string | 内容搜索关键词 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid-string",
        "contactId": "uuid-string",
        "contactNickname": "张三",
        "direction": "incoming",
        "content": "明天下午有时间吗？",
        "msgType": "text",
        "platform": "wechat",
        "isAiGenerated": false,
        "replyRecordId": null,
        "createdAt": "2026-03-14T10:00:00.000Z"
      },
      {
        "id": "uuid-string",
        "contactId": "uuid-string",
        "contactNickname": "张三",
        "direction": "outgoing",
        "content": "有啊，什么事？",
        "msgType": "text",
        "platform": "wechat",
        "isAiGenerated": true,
        "replyRecordId": "uuid-string",
        "createdAt": "2026-03-14T10:00:05.000Z"
      }
    ],
    "total": 200,
    "page": 1,
    "pageSize": 20,
    "totalPages": 10
  }
}
```

---

### 7.2 获取与联系人的对话详情

```
GET /api/v1/messages/conversations/:contactId
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 (默认50) |
| before | string | 加载此时间之前的消息 (用于无限滚动) |

---

### 7.3 获取对话列表（最近会话）

```
GET /api/v1/messages/conversations
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "contactId": "uuid-string",
        "contactNickname": "张三",
        "contactAvatar": "https://...",
        "platform": "wechat",
        "lastMessage": {
          "content": "好的，明天见！",
          "direction": "outgoing",
          "isAiGenerated": true,
          "createdAt": "2026-03-14T15:00:00.000Z"
        },
        "unreadCount": 0,
        "totalMessages": 128
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

---

### 7.4 获取消息统计

```
GET /api/v1/messages/stats
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | 统计周期: `day` / `week` / `month` |
| startDate | string | 起始日期 |
| endDate | string | 结束日期 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "summary": {
      "totalMessages": 1500,
      "incomingMessages": 800,
      "outgoingMessages": 700,
      "aiGeneratedReplies": 600,
      "manualReplies": 100,
      "autoApproveRate": 0.85,
      "avgResponseTime": 12.5,
      "feedbackAvgRating": 4.2
    },
    "timeline": [
      {
        "date": "2026-03-14",
        "incoming": 42,
        "outgoing": 38,
        "aiGenerated": 35
      },
      {
        "date": "2026-03-13",
        "incoming": 55,
        "outgoing": 50,
        "aiGenerated": 45
      }
    ],
    "topContacts": [
      {
        "contactId": "uuid-string",
        "nickname": "张三",
        "messageCount": 128
      }
    ]
  }
}
```

---

### 7.5 导出消息记录

```
POST /api/v1/messages/export
```

**请求体:**

```json
{
  "contactId": "uuid-string",
  "startDate": "2026-03-01",
  "endDate": "2026-03-14",
  "format": "csv"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contactId | string | 否 | 联系人 ID（不传则导出全部） |
| startDate | string | 否 | 起始日期 |
| endDate | string | 否 | 结束日期 |
| format | string | 是 | 导出格式: `csv` / `json` |

**成功响应 (202):**

```json
{
  "code": 202,
  "message": "导出任务已创建",
  "data": {
    "taskId": "uuid-string",
    "estimatedTime": 10
  }
}
```

---

### 7.6 获取导出文件下载链接

```
GET /api/v1/messages/export/:taskId
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "taskId": "uuid-string",
    "status": "completed",
    "downloadUrl": "https://...",
    "expiresAt": "2026-03-15T10:00:00.000Z",
    "fileSize": 102400
  }
}
```

---

## 8. 消息路由模块

> 系统核心调度枢纽 — 负责将平台收到的消息按规则路由至 AI 回复引擎或人工处理
> 路由前缀: `/api/v1/router`
> 🔒 所有接口需要认证

### 8.1 获取路由仪表盘

```
GET /api/v1/router/dashboard
```

**说明:** 返回消息路由系统的实时运行状态总览。

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "status": "running",
    "activeSceneId": "uuid-string",
    "activeSceneName": "工作模式",
    "today": {
      "totalReceived": 85,
      "autoReplied": 60,
      "pendingReview": 5,
      "manualReplied": 12,
      "rejected": 3,
      "expired": 2,
      "blocked": 3
    },
    "queueDepth": 2,
    "avgResponseTime": 3.5,
    "connectedPlatforms": [
      {
        "platform": "wechat",
        "status": "listening",
        "messagesReceived": 85
      }
    ]
  }
}
```

---

### 8.2 获取路由日志列表

```
GET /api/v1/router/logs
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| contactId | string | 按联系人筛选 |
| action | string | 按路由结果筛选: `auto_reply` / `pending_review` / `blocked` / `ignored` / `manual` |
| sceneId | string | 按场景筛选 |
| startDate | string | 起始日期 |
| endDate | string | 结束日期 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid-string",
        "messageId": "uuid-string",
        "contactId": "uuid-string",
        "contactNickname": "张三",
        "platform": "wechat",
        "incomingContent": "明天有时间吗？",
        "action": "auto_reply",
        "reason": "whitelist_auto_approve",
        "sceneId": "uuid-string",
        "sceneName": "工作模式",
        "profileId": "uuid-string",
        "replyRecordId": "uuid-string",
        "replySentContent": "有啊，什么事？",
        "processingTime": 2800,
        "steps": [
          { "step": "receive", "result": "ok", "duration": 5 },
          { "step": "contact_lookup", "result": "found", "duration": 12 },
          { "step": "blacklist_check", "result": "pass", "duration": 2 },
          { "step": "scene_match", "result": "工作模式", "duration": 8 },
          { "step": "rule_evaluate", "result": "auto_reply", "duration": 3 },
          { "step": "reply_generate", "result": "3 candidates", "duration": 2500 },
          { "step": "auto_approve", "result": "approved", "duration": 5 },
          { "step": "send", "result": "sent", "duration": 265 }
        ],
        "createdAt": "2026-03-14T10:00:00.000Z"
      }
    ],
    "total": 85,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

---

### 8.3 获取路由日志详情

```
GET /api/v1/router/logs/:logId
```

**成功响应 (200):**

返回与 8.2 列表项相同的结构，但 `steps` 中包含更详细的中间数据（如场景规则匹配详情、AI prompt 摘要等）。

---

### 8.4 获取路由规则列表

```
GET /api/v1/router/rules
```

**说明:** 返回当前用户的所有路由规则，按优先级排序。路由规则决定收到消息后的处理策略。

**成功响应 (200):**

```json
{
  "code": 200,
  "data": [
    {
      "id": "uuid-string",
      "name": "黑名单拦截",
      "priority": 1,
      "isEnabled": true,
      "type": "block",
      "conditions": {
        "contact": { "isBlacklist": true }
      },
      "action": "blocked",
      "isSystem": true,
      "createdAt": "2026-03-14T10:00:00.000Z"
    },
    {
      "id": "uuid-string",
      "name": "关键词拦截",
      "priority": 2,
      "isEnabled": true,
      "type": "block",
      "conditions": {
        "message": { "containsKeywords": ["转账", "红包", "借钱"] }
      },
      "action": "blocked",
      "actionConfig": {
        "notifyUser": true
      },
      "isSystem": false,
      "createdAt": "2026-03-14T10:00:00.000Z"
    },
    {
      "id": "uuid-string",
      "name": "重要联系人优先审核",
      "priority": 10,
      "isEnabled": true,
      "type": "route",
      "conditions": {
        "contact": { "level": "important" },
        "scene": { "autoApprove": false }
      },
      "action": "pending_review",
      "actionConfig": {
        "notifyUser": true,
        "timeout": 300,
        "timeoutAction": "auto_approve"
      },
      "isSystem": false,
      "createdAt": "2026-03-14T10:00:00.000Z"
    },
    {
      "id": "uuid-string",
      "name": "白名单自动回复",
      "priority": 20,
      "isEnabled": true,
      "type": "route",
      "conditions": {
        "contact": { "isWhitelist": true }
      },
      "action": "auto_reply",
      "actionConfig": {
        "autoApprove": true,
        "maxDelay": 5
      },
      "isSystem": false,
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  ]
}
```

---

### 8.5 创建路由规则

```
POST /api/v1/router/rules
```

**请求体:**

```json
{
  "name": "工作群消息忽略",
  "priority": 5,
  "isEnabled": true,
  "type": "block",
  "conditions": {
    "message": { "isGroup": true },
    "platform": { "in": ["wechat"] }
  },
  "action": "ignored",
  "actionConfig": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 规则名称 (2-50字符) |
| priority | number | 是 | 优先级 (1-100，数字越小优先级越高) |
| isEnabled | boolean | 是 | 是否启用 |
| type | string | 是 | 规则类型: `block` / `route` / `transform` |
| conditions | object | 是 | 匹配条件 (见下方) |
| action | string | 是 | 路由动作: `auto_reply` / `pending_review` / `blocked` / `ignored` / `manual` |
| actionConfig | object | 否 | 动作配置 |

**conditions 结构说明:**

```json
{
  "contact": {
    "level": "important",        // 联系人等级匹配
    "isWhitelist": true,         // 白名单匹配
    "isBlacklist": false,        // 黑名单匹配
    "tags": ["客户"]             // 标签匹配 (任一命中)
  },
  "message": {
    "containsKeywords": ["转账"], // 关键词匹配 (任一命中)
    "msgType": "text",           // 消息类型匹配
    "isGroup": false,            // 是否群消息
    "lengthMin": 0,              // 最小长度
    "lengthMax": 500             // 最大长度
  },
  "platform": {
    "in": ["wechat", "douyin"]   // 平台匹配
  },
  "time": {
    "startTime": "09:00",        // 时间段匹配
    "endTime": "18:00",
    "weekdays": [1, 2, 3, 4, 5]
  }
}
```

**成功响应 (201):**

```json
{
  "code": 201,
  "message": "路由规则已创建",
  "data": {
    "id": "uuid-string",
    "name": "工作群消息忽略",
    "priority": 5
  }
}
```

---

### 8.6 更新路由规则

```
PUT /api/v1/router/rules/:ruleId
```

**请求体:** 同 8.5 创建，所有字段均为可选。

---

### 8.7 删除路由规则

```
DELETE /api/v1/router/rules/:ruleId
```

**说明:** 系统内置规则 (`isSystem: true`) 不可删除，只能启用/禁用。

---

### 8.8 调整规则优先级

```
PUT /api/v1/router/rules/reorder
```

**请求体:**

```json
{
  "orderedIds": ["uuid-1", "uuid-2", "uuid-3", "uuid-4"]
}
```

**说明:** 按数组顺序重新分配优先级 (1, 2, 3, ...)。

---

### 8.9 模拟路由测试

```
POST /api/v1/router/simulate
```

**说明:** 不实际发送消息，仅模拟路由逻辑并返回每一步的判定结果，用于调试规则配置。

**请求体:**

```json
{
  "contactId": "uuid-string",
  "incomingMessage": "明天下午有时间吗？",
  "platform": "wechat",
  "msgType": "text",
  "simulateTime": "2026-03-14T14:30:00.000Z"
}
```

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "finalAction": "auto_reply",
    "matchedRuleId": "uuid-string",
    "matchedRuleName": "白名单自动回复",
    "sceneId": "uuid-string",
    "sceneName": "工作模式",
    "profileId": "uuid-string",
    "steps": [
      { "step": "contact_lookup", "result": "found", "detail": { "level": "important", "isWhitelist": true } },
      { "step": "rule_1_黑名单拦截", "result": "skip", "detail": "isBlacklist=false" },
      { "step": "rule_2_关键词拦截", "result": "skip", "detail": "no keyword match" },
      { "step": "rule_3_白名单自动回复", "result": "matched", "detail": "isWhitelist=true" },
      { "step": "scene_match", "result": "工作模式", "detail": { "timeMatch": true, "weekdayMatch": true } },
      { "step": "final_decision", "result": "auto_reply with auto_approve" }
    ]
  }
}
```

---

### 8.10 暂停/恢复路由

```
POST /api/v1/router/pause
POST /api/v1/router/resume
```

**说明:** 暂停路由后，所有收到的消息只存储不处理，恢复后按队列顺序重新处理。

**成功响应 (200):**

```json
{
  "code": 200,
  "message": "消息路由已暂停",
  "data": {
    "status": "paused",
    "pausedAt": "2026-03-14T10:00:00.000Z",
    "pendingMessages": 0
  }
}
```

---

### 8.11 获取路由统计

```
GET /api/v1/router/stats
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | `day` / `week` / `month` |
| startDate | string | 起始日期 |
| endDate | string | 结束日期 |

**成功响应 (200):**

```json
{
  "code": 200,
  "data": {
    "summary": {
      "totalProcessed": 1500,
      "autoReplied": 1050,
      "pendingReview": 200,
      "manualReplied": 100,
      "blocked": 80,
      "ignored": 50,
      "expired": 20,
      "avgProcessingTime": 3200,
      "autoApproveRate": 0.70,
      "blockRate": 0.053
    },
    "byAction": [
      { "action": "auto_reply", "count": 1050, "percentage": 0.70 },
      { "action": "pending_review", "count": 200, "percentage": 0.133 },
      { "action": "manual", "count": 100, "percentage": 0.067 },
      { "action": "blocked", "count": 80, "percentage": 0.053 },
      { "action": "ignored", "count": 50, "percentage": 0.033 },
      { "action": "expired", "count": 20, "percentage": 0.013 }
    ],
    "byPlatform": [
      { "platform": "wechat", "count": 1300 },
      { "platform": "douyin", "count": 200 }
    ],
    "timeline": [
      { "date": "2026-03-14", "received": 85, "autoReplied": 60, "blocked": 3 },
      { "date": "2026-03-13", "received": 102, "autoReplied": 75, "blocked": 5 }
    ],
    "topTriggeredRules": [
      { "ruleId": "uuid", "ruleName": "白名单自动回复", "triggerCount": 800 },
      { "ruleId": "uuid", "ruleName": "黑名单拦截", "triggerCount": 80 }
    ]
  }
}
```

---

## 9. WebSocket 接口

> 连接地址: `wss://<host>/ws`
> 认证方式: 连接时传递 JWT Token

### 8.1 连接建立

```javascript
const socket = io('wss://api.example.com/ws', {
  auth: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIs...'
  }
});
```

### 8.2 事件列表

#### 服务端 → 客户端

| 事件名 | 说明 | Payload |
|--------|------|---------|
| `message:received` | 收到新消息 | 见下方 |
| `reply:generated` | AI 回复已生成（待审核） | 见下方 |
| `reply:sent` | 回复已发送 | 见下方 |
| `style:analysis:progress` | 风格分析进度更新 | 见下方 |
| `style:analysis:completed` | 风格分析完成 | 见下方 |
| `platform:status` | 平台连接状态变更 | 见下方 |
| `notification` | 系统通知 | 见下方 |

#### 客户端 → 服务端

| 事件名 | 说明 | Payload |
|--------|------|---------|
| `reply:approve` | 审核通过回复 | `{ replyId, selectedIndex }` |
| `reply:reject` | 拒绝回复 | `{ replyId }` |
| `reply:edit` | 编辑后发送 | `{ replyId, content }` |
| `scene:switch` | 快速切换场景 | `{ sceneId }` |

### 8.3 事件 Payload 示例

**message:received**

```json
{
  "messageId": "uuid-string",
  "contactId": "uuid-string",
  "contactNickname": "张三",
  "content": "在吗？",
  "platform": "wechat",
  "msgType": "text",
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```

**reply:generated**

```json
{
  "replyId": "uuid-string",
  "messageId": "uuid-string",
  "contactNickname": "张三",
  "incomingMessage": "在吗？",
  "candidates": [
    { "index": 0, "content": "在的，怎么了？", "confidence": 0.92 },
    { "index": 1, "content": "在呢，什么事？", "confidence": 0.88 }
  ],
  "autoApprove": false,
  "expiresAt": "2026-03-14T10:05:00.000Z"
}
```

**style:analysis:progress**

```json
{
  "taskId": "uuid-string",
  "progress": 65,
  "stage": "extracting_features",
  "message": "正在提取语言特征..."
}
```

**platform:status**

```json
{
  "platformAuthId": "uuid-string",
  "platform": "wechat",
  "status": "disconnected",
  "reason": "token_expired",
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```

**notification**

```json
{
  "id": "uuid-string",
  "type": "warning",
  "title": "微信连接断开",
  "content": "您的微信连接已断开，请重新扫码授权",
  "actionUrl": "/platforms",
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```
