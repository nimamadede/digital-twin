# 数字分身 - 系统技术架构文档

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端层 (Client Layer)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ 微信小程序 │  │  Web App  │  │ 移动 App  │  │  管理后台 (Admin) │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘   │
└────────┼─────────────┼─────────────┼────────────────┼──────────────┘
         │             │             │                │
         ▼             ▼             ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway (NestJS)                             │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐              │
│  │  JWT 鉴权 │ │  限流控制  │ │  请求日志  │ │ API 路由  │              │
│  └─────────┘ └──────────┘ └───────────┘ └──────────┘              │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       业务服务层 (Service Layer)                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ User Service  │  │ Style Engine │  │  Reply Engine             │  │
│  │  用户管理/认证  │  │ 风格画像构建   │  │  AI 回复生成核心           │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
│  ┌──────┴───────┐  ┌──────┴──────────┐  ┌─────────┴────────────┐   │
│  │ Contact Svc   │  │ Platform        │  │ Message Router       │   │
│  │ 联系人管理     │  │ Connector       │  │ 消息路由/审核流程      │   │
│  └──────┬───────┘  │ 平台消息桥接     │  └─────────┬────────────┘   │
│         │          └──────┬──────────┘            │                │
│  ┌──────┴───────┐         │            ┌──────────┴────────────┐   │
│  │ Scene Svc     │         │            │ Notification Service  │   │
│  │ 场景模式管理   │         │            │ 用户通知推送           │   │
│  └──────────────┘         │            └───────────────────────┘   │
└───────────┼───────────────┼────────────────────────────────────────┘
            │               │
            ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       基础设施层 (Infrastructure)                     │
│                                                                     │
│  ┌────────────┐  ┌────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │ PostgreSQL  │  │ Redis  │  │ Milvus/     │  │ MinIO/S3      │   │
│  │  主数据库    │  │ 缓存/  │  │ Qdrant      │  │ 对象存储       │   │
│  │            │  │ 消息队列│  │ 向量数据库   │  │ 聊天记录文件   │   │
│  └────────────┘  └────────┘  └─────────────┘  └───────────────┘   │
│                                                                     │
│  ┌────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Bull Queue (Redis)  │  │ Claude API / OpenAI API              │  │
│  │ 异步任务队列        │  │ AI 大模型服务                        │  │
│  └────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| **后端框架** | NestJS (TypeScript) | ^10.x | 模块化架构，依赖注入，企业级开发效率高 |
| **ORM** | TypeORM | ^0.3.x | TypeScript 原生支持，与 NestJS 深度集成 |
| **主数据库** | PostgreSQL | ^16.x | JSONB 支持、全文搜索、事务可靠性 |
| **缓存/队列** | Redis | ^7.x | 高性能缓存 + Bull 队列底层依赖 |
| **向量数据库** | Qdrant | ^1.x | 轻量部署、REST API、适合中小规模向量检索 |
| **消息队列** | Bull | ^5.x (BullMQ) | 基于 Redis，NestJS 官方集成 (@nestjs/bullmq) |
| **AI 引擎** | Claude API | latest | 中文理解能力强，支持长上下文 |
| **对象存储** | MinIO | latest | S3 兼容，私有部署，存储聊天导出文件 |
| **WebSocket** | Socket.io | ^4.x | NestJS Gateway 原生支持，实时消息推送 |
| **认证** | Passport + JWT | - | NestJS 官方认证方案 |
| **API 文档** | Swagger (OpenAPI 3.0) | - | @nestjs/swagger 自动生成 |
| **容器化** | Docker + Docker Compose | - | 一键部署开发/生产环境 |
| **日志** | Winston + Pino | - | 结构化日志，生产级性能 |

## 3. 微服务模块划分

> 采用 **NestJS 单体模块化** 架构（Modular Monolith），各模块独立但共享同一进程，降低初期运维复杂度，后期可平滑拆分为微服务。

### 3.1 模块职责

