# 数字分身 - 数据库表结构定义

> 数据库: PostgreSQL 16+
> ORM: TypeORM 0.3.x
> 字符集: UTF-8
> 时区: UTC

---

## 目录

1. [users - 用户表](#1-users---用户表)
2. [user_settings - 用户设置表](#2-user_settings---用户设置表)
3. [style_profiles - 风格画像表](#3-style_profiles---风格画像表)
4. [style_samples - 风格样本表](#4-style_samples---风格样本表)
5. [style_tasks - 风格分析任务表](#5-style_tasks---风格分析任务表)
6. [contacts - 联系人表](#6-contacts---联系人表)
7. [platform_auths - 平台授权表](#7-platform_auths---平台授权表)
8. [scene_modes - 场景模式表](#8-scene_modes---场景模式表)
9. [messages - 消息记录表](#9-messages---消息记录表)
10. [reply_records - 回复记录表](#10-reply_records---回复记录表)
11. [notifications - 通知表](#11-notifications---通知表)
12. [routing_logs - 消息路由日志表](#12-routing_logs---消息路由日志表)
13. [routing_rules - 路由规则表](#13-routing_rules---路由规则表)
14. [audit_logs - 审计日志表](#14-audit_logs---审计日志表)
15. [file_uploads - 文件上传表](#15-file_uploads---文件上传表)

---

## 1. users - 用户表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 用户 ID |
| phone | varchar(20) | UNIQUE, NOT NULL | - | 手机号 |
| password_hash | varchar(255) | NOT NULL | - | 密码哈希 (bcrypt) |
| nickname | varchar(50) | NOT NULL | - | 昵称 |
| avatar_url | varchar(500) | NULLABLE | NULL | 头像 URL |
| status | varchar(20) | NOT NULL | `'active'` | 状态: `active` / `disabled` / `deleted` |
| last_login_at | timestamp | NULLABLE | NULL | 最后登录时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_users_phone` | phone | UNIQUE | 手机号唯一索引 |
| `idx_users_status` | status | B-TREE | 状态查询 |

---

## 2. user_settings - 用户设置表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 设置 ID |
| user_id | uuid | FK → users.id, UNIQUE | - | 用户 ID |
| default_scene_id | uuid | FK → scene_modes.id, NULLABLE | NULL | 默认场景 |
| default_profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 默认风格画像 |
| auto_reply | boolean | NOT NULL | `true` | 全局自动回复开关 |
| notification_enabled | boolean | NOT NULL | `true` | 推送通知开关 |
| review_timeout | integer | NOT NULL | `300` | 审核超时时间 (秒) |
| language | varchar(10) | NOT NULL | `'zh-CN'` | 语言偏好 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_user_settings_user_id` | user_id | UNIQUE | 一对一关系 |

---

## 3. style_profiles - 风格画像表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 画像 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| name | varchar(100) | NOT NULL | - | 画像名称 |
| description | text | NULLABLE | NULL | 画像描述 |
| traits | jsonb | NOT NULL | `'{}'` | 风格特征 (见下方结构) |
| vector_collection | varchar(100) | NULLABLE | NULL | Qdrant 集合名 |
| sample_count | integer | NOT NULL | `0` | 样本数量 |
| status | varchar(20) | NOT NULL | `'draft'` | 状态: `draft` / `analyzing` / `active` / `archived` |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**traits JSONB 结构:**

```json
{
  "formality": 0.3,
  "humor": 0.7,
  "verbosity": 0.5,
  "emoji_frequency": 0.6,
  "response_length": "medium",
  "tone": "casual",
  "vocabulary_richness": 0.65,
  "keywords": ["哈哈", "好的"],
  "sentence_patterns": ["...吧", "...呢"],
  "avg_message_length": 25,
  "punctuation_style": "minimal"
}
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_style_profiles_user_id` | user_id | B-TREE | 用户查询 |
| `idx_style_profiles_status` | status | B-TREE | 状态过滤 |
| `idx_style_profiles_user_status` | (user_id, status) | B-TREE | 复合查询 |

---

## 4. style_samples - 风格样本表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 样本 ID |
| profile_id | uuid | FK → style_profiles.id, NOT NULL | - | 所属画像 |
| content | text | NOT NULL | - | 样本内容 |
| platform | varchar(30) | NOT NULL | - | 来源平台 |
| role | varchar(20) | NOT NULL | `'user'` | 角色: `user` / `contact` |
| metadata | jsonb | NULLABLE | NULL | 元数据 (时间戳、对话上下文等) |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_style_samples_profile_id` | profile_id | B-TREE | 画像关联查询 |
| `idx_style_samples_platform` | platform | B-TREE | 平台过滤 |

---

## 5. style_tasks - 风格分析任务表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 任务 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 关联画像 |
| file_id | uuid | FK → file_uploads.id, NULLABLE | NULL | 上传文件 |
| status | varchar(20) | NOT NULL | `'pending'` | 状态: `pending` / `processing` / `completed` / `failed` |
| progress | integer | NOT NULL | `0` | 进度 (0-100) |
| error_message | text | NULLABLE | NULL | 错误信息 |
| started_at | timestamp | NULLABLE | NULL | 开始处理时间 |
| completed_at | timestamp | NULLABLE | NULL | 完成时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_style_tasks_user_id` | user_id | B-TREE | 用户查询 |
| `idx_style_tasks_status` | status | B-TREE | 状态查询（Worker 拉取） |

---

## 6. contacts - 联系人表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 联系人 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| platform_id | varchar(100) | NOT NULL | - | 平台原始 ID (如 wxid_xxx) |
| platform | varchar(30) | NOT NULL | - | 平台: `wechat` / `douyin` / `other` |
| nickname | varchar(100) | NOT NULL | - | 昵称 |
| remark | varchar(100) | NULLABLE | NULL | 备注名 |
| avatar | varchar(500) | NULLABLE | NULL | 头像 URL |
| level | varchar(20) | NOT NULL | `'normal'` | 等级: `important` / `normal` / `low` |
| is_whitelist | boolean | NOT NULL | `false` | 是否在白名单 |
| is_blacklist | boolean | NOT NULL | `false` | 是否在黑名单 |
| tags | jsonb | NOT NULL | `'[]'` | 标签列表 |
| custom_reply_profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 自定义回复画像 |
| notes | text | NULLABLE | NULL | 备注 |
| message_count | integer | NOT NULL | `0` | 消息计数 |
| last_message_at | timestamp | NULLABLE | NULL | 最后消息时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_contacts_user_id` | user_id | B-TREE | 用户查询 |
| `idx_contacts_user_platform` | (user_id, platform) | B-TREE | 平台过滤 |
| `idx_contacts_platform_id` | (user_id, platform_id, platform) | UNIQUE | 平台联系人唯一 |
| `idx_contacts_level` | (user_id, level) | B-TREE | 等级过滤 |
| `idx_contacts_whitelist` | (user_id, is_whitelist) | B-TREE | 白名单查询 |
| `idx_contacts_blacklist` | (user_id, is_blacklist) | B-TREE | 黑名单查询 |
| `idx_contacts_nickname` | nickname | GIN (trigram) | 昵称模糊搜索 |

---

## 7. platform_auths - 平台授权表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 授权 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| platform | varchar(30) | NOT NULL | - | 平台: `wechat` / `douyin` |
| account_nickname | varchar(100) | NULLABLE | NULL | 平台账号昵称 |
| account_avatar | varchar(500) | NULLABLE | NULL | 平台账号头像 |
| access_token | text | NOT NULL | - | 访问令牌 (AES-256-GCM 加密) |
| refresh_token | text | NULLABLE | NULL | 刷新令牌 (AES-256-GCM 加密) |
| token_expires_at | timestamp | NULLABLE | NULL | Token 过期时间 |
| status | varchar(20) | NOT NULL | `'connected'` | 状态: `connected` / `disconnected` / `expired` / `revoked` |
| config | jsonb | NOT NULL | `'{}'` | 平台配置 |
| last_active_at | timestamp | NULLABLE | NULL | 最后活跃时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**config JSONB 结构:**

```json
{
  "autoListen": true,
  "listenGroups": false,
  "messageTypes": ["text", "image"]
}
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_platform_auths_user_id` | user_id | B-TREE | 用户查询 |
| `idx_platform_auths_user_platform` | (user_id, platform) | B-TREE | 复合查询 |
| `idx_platform_auths_status` | status | B-TREE | 状态过滤 |

---

## 8. scene_modes - 场景模式表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 场景 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| name | varchar(100) | NOT NULL | - | 场景名称 |
| description | text | NULLABLE | NULL | 场景描述 |
| reply_style | varchar(30) | NOT NULL | `'casual'` | 回复风格: `formal` / `casual` / `brief` / `humorous` / `custom` |
| auto_reply | boolean | NOT NULL | `true` | 是否自动回复 |
| is_active | boolean | NOT NULL | `false` | 是否激活 |
| rules | jsonb | NOT NULL | `'{}'` | 场景规则 (见下方结构) |
| profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 关联风格画像 |
| sort_order | integer | NOT NULL | `0` | 排序序号 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**rules JSONB 结构:**

```json
{
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
  "excludeKeywords": ["转账", "红包"],
  "customPrompt": ""
}
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_scene_modes_user_id` | user_id | B-TREE | 用户查询 |
| `idx_scene_modes_user_active` | (user_id, is_active) | B-TREE | 获取活跃场景 |

---

## 9. messages - 消息记录表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 消息 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| contact_id | uuid | FK → contacts.id, NOT NULL | - | 关联联系人 |
| direction | varchar(10) | NOT NULL | - | 方向: `incoming` / `outgoing` |
| content | text | NOT NULL | - | 消息内容 |
| msg_type | varchar(20) | NOT NULL | `'text'` | 类型: `text` / `image` / `voice` / `file` / `system` |
| platform | varchar(30) | NOT NULL | - | 来源平台 |
| platform_msg_id | varchar(200) | NULLABLE | NULL | 平台原始消息 ID |
| is_ai_generated | boolean | NOT NULL | `false` | 是否 AI 生成 |
| reply_record_id | uuid | FK → reply_records.id, NULLABLE | NULL | 关联回复记录 |
| metadata | jsonb | NULLABLE | NULL | 扩展元数据 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 消息时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_messages_user_id` | user_id | B-TREE | 用户查询 |
| `idx_messages_contact_id` | (user_id, contact_id) | B-TREE | 联系人会话 |
| `idx_messages_user_created` | (user_id, created_at DESC) | B-TREE | 时间线查询 |
| `idx_messages_platform` | (user_id, platform) | B-TREE | 平台过滤 |
| `idx_messages_direction` | (user_id, direction) | B-TREE | 方向过滤 |
| `idx_messages_contact_created` | (user_id, contact_id, created_at DESC) | B-TREE | 对话详情分页 |
| `idx_messages_content_search` | content | GIN (tsvector) | 全文搜索 |
| `idx_messages_platform_msg_id` | platform_msg_id | B-TREE | 平台消息去重 |

**分区策略 (推荐):**

按月范围分区 `created_at`，保留近 12 个月热数据，历史数据归档至冷存储。

---

## 10. reply_records - 回复记录表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 回复 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| contact_id | uuid | FK → contacts.id, NOT NULL | - | 关联联系人 |
| profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 使用的画像 |
| scene_id | uuid | FK → scene_modes.id, NULLABLE | NULL | 使用的场景 |
| incoming_message_id | uuid | FK → messages.id, NULLABLE | NULL | 触发消息 |
| incoming_content | text | NOT NULL | - | 收到的消息内容 |
| candidates | jsonb | NOT NULL | `'[]'` | 候选回复列表 |
| selected_index | integer | NULLABLE | NULL | 选择的候选序号 |
| sent_content | text | NULLABLE | NULL | 实际发送内容 |
| status | varchar(20) | NOT NULL | `'pending'` | 状态 (见下方) |
| feedback_rating | integer | NULLABLE | NULL | 反馈评分 (1-5) |
| feedback_tag | varchar(30) | NULLABLE | NULL | 反馈标签 |
| feedback_comment | text | NULLABLE | NULL | 反馈文字 |
| reviewed_at | timestamp | NULLABLE | NULL | 审核时间 |
| sent_at | timestamp | NULLABLE | NULL | 发送时间 |
| expires_at | timestamp | NULLABLE | NULL | 超时时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |

**status 取值:**

| 值 | 说明 |
|----|------|
| `pending` | 等待审核 |
| `approved` | 已批准 |
| `rejected` | 已拒绝 |
| `edited` | 已编辑后发送 |
| `sent` | 已发送 |
| `expired` | 已过期 |
| `failed` | 发送失败 |

**candidates JSONB 结构:**

```json
[
  { "index": 0, "content": "好呀！明天下午没事", "confidence": 0.92 },
  { "index": 1, "content": "可以呀，几点呢？", "confidence": 0.85 },
  { "index": 2, "content": "行啊，你定时间吧", "confidence": 0.80 }
]
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_reply_records_user_id` | user_id | B-TREE | 用户查询 |
| `idx_reply_records_status` | (user_id, status) | B-TREE | 待审核列表 |
| `idx_reply_records_contact` | (user_id, contact_id) | B-TREE | 联系人过滤 |
| `idx_reply_records_created` | (user_id, created_at DESC) | B-TREE | 时间线查询 |
| `idx_reply_records_expires` | (status, expires_at) | B-TREE | 超时清理任务 |

---

## 11. notifications - 通知表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 通知 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 接收用户 |
| type | varchar(30) | NOT NULL | - | 类型: `info` / `warning` / `error` / `success` |
| title | varchar(200) | NOT NULL | - | 标题 |
| content | text | NOT NULL | - | 内容 |
| action_url | varchar(500) | NULLABLE | NULL | 跳转链接 |
| is_read | boolean | NOT NULL | `false` | 是否已读 |
| metadata | jsonb | NULLABLE | NULL | 扩展数据 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_notifications_user_id` | user_id | B-TREE | 用户查询 |
| `idx_notifications_user_unread` | (user_id, is_read) | B-TREE | 未读通知 |
| `idx_notifications_created` | (user_id, created_at DESC) | B-TREE | 时间排序 |

---

## 12. routing_logs - 消息路由日志表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 日志 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| message_id | uuid | FK → messages.id, NOT NULL | - | 触发消息 |
| contact_id | uuid | FK → contacts.id, NOT NULL | - | 联系人 |
| platform | varchar(30) | NOT NULL | - | 来源平台 |
| incoming_content | text | NOT NULL | - | 原始消息内容 |
| matched_rule_id | uuid | FK → routing_rules.id, NULLABLE | NULL | 命中的路由规则 |
| scene_id | uuid | FK → scene_modes.id, NULLABLE | NULL | 匹配的场景 |
| profile_id | uuid | FK → style_profiles.id, NULLABLE | NULL | 使用的风格画像 |
| reply_record_id | uuid | FK → reply_records.id, NULLABLE | NULL | 关联回复记录 |
| action | varchar(30) | NOT NULL | - | 路由结果: `auto_reply` / `pending_review` / `blocked` / `ignored` / `manual` |
| reason | varchar(100) | NULLABLE | NULL | 路由原因说明 (如 `whitelist_auto_approve`, `blacklist_block`) |
| reply_sent_content | text | NULLABLE | NULL | 最终发送的回复内容 |
| steps | jsonb | NOT NULL | `'[]'` | 路由步骤详情 |
| processing_time | integer | NOT NULL | `0` | 总处理耗时 (ms) |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |

**steps JSONB 结构:**

```json
[
  { "step": "receive", "result": "ok", "duration": 5, "detail": null },
  { "step": "contact_lookup", "result": "found", "duration": 12, "detail": { "level": "important", "isWhitelist": true } },
  { "step": "blacklist_check", "result": "pass", "duration": 2, "detail": null },
  { "step": "rule_evaluate", "result": "matched", "duration": 15, "detail": { "ruleId": "uuid", "ruleName": "白名单自动回复" } },
  { "step": "scene_match", "result": "工作模式", "duration": 8, "detail": { "sceneId": "uuid" } },
  { "step": "reply_generate", "result": "3 candidates", "duration": 2500, "detail": null },
  { "step": "auto_approve", "result": "approved", "duration": 5, "detail": null },
  { "step": "send", "result": "sent", "duration": 265, "detail": { "platformMsgId": "xxx" } }
]
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_routing_logs_user_id` | user_id | B-TREE | 用户查询 |
| `idx_routing_logs_user_created` | (user_id, created_at DESC) | B-TREE | 时间线查询 |
| `idx_routing_logs_action` | (user_id, action) | B-TREE | 按路由结果过滤 |
| `idx_routing_logs_contact` | (user_id, contact_id) | B-TREE | 按联系人过滤 |
| `idx_routing_logs_scene` | (user_id, scene_id) | B-TREE | 按场景过滤 |
| `idx_routing_logs_rule` | (user_id, matched_rule_id) | B-TREE | 按规则过滤（统计用） |
| `idx_routing_logs_message` | message_id | UNIQUE | 一条消息一条路由日志 |

**分区策略:** 同 messages 表，按月分区 `created_at`。

---

## 13. routing_rules - 路由规则表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 规则 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 所属用户 |
| name | varchar(100) | NOT NULL | - | 规则名称 |
| priority | integer | NOT NULL | `50` | 优先级 (1-100, 数字越小优先级越高) |
| is_enabled | boolean | NOT NULL | `true` | 是否启用 |
| is_system | boolean | NOT NULL | `false` | 是否系统内置规则 (不可删除) |
| type | varchar(20) | NOT NULL | `'route'` | 规则类型: `block` / `route` / `transform` |
| conditions | jsonb | NOT NULL | `'{}'` | 匹配条件 (见下方结构) |
| action | varchar(30) | NOT NULL | - | 路由动作: `auto_reply` / `pending_review` / `blocked` / `ignored` / `manual` |
| action_config | jsonb | NOT NULL | `'{}'` | 动作配置 |
| trigger_count | integer | NOT NULL | `0` | 累计触发次数 |
| last_triggered_at | timestamp | NULLABLE | NULL | 最后触发时间 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| updated_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间 |

**conditions JSONB 结构:**

```json
{
  "contact": {
    "level": "important",
    "isWhitelist": true,
    "isBlacklist": false,
    "tags": ["客户"]
  },
  "message": {
    "containsKeywords": ["转账", "红包"],
    "msgType": "text",
    "isGroup": false,
    "lengthMin": 0,
    "lengthMax": 500
  },
  "platform": {
    "in": ["wechat"]
  },
  "time": {
    "startTime": "09:00",
    "endTime": "18:00",
    "weekdays": [1, 2, 3, 4, 5]
  }
}
```

**action_config JSONB 结构:**

```json
{
  "notifyUser": true,
  "autoApprove": true,
  "timeout": 300,
  "timeoutAction": "auto_approve",
  "maxDelay": 5,
  "customPrompt": "简短回复"
}
```

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_routing_rules_user_id` | user_id | B-TREE | 用户查询 |
| `idx_routing_rules_user_priority` | (user_id, priority) | B-TREE | 按优先级排序 |
| `idx_routing_rules_user_enabled` | (user_id, is_enabled) | B-TREE | 启用规则过滤 |

---

## 14. audit_logs - 审计日志表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 日志 ID |
| user_id | uuid | FK → users.id, NULLABLE | NULL | 操作用户 |
| action | varchar(50) | NOT NULL | - | 操作类型 |
| resource_type | varchar(50) | NOT NULL | - | 资源类型 |
| resource_id | uuid | NULLABLE | NULL | 资源 ID |
| details | jsonb | NULLABLE | NULL | 操作详情 |
| ip_address | varchar(45) | NULLABLE | NULL | IP 地址 |
| user_agent | varchar(500) | NULLABLE | NULL | UA 标识 |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 操作时间 |

**action 取值示例:**

- `user.login` / `user.logout` / `user.register`
- `style.upload` / `style.analyze` / `style.delete`
- `platform.connect` / `platform.disconnect`
- `reply.approve` / `reply.reject` / `reply.send`
- `scene.activate` / `scene.deactivate`
- `contact.update` / `contact.blacklist`

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_audit_logs_user_id` | user_id | B-TREE | 用户查询 |
| `idx_audit_logs_action` | action | B-TREE | 操作过滤 |
| `idx_audit_logs_resource` | (resource_type, resource_id) | B-TREE | 资源追踪 |
| `idx_audit_logs_created` | created_at | B-TREE | 时间查询 |

---

## 15. file_uploads - 文件上传表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | `gen_random_uuid()` | 文件 ID |
| user_id | uuid | FK → users.id, NOT NULL | - | 上传用户 |
| file_name | varchar(255) | NOT NULL | - | 原始文件名 |
| file_key | varchar(500) | NOT NULL | - | 存储路径 (MinIO key) |
| file_size | bigint | NOT NULL | - | 文件大小 (bytes) |
| mime_type | varchar(100) | NOT NULL | - | MIME 类型 |
| purpose | varchar(30) | NOT NULL | - | 用途: `style_analysis` / `export` |
| status | varchar(20) | NOT NULL | `'uploaded'` | 状态: `uploaded` / `processing` / `completed` / `deleted` |
| expires_at | timestamp | NULLABLE | NULL | 过期时间 (临时文件) |
| created_at | timestamp | NOT NULL | `CURRENT_TIMESTAMP` | 上传时间 |

**索引:**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `idx_file_uploads_user_id` | user_id | B-TREE | 用户查询 |
| `idx_file_uploads_status` | status | B-TREE | 状态过滤 |
| `idx_file_uploads_expires` | expires_at | B-TREE | 过期清理 |

---

## 表关系图 (ER Summary)

```
users
  ├── 1:1 ── user_settings
  ├── 1:N ── style_profiles
  │            └── 1:N ── style_samples
  ├── 1:N ── style_tasks
  ├── 1:N ── contacts
  ├── 1:N ── platform_auths
  ├── 1:N ── scene_modes
  ├── 1:N ── messages
  ├── 1:N ── reply_records
  ├── 1:N ── routing_logs
  ├── 1:N ── routing_rules
  ├── 1:N ── notifications
  ├── 1:N ── audit_logs
  └── 1:N ── file_uploads

routing_logs
  ├── N:1 ── messages
  ├── N:1 ── contacts
  ├── N:1 ── routing_rules (matched_rule_id)
  ├── N:1 ── scene_modes
  ├── N:1 ── style_profiles
  └── N:1 ── reply_records

reply_records
  ├── N:1 ── contacts
  ├── N:1 ── style_profiles
  ├── N:1 ── scene_modes
  └── N:1 ── messages (incoming_message_id)

messages
  ├── N:1 ── contacts
  └── N:1 ── reply_records
```

---

## TypeORM 迁移参考

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 创建枚举类型 (可选，也可用 varchar)
-- TypeORM 实体中使用 enum 字段类型即可自动生成
```

### 外键级联策略

| 关系 | ON DELETE | ON UPDATE | 说明 |
|------|-----------|-----------|------|
| user_settings → users | CASCADE | CASCADE | 删除用户时级联 |
| style_profiles → users | CASCADE | CASCADE | 删除用户时级联 |
| style_samples → style_profiles | CASCADE | CASCADE | 删除画像时级联 |
| contacts → users | CASCADE | CASCADE | 删除用户时级联 |
| messages → users | CASCADE | CASCADE | 删除用户时级联 |
| messages → contacts | SET NULL | CASCADE | 删除联系人时保留消息 |
| reply_records → users | CASCADE | CASCADE | 删除用户时级联 |
| routing_logs → users | CASCADE | CASCADE | 删除用户时级联 |
| routing_logs → messages | CASCADE | CASCADE | 删除消息时级联 |
| routing_logs → routing_rules | SET NULL | CASCADE | 删除规则时保留日志 |
| routing_rules → users | CASCADE | CASCADE | 删除用户时级联 |
| notifications → users | CASCADE | CASCADE | 删除用户时级联 |
| audit_logs → users | SET NULL | CASCADE | 删除用户时保留日志 |
