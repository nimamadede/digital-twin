# Code Review Rules

本仓库：**数字分身 NestJS 后端**。Review 时对照 `architecture.md`、`api-spec.md`、根目录 `.cursorrules` 与 `context.md`。

## Review 流程（建议顺序）

1. **对齐变更范围**：改了哪些模块？是否有 DB 迁移、对外 API / DTO 变更、环境变量或队列行为变化？
2. **按下方 Focus 逐项扫一遍**：先架构与安全，再错误处理与类型，最后性能与测试。
3. **分级结论**：**Blocker**（必须修才能合） / **Should fix**（本 PR 或跟进 PR） / **Note**（可选改进）。
4. **回归提示**：是否需要补 e2e、手动跑 Swagger 路径、或 `scripts/` 自测脚本。

---

## Focus on

### 1. Architecture consistency

- 是否符合 Nest 分层：Module / Controller / Service / DTO / Entity；职责是否留在正确层（业务不在 Controller 堆逻辑）。
- 是否与现有模块边界一致：跨模块调用是否通过 Service 注入，而非绕圈或重复造轮子。
- 新能力是否应落在已有模块（如路由、平台、回复）还是确需新模块；全局前缀仍为 `api/v1`。

### 2. Code duplication

- 分页、租户过滤、错误包装、鉴权取 `userId` 是否与 `common` 或现有模式一致。
- DTO / 查询条件是否与别处可抽取共享；避免复制粘贴整条业务链。

### 3. Error handling

- 业务失败是否使用合适的 Nest 异常（`NotFoundException`、`BadRequestException`、`ForbiddenException` 等），而非裸 `Error` 或含糊 500。
- 异步与队列（BullMQ）：失败是否可重试、死信/日志是否足够定位；外部 API（Claude、MinIO、平台）超时与降级是否有意识处理。

### 4. Security

- **多租户**：所有数据访问是否带 `userId`（或等价租户键）过滤，禁止跨用户读写。
- 认证路由是否 `JwtAuthGuard` + Swagger `@ApiBearerAuth()`；敏感字段是否 `@Exclude()` 或避免写入响应。
- 无硬编码密钥；Webhook/回调是否校验签名或 token（如平台模块）。
- 上传、导出、短信等高风险路径是否考虑滥用面（体积、频率、鉴权）。

### 5. Performance

- 列表是否分页；避免 N+1（TypeORM `relations` / QueryBuilder 是否克制）。
- 队列与长任务是否异步化；热路径是否不必要地读大对象或全表扫描。
- Redis / 外部服务调用频率是否合理（缓存或批处理是否该有）。

### 6. Typing safety

- TypeScript **strict**：避免无必要的 `any`；公共 DTO/接口类型明确。
- Entity 与 DTO 边界清晰；`class-validator` 与 `@ApiProperty` 与真实行为一致。

### 7. Logging

- Service 层使用注入的 **Logger**，避免 `console.log`。
- 关键业务与失败路径有足够上下文（如 `userId`、资源 id、requestId），但**不**打密码、token、完整聊天明文等敏感内容。

### 8. Test coverage

- 核心逻辑变更是否带 **单元测试**（`*.spec.ts`）；对外行为变更是否考虑 **e2e**（`test/*.e2e-spec.ts`）。
- 回归风险高的路径（路由规则、回复审核、平台回调）优先要求测试或明确说明手动验证步骤。

---

## Avoid

- **Style-only** 建议（与个人偏好相关、不影响可读性或项目规范的格式争论）。
- **Trivial lint** 重复（若 CI/编辑器已自动修复，不在 review 里堆同样意见）。
- 无依据的「过度设计」重构，除非当前 PR 已触及该区域且债务明确。