| 模块 | 职责 | 对应功能需求 |
|------|------|-------------|
| **AuthModule** | 用户注册、登录、JWT Token 管理、刷新令牌 | F001 |
| **UserModule** | 用户信息 CRUD、偏好设置 | F001 |
| **StyleModule** | 聊天数据导入、风格分析任务、风格画像管理 | F002, F003 |
| **ReplyModule** | AI 回复生成、回复审核队列、用户反馈收集 | F004, F005 |
| **PlatformModule** | 微信/抖音授权、消息监听、消息发送代理 | F006 |
| **ContactModule** | 联系人导入、分级管理、白名单/黑名单 | F007 |
| **SceneModule** | 场景模式 CRUD、模式切换、调度规则 | F008 |
| **MessageModule** | 消息记录存储、历史查询、统计分析 | F009 |
| **MessageRouterModule** | 消息路由核心、规则引擎、路由日志、路由统计 | 系统核心 |
| **NotificationModule** | WebSocket 推送、站内消息、外部通知 | 系统级 |
| **CommonModule** | 共享守卫、拦截器、管道、装饰器 | 系统级 |

### 3.2 模块间通信

```
                    ┌─────────────┐
                    │ PlatformMod │ ← 外部平台消息
                    └──────┬──────┘
                           │ 新消息事件
                           ▼
┌──────────┐      ┌──────────────┐      ┌────────────┐
│ SceneMod │─────→│ MessageRouter│─────→│ ReplyModule│
│ 场景规则  │ 规则  │  消息路由     │ 生成  │  AI 回复    │
└──────────┘      └──────┬───────┘      └──────┬─────┘
                         │                      │
                         │ 存储                  │ 回复
                         ▼                      ▼
                  ┌──────────────┐      ┌────────────┐
                  │ MessageMod   │      │ 审核队列    │
                  │ 消息记录      │      │ (人工/自动) │
                  └──────────────┘      └──────┬─────┘
                                               │ 审核通过
                                               ▼
                                        ┌────────────┐
                                        │PlatformMod │→ 发送回复
                                        └────────────┘
```

**事件驱动通信**（NestJS EventEmitter）：

| 事件名 | 发布者 | 订阅者 | 说明 |
|--------|--------|--------|------|
| `platform.message.received` | PlatformModule | MessageRouter | 收到新消息 |
| `reply.generated` | ReplyModule | MessageRouter | AI 回复已生成 |
| `reply.approved` | MessageRouter | PlatformModule | 回复审核通过 |
| `reply.rejected` | MessageRouter | NotificationModule | 回复被拒绝 |
| `style.analysis.completed` | StyleModule | NotificationModule | 风格分析完成 |
| `contact.updated` | ContactModule | SceneModule | 联系人信息变更 |

## 4. 数据库设计（ER 模型）

