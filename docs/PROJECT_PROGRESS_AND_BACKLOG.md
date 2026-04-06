# 数字分身 - 项目进度评估与后续工作清单

> 基于 `architecture.md`、`api-spec.md`、`database-schema.md`、`project-structure.md` 与当前代码库的对照评估。  
> 更新日期：2026-04-06

**2026-04-06 代码同步摘要**：用户资料/设置 API、Swagger UI（`/api-docs`）、入站路由后 **WebSocket**（`message:received` / `reply:generated` / `reply:sent`）、**平台出站 stub**（`PlatformService.sendOutboundText` + 连接器 `sendTextMessage`）、**短信**（开发 mock + 每手机号 Redis 小时频控 + 生产 `SMS_PROVIDER_NOT_CONFIGURED`）、**抖音 mock 授权落库**（`PlatformAuth`）已与主干对齐；详见 `docs/e2e-path-audit.md`。

---

## 一、整体进度评估

### 1.1 结论概览

| 维度           | 状态   | 说明 |
|----------------|--------|------|
| **API 模块覆盖** | 约 92% | 用户模块已暴露 `users/me` 与 `users/settings`；其余业务模块保持 |
| **数据库与实体** | 已就绪 | 15 张表对应实体齐全，已有 3 个迁移文件 |
| **平台接入**     | 进行中 | 企业微信回调已接（解密/分发仍 TODO）；抖音 mock 授权可落 `PlatformAuth`；出站为连接器 stub，真实发消息 API 待接 |
| **可观测与运维** | 部分   | 日志、Swagger UI、健康检查已有；Prometheus / Sentry / OpenTelemetry 仍缺 |
| **端到端与测试** | 已起步 | 部分 e2e 与单元测试已存在，覆盖率和稳定性待加强 |

### 1.2 已实现功能（对照产品说明与历史提交）

- **认证 (F001)**  
  - 注册、登录、刷新 Token、登出、`GET /auth/me`、修改密码、发送短信验证码；开发环境固定验证码 + **每手机号 Redis 小时频控**；生产需对接真实短信商（当前返回明确业务错误码）。

- **风格画像 (F002, F003)**  
  - 上传聊天文件、查询分析任务、风格画像 CRUD、重新分析；Style 实体与任务/样本表齐全。

- **智能回复 (F004, F005)**  
  - 生成回复、待审核列表、审核（通过/拒绝/编辑）、反馈、回复历史；Reply 相关 API 已实现。

- **平台接入 (F006)**  
  - 平台列表、发起授权、查询授权状态、断开/更新配置、消息监听启停；企业微信回调与 WeCom Connector 已实现（加解密待补）；抖音 mock 授权确认后可写入 `PlatformAuth`；自动回复路径会调用连接器 **出站 stub**。

- **联系人 (F007)**  
  - 列表/详情、更新、批量更新、白名单/黑名单、导入、从平台同步；Contact 模块完整。

- **场景模式 (F008)**  
  - 场景 CRUD、激活/停用、获取当前活跃场景；Scene 模块完整。

- **消息记录 (F009)**  
  - 消息列表、会话列表、会话详情、统计、导出及导出任务查询；Message 模块完整。

- **消息路由（核心）**  
  - Dashboard、路由日志、规则 CRUD、规则排序、入站消息、模拟路由、暂停/恢复、统计；MessageRouter 已实现。

- **通知与 WebSocket**  
  - 站内通知 REST API；WebSocket Gateway（`/ws`，JWT 鉴权）；**入站路由管道**会推送 `message:received`、`reply:generated`、`reply:sent`（与 `api-spec.md` §9 对齐）；`style:*` / `platform:status` 等仍按场景补全。

- **基础设施与通用**  
  - 健康检查、审计查询、存储（MinIO）上传/列表/下载/删除；请求 ID 中间件、日志/超时/审计拦截器、Winston 配置；**Swagger UI** 已在非生产环境挂载（如 `/api-docs`）。

### 1.3 与架构文档的差异与缺口

- **UserModule**  
  - 已提供 `PUT /users/me`、`PUT /users/settings` 等（见 UserController）；与架构一致。

- **Swagger**  
  - 已在 `main.ts` 集成 SwaggerModule（非生产环境文档入口）。

- **短信与平台授权**  
  - 短信：真实服务商待接；已有 HTTP 限流 + **每手机号小时频控**。  
  - 微信/抖音：抖音 mock 可落库；企业微信解密与入站→`processInboundMessage` 仍待打通；各平台真实发消息 API 待实现（当前为 stub 日志）。

- **风格分析流水线**  
  - 上传与任务状态 API 已有；需确认 Bull 队列 Worker、MinIO 读写、Qdrant 向量写入、Claude 调用是否全部打通并覆盖异常与重试。

- **监控与可观测性**  
  - 架构要求：Prometheus + Grafana、OpenTelemetry、告警。  
  - 现状：仅应用层日志与健康检查，**无 Prometheus metrics、无链路追踪、无统一告警配置**。

