# 数字分身后端 — 项目上下文（供 Agent 快速对齐）

## 背景

**产品：** “数字分身”后端：从用户历史聊天中学习风格画像，对社交平台入站消息做路由与策略处理，由 AI 生成回复（可人工审核），再通过各平台 Connector 回发。

**本仓库范围：** 仅 **NestJS 单体后端**（HTTP API 全局前缀 `api/v1`）。**不含** 小程序 / Web / 管理后台；前端为独立工程，后续联调。

**文档索引：** 技术架构见仓库根目录 `architecture.md`；接口约定见 `api-spec.md`；表结构见根目录 `database-schema.md`；进度与待办见 `docs/PROJECT_PROGRESS_AND_BACKLOG.md`（可能与代码有滞后）。

## 目标（后端侧要达成的能力）

1. **身份与多租户：** JWT 鉴权；业务查询一律带 `userId` 隔离，禁止跨租户访问。
2. **风格画像：** 上传聊天记录 → 异步分析（队列、MinIO、Qdrant、大模型）→ 可检索的风格画像，供生成回复使用。
3. **智能回复：** 生成候选回复 → 审核流（通过/拒绝/编辑）→ 反馈；与消息路由、出站发送链路打通。
4. **平台接入：** 入站/出站消息模型统一；企微等已部分对接，部分平台（如抖音）可能仍为 mock，需按平台文档补齐授权与消息同步。
5. **运维与数据：** TypeORM 迁移（根目录 `migrations/` 及必要时 `src/config/migrations/`）、健康检查、结构化日志；指标/链路/Sentry 等可观测性仍多为待办。

## 技术栈（勿擅自加依赖，需先征得同意）

Node 18+、NestJS、TypeORM、PostgreSQL、Redis + BullMQ、MinIO、Socket.io、JWT/Passport、class-validator、Swagger、Winston、Jest。

## 当前进度（摘要）

- **已有模块：** Auth、User（含 `GET/PUT users/me`、`PUT users/settings`）、Style、Reply、Platform、Contact、Scene、Message、MessageRouter、Notification、Storage、Audit、Health、Common、Config 等。
- **本地调试文档：** 非生产环境下 Swagger：`http://localhost:<PORT>/api-docs`。
- **重点缺口 / 需验证：** 风格分析与回复生成的端到端闭环、入站→路由→审核→回发全链路、真实短信与防刷、各平台真实对接、E2E 与可观测性补强。

## 编码约定（与仓库 `.cursorrules` 一致）

- Controller：`@ApiTags`、`@ApiOperation`；需登录的接口 `JwtAuthGuard` + `@ApiBearerAuth()`；用 `@CurrentUser()` 取当前用户并做租户过滤。
- Entity：UUID 主键、`createdAt`/`updatedAt`、关联字段 `xxxId`；敏感字段注意序列化排除。
- 数据库变更：走 TypeORM migration，生产意图上不依赖 `synchronize: true`。

不确定时优先对齐现有模块写法与根目录 `.cursorrules`。
