# 任务: 用户资料与设置 API

## 目标
为已有的 UserModule 新增 UserController，暴露用户资料和偏好设置的 REST API。

## 前置条件
- 阅读 src/user/ 目录下所有文件，了解现有 UserService 和 User Entity
- 阅读 src/auth/auth.controller.ts 中的 GET /auth/me，了解当前如何返回用户信息
- 阅读 docs/api-spec.md 第 1.6 节，了解接口定义
- 阅读 docs/database-schema.md 中 users 和 user_settings 表结构

## 需要创建的文件
1. `src/user/user.controller.ts` — Controller
2. `src/user/dto/update-profile.dto.ts` — 更新资料 DTO
3. `src/user/dto/update-settings.dto.ts` — 更新设置 DTO
4. `src/user/user.controller.spec.ts` — 单元测试

## 需要修改的文件
1. `src/user/user.module.ts` — 注册 Controller
2. `src/user/user.service.ts` — 如果缺少 updateProfile/updateSettings 方法则补充

## API 端点（严格按此实现）

### PUT /api/v1/users/me
- Guard: JwtAuthGuard
- 功能: 更新当前用户资料（nickname, avatar, bio）
- 入参: UpdateProfileDto { nickname?: string, avatar?: string, bio?: string }
- 返回: 更新后的用户对象（排除 password）
- 校验: nickname 长度 2-50, bio 长度 0-500

### PUT /api/v1/users/settings
- Guard: JwtAuthGuard
- 功能: 更新当前用户偏好设置
- 入参: UpdateSettingsDto { defaultSceneId?: string, autoReply?: boolean, notificationEnabled?: boolean, reviewTimeout?: number, language?: string }
- 返回: 更新后的 settings 对象
- 校验: reviewTimeout 范围 30-3600, language 枚举 ['zh-CN', 'en-US']

### GET /api/v1/users/me
- Guard: JwtAuthGuard
- 功能: 获取当前用户完整信息（含 settings）
- 返回: 用户对象 + settings（排除 password）
- 注意: 如果 /auth/me 已有类似功能，保持兼容，不要删除旧接口

## 验收标准
- [ ] npm run build 无报错
- [ ] npm run test 通过（包含新增的 spec）
- [ ] 接口遵循现有代码中的 DTO / Response 模式
- [ ] Swagger 装饰器完整（@ApiTags, @ApiOperation, @ApiProperty, @ApiBearerAuth）
- [ ] 所有查询通过 @User() 装饰器获取 userId，确保租户隔离