```
┌────────────────┐       ┌────────────────┐       ┌─────────────────┐
│     users       │       │ style_profiles │       │ style_samples   │
├────────────────┤       ├────────────────┤       ├─────────────────┤
│ id (PK)        │──┐    │ id (PK)        │──┐    │ id (PK)         │
│ phone          │  │    │ user_id (FK)   │  │    │ profile_id (FK) │
│ nickname       │  ├───→│ name           │  ├───→│ content         │
│ avatar_url     │  │    │ description    │  │    │ platform        │
│ password_hash  │  │    │ traits (JSONB) │  │    │ created_at      │
│ status         │  │    │ status         │  │    └─────────────────┘
│ created_at     │  │    │ created_at     │  │
│ updated_at     │  │    │ updated_at     │  │    ┌─────────────────┐
└────────────────┘  │    └────────────────┘  │    │ reply_records   │
                    │                        │    ├─────────────────┤
                    │    ┌────────────────┐   │    │ id (PK)         │
                    │    │   contacts     │   │    │ user_id (FK)    │
                    │    ├────────────────┤   │    │ contact_id (FK) │
                    │    │ id (PK)        │   │    │ profile_id (FK) │
                    ├───→│ user_id (FK)   │   │    │ incoming_msg    │
                    │    │ platform_id    │   │    │ reply_content   │
                    │    │ nickname       │   │    │ status          │
                    │    │ level          │   │    │ feedback        │
                    │    │ is_whitelist   │   │    │ created_at      │
                    │    │ is_blacklist   │   │    └─────────────────┘
                    │    │ created_at     │   │
                    │    └────────────────┘   │    ┌─────────────────┐
                    │                        │    │  scene_modes    │
                    │    ┌────────────────┐   │    ├─────────────────┤
                    │    │ platform_auths │   │    │ id (PK)         │
                    │    ├────────────────┤   │    │ user_id (FK)    │
                    ├───→│ id (PK)        │   │    │ name            │
                    │    │ user_id (FK)   │   │    │ description     │
                    │    │ platform       │   │    │ reply_style     │
                    │    │ access_token   │   │    │ auto_reply      │
                    │    │ refresh_token  │   │    │ rules (JSONB)   │
                    │    │ expires_at     │   │    │ is_active       │
                    │    │ status         │   │    │ created_at      │
                    │    └────────────────┘   │    └─────────────────┘
                    │                        │
                    │    ┌────────────────┐   │    ┌─────────────────┐
                    │    │  messages      │   │    │ notifications   │
                    │    ├────────────────┤   │    ├─────────────────┤
                    ├───→│ id (PK)        │   │    │ id (PK)         │
                         │ user_id (FK)   │   │    │ user_id (FK)    │
                         │ contact_id(FK) │   │    │ type            │
                         │ direction      │   │    │ title           │
                         │ content        │   │    │ content         │
                         │ platform       │   │    │ is_read         │
                         │ msg_type       │   │    │ created_at      │
                         │ created_at     │   │    └─────────────────┘
                         └────────────────┘   │
```

### 核心关系

- `users` 1:N `style_profiles`（一个用户可维护多套风格画像）
- `style_profiles` 1:N `style_samples`（一套画像基于多段样本分析）
- `users` 1:N `contacts`（一个用户管理多个联系人）
- `users` 1:N `platform_auths`（一个用户可接入多个平台）
- `users` 1:N `scene_modes`（一个用户可创建多个场景模式）
- `users` 1:N `messages`（消息归属用户）
- `users` 1:N `reply_records`（回复记录归属用户）

## 5. 消息流转流程

### 5.1 自动回复主流程

```
外部平台消息 ──→ Platform Connector
                      │
                      ▼
              解析消息格式，标准化
                      │
                      ▼
              查询联系人信息 ──→ ContactModule
                      │
                      ▼
              检查黑名单？ ──是──→ 丢弃
                      │否
                      ▼
              检查白名单/联系人等级
                      │
                      ▼
              获取当前活跃场景 ──→ SceneModule
                      │
                      ▼
              场景规则匹配
                      │
                ┌─────┴──────┐
                │            │
           自动回复模式   人工审核模式
                │            │
                ▼            ▼
          ReplyEngine    推送通知给用户
          AI 生成回复     等待人工回复
                │            │
                ▼            │
          存入审核队列      │
          (auto-approve     │
           或等待审核)      │
                │            │
                ▼            ▼
          发送回复 ──→ Platform Connector ──→ 外部平台
                │
                ▼
          存储消息记录 ──→ MessageModule
```

### 5.2 风格分析流程

```
用户上传聊天记录文件
        │
        ▼
  文件上传至 MinIO/S3
        │
        ▼
  创建分析任务 ──→ Bull Queue
        │
        ▼
  Worker 消费任务:
    1. 下载并解析文件
    2. 文本清洗与分词
    3. 风格特征提取 (调用 AI)
    4. 生成特征向量
    5. 存入向量数据库 (Qdrant)
    6. 更新 style_profiles
        │
        ▼
  触发事件: style.analysis.completed
        │
        ▼
  WebSocket 通知用户分析完成
```

## 6. 安全与合规设计

### 6.1 认证与授权