---

## 二、后续工作清单

### 2.1 必须完成（阻塞上线/验收）

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 1 | ~~用户资料与设置 API~~ | **已完成**（UserController + 校验 + userId 隔离） | — |
| 2 | ~~启用 Swagger UI~~ | **已完成**（非生产 `/api-docs`） | — |
| 3 | **短信验证码落地** | 对接真实短信服务；保留开发 mock；频控已部分落地（Throttler + Redis 按手机号） | api-spec 1.2、product 规则 |
| 4 | **数据库迁移与一致性** | 核对 database-schema 中 15 张表与现有 3 个迁移是否一致；缺表/缺字段则补充迁移；在 CI 或部署脚本中执行 migration:run | database-schema、migrations/ |

### 2.2 核心业务闭环

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 5 | **风格分析流水线端到端** | 确认：上传 → MinIO → 创建 style_tasks → Bull Worker 消费 → 解析/清洗 → 调用 AI 提取特征 → 写入 Qdrant → 更新 style_profiles/style_samples；补全错误处理与重试，并触发 style.analysis.completed 事件 | architecture 5.2、StyleModule、style_tasks |
| 6 | **回复生成与审核流程** | Router 同步路径已：生成 → 自动审核 → 写 outgoing + **出站 stub**；队列路径与 Claude 降级需持续验收 | architecture 5.1、ReplyModule |
| 7 | **平台消息入站 → 路由 → 回复** | `POST /router/inbound` 闭环可用；**WeCom 回调 → Router** 仍缺；真实平台发送待接 | architecture 5.1、MessageRouter |
| 8 | **WebSocket 事件对齐 api-spec** | **已部分完成**：入站管道推送 `message:received` / `reply:generated` / `reply:sent`；`style:*`、`platform:status` 等仍待 | api-spec 9 |

### 2.3 安全、合规与稳定性

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 9 | **多租户与敏感数据** | 所有业务查询强制带 userId（及必要时的 orgId）；敏感字段（如 token、聊天内容）按架构要求 AES-256-GCM 或脱敏；审计日志覆盖关键写操作 | architecture 6.2、product 规则 |
| 10 | **限流与防刷** | 校验 Throttler 配置是否按 api-spec（如 60 次/分钟）生效；对短信、登录、注册等接口单独限流策略 | api-spec 通用、architecture 6.1 |
| 11 | **错误上报** | 关键错误上报到 Sentry（或现有监控），避免仅 console.log；在全局异常过滤器中统一上报 | product 规则（Analytics） |

### 2.4 运维与可观测性

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 12 | **Prometheus Metrics** | 暴露 `/metrics`：请求延迟、队列深度、错误率、各模块关键操作计数；便于 Grafana 仪表盘与告警 | architecture 9 |
| 13 | **链路追踪（可选）** | 按需接入 OpenTelemetry，对跨模块调用（Platform → Router → Reply → Platform）做 trace | architecture 9 |
| 14 | **生产部署与配置** | 完善 docker-compose.prod、Nginx 反向代理与 SSL；环境变量统一用 .env.example 文档化，生产敏感项从密钥管理注入；健康检查与就绪探针用于 K8s/Docker | architecture 7、.env.example |

### 2.5 测试与质量

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 15 | **E2E 与关键路径** | 为 Auth、Contact、Platform、Reply、MessageRouter、Notification 等补全或稳定化 e2e；覆盖：登录 → 创建场景/联系人 → 模拟入站消息 → 审核回复 → 查询消息/统计 | test/*.e2e-spec.ts |
| 16 | **单元测试覆盖率** | 对 Service 层核心逻辑（路由规则、回复生成、风格分析、联系人同步）补充单测，提高覆盖率 | *.spec.ts |

### 2.6 产品与体验（按需）

| 序号 | 项 | 说明 | 参考 |
|-----|---|------|------|
| 17 | **订阅与付费（若为付费产品）** | 付费功能校验 plan/subscription；Stripe Webhook 幂等；取消订阅后的降级逻辑明确定义 | product 规则（Subscription & Payment） |
| 18 | **账号与数据删除** | 用户注销时级联删除或匿名化关联数据，并符合隐私与架构中的「数据删除权」 | architecture 6.3、product 规则（User Data） |

---

## 三、建议优先级与迭代

- **P0（当前迭代）**：4 迁移一致性、9 多租户与敏感数据、7 WeCom 入站→Router 真链路。
- **P1（下一迭代）**：3 短信真实通道、5 风格分析流水线、6/7 真实平台发送与拉消息、8 剩余 WS 事件（style/platform）。
- **P2（上线前）**：11 错误上报、12 Prometheus、14 生产部署、15 E2E 关键路径（依赖本地 DB/Redis 的 e2e 环境）。
- **P3（持续）**：13 链路追踪、16 单测覆盖率、17 订阅与付费、18 账号与数据删除。

完成上述清单后，再根据实际产品排期做订阅/支付与前端（小程序、Web、管理后台）的对接与联调。