| 机制 | 实现 |
|------|------|
| 用户认证 | JWT (Access Token 15min + Refresh Token 7d) |
| 密码存储 | bcrypt (cost factor = 12) |
| API 限流 | @nestjs/throttler (每 IP 60 次/分钟) |
| 请求签名 | 关键操作 HMAC-SHA256 签名验证 |
| RBAC | 基于装饰器的角色守卫 (@Roles) |

### 6.2 数据安全

| 措施 | 说明 |
|------|------|
| 传输加密 | 全站 HTTPS (TLS 1.3) |
| 敏感数据加密 | AES-256-GCM 加密存储 (access_token, 聊天内容) |
| 数据隔离 | 所有查询强制 user_id 过滤 (Row-Level Security) |
| 日志脱敏 | 日志中自动掩码手机号、token 等敏感信息 |
| SQL 注入防护 | TypeORM 参数化查询，禁止原始 SQL 拼接 |

### 6.3 平台合规

| 项目 | 措施 |
|------|------|
| 用户协议 | 首次使用需同意服务条款和隐私政策 |
| 数据删除权 | 提供账号注销和数据彻底删除接口 |
| 聊天记录合规 | 仅在用户授权后处理，不存储原始聊天明文（分析后删除） |
| AI 生成内容标识 | 回复记录中标记 `is_ai_generated` 字段 |
| 审计日志 | 关键操作记录 audit_log（who, what, when） |

## 7. 部署架构

### 7.1 Docker Compose 部署

```
┌─────────────────────────────────────────────┐
│              Docker Compose                  │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐    │
│  │  nginx        │  │  digital-twin-api │    │
│  │  反向代理      │─→│  NestJS App       │    │
│  │  SSL 终端     │  │  Port: 3000       │    │
│  │  Port: 443   │  └───────┬───────────┘    │
│  └──────────────┘          │                │
│                            ▼                │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL   │  │    Redis     │         │
│  │  Port: 5432   │  │  Port: 6379  │         │
│  └──────────────┘  └──────────────┘         │
│                                             │
│  ┌──────────────┐  ┌──────────────┐         │
│  │   Qdrant      │  │    MinIO     │         │
│  │  Port: 6333   │  │  Port: 9000  │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### 7.2 环境配置

| 环境 | 说明 | 数据库 |
|------|------|--------|
| development | 本地开发 | Docker Compose 本地实例 |
| staging | 预发布环境 | 独立数据库实例 |
| production | 生产环境 | 高可用数据库集群 |

### 7.3 关键配置项 (.env)

```bash
# App
APP_PORT=3000
APP_ENV=development
JWT_SECRET=<random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=digital_twin
DB_PASSWORD=<password>
DB_DATABASE=digital_twin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
MINIO_BUCKET=chat-records

# AI Engine
AI_PROVIDER=claude
CLAUDE_API_KEY=<api-key>
CLAUDE_MODEL=claude-sonnet-4-20250514

# WeChat
WECHAT_APP_ID=<app-id>
WECHAT_APP_SECRET=<app-secret>
```

## 8. 性能设计

| 指标 | 目标 | 实现手段 |
|------|------|---------|
| API 响应时间 | P95 < 200ms | Redis 缓存热点数据 |
| AI 回复延迟 | < 5s | 流式响应 + 异步队列 |
| 并发消息处理 | 1000 msg/min | Bull Queue 并发 Worker |
| 风格分析任务 | < 30s/次 | 异步任务 + 分块处理 |
| 数据库查询 | < 50ms | 索引优化 + 连接池 |

## 9. 监控与可观测性

| 组件 | 工具 | 用途 |
|------|------|------|
| 应用日志 | Winston / Pino | 结构化日志记录 |
| 健康检查 | @nestjs/terminus | `/health` 端点 |
| 性能指标 | Prometheus + Grafana | 请求延迟、队列深度、错误率 |
| 链路追踪 | OpenTelemetry | 跨模块调用追踪 |
| 告警 | Grafana Alerts | 异常指标实时告警 |
