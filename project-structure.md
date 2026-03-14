# 数字分身 - NestJS 项目结构

## 1. 目录结构

```
digital-twin/
├── .docker/                          # Docker 配置
│   ├── nginx/
│   │   └── nginx.conf                # Nginx 反向代理配置
│   ├── postgres/
│   │   └── init.sql                  # 数据库初始化脚本
│   └── Dockerfile                    # 应用 Dockerfile
│
├── src/
│   ├── main.ts                       # 应用入口
│   ├── app.module.ts                 # 根模块
│   │
│   ├── common/                       # 公共模块
│   │   ├── common.module.ts
│   │   ├── constants/
│   │   │   ├── index.ts
│   │   │   └── error-codes.ts        # 错误码常量
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts  # @CurrentUser() 参数装饰器
│   │   │   ├── public.decorator.ts        # @Public() 跳过认证
│   │   │   └── roles.decorator.ts         # @Roles() 角色装饰器
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts          # 分页请求 DTO
│   │   │   └── api-response.dto.ts        # 统一响应 DTO
│   │   ├── entities/
│   │   │   └── base.entity.ts             # 基础实体 (id, createdAt, updatedAt)
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts   # HTTP 异常过滤器
│   │   │   └── all-exceptions.filter.ts   # 全局异常过滤器
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts          # JWT 认证守卫
│   │   │   ├── roles.guard.ts             # 角色守卫
│   │   │   └── throttle.guard.ts          # 限流守卫
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts   # 响应格式转换
│   │   │   ├── logging.interceptor.ts     # 请求日志
│   │   │   └── timeout.interceptor.ts     # 超时拦截
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts         # 参数校验管道
│   │   └── utils/
│   │       ├── crypto.util.ts             # 加密工具 (AES-256-GCM)
│   │       ├── mask.util.ts               # 数据脱敏工具
│   │       └── pagination.util.ts         # 分页工具函数
│   │
│   ├── config/                       # 配置模块
│   │   ├── config.module.ts
│   │   ├── configuration.ts               # 配置加载
│   │   ├── database.config.ts             # 数据库配置
│   │   ├── redis.config.ts                # Redis 配置
│   │   ├── jwt.config.ts                  # JWT 配置
│   │   ├── minio.config.ts                # MinIO 配置
│   │   ├── ai.config.ts                   # AI 引擎配置
│   │   └── validation-schema.ts           # 环境变量校验 (Joi)
│   │
│   ├── auth/                         # 认证模块 (F001)
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   └── change-password.dto.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts            # JWT 策略
│   │   │   └── jwt-refresh.strategy.ts    # Refresh Token 策略
│   │   └── interfaces/
│   │       └── jwt-payload.interface.ts
│   │
│   ├── user/                         # 用户模块 (F001)
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── dto/
│   │   │   ├── update-user.dto.ts
│   │   │   └── update-settings.dto.ts
│   │   └── entities/
│   │       ├── user.entity.ts
│   │       └── user-settings.entity.ts
│   │
│   ├── style/                        # 风格画像模块 (F002, F003)
│   │   ├── style.module.ts
│   │   ├── style.controller.ts
│   │   ├── style.service.ts
│   │   ├── dto/
│   │   │   ├── upload-chat.dto.ts
│   │   │   ├── create-profile.dto.ts
│   │   │   └── update-profile.dto.ts
│   │   ├── entities/
│   │   │   ├── style-profile.entity.ts
│   │   │   ├── style-sample.entity.ts
│   │   │   └── style-task.entity.ts
│   │   ├── processors/
│   │   │   └── style-analysis.processor.ts  # Bull Queue Worker
│   │   └── services/
│   │       ├── style-analyzer.service.ts    # 风格分析引擎
│   │       └── vector-store.service.ts      # Qdrant 向量存储
│   │
│   ├── reply/                        # 智能回复模块 (F004, F005)
│   │   ├── reply.module.ts
│   │   ├── reply.controller.ts
│   │   ├── reply.service.ts
│   │   ├── dto/
│   │   │   ├── generate-reply.dto.ts
│   │   │   ├── review-reply.dto.ts
│   │   │   ├── reply-feedback.dto.ts
│   │   │   └── reply-history-query.dto.ts
│   │   ├── entities/
│   │   │   └── reply-record.entity.ts
│   │   ├── processors/
│   │   │   └── reply-generation.processor.ts  # AI 回复生成 Worker
│   │   └── services/
│   │       ├── ai-engine.service.ts           # AI 引擎封装
│   │       ├── prompt-builder.service.ts      # Prompt 模板构建
│   │       └── reply-review.service.ts        # 审核流程管理
│   │
│   ├── platform/                     # 平台接入模块 (F006)
│   │   ├── platform.module.ts
│   │   ├── platform.controller.ts
│   │   ├── platform.service.ts
│   │   ├── dto/
│   │   │   ├── authorize-platform.dto.ts
│   │   │   └── update-platform.dto.ts
│   │   ├── entities/
│   │   │   └── platform-auth.entity.ts
│   │   ├── connectors/
│   │   │   ├── base.connector.ts              # 连接器抽象基类
│   │   │   ├── wechat.connector.ts            # 微信消息桥接
│   │   │   └── douyin.connector.ts            # 抖音消息桥接
│   │   └── services/
│   │       └── message-listener.service.ts    # 消息监听管理
│   │
│   ├── contact/                      # 联系人管理模块 (F007)
│   │   ├── contact.module.ts
│   │   ├── contact.controller.ts
│   │   ├── contact.service.ts
│   │   ├── dto/
│   │   │   ├── update-contact.dto.ts
│   │   │   ├── batch-update-contacts.dto.ts
│   │   │   └── contact-query.dto.ts
│   │   └── entities/
│   │       └── contact.entity.ts
│   │
│   ├── scene/                        # 场景模式模块 (F008)
│   │   ├── scene.module.ts
│   │   ├── scene.controller.ts
│   │   ├── scene.service.ts
│   │   ├── dto/
│   │   │   ├── create-scene.dto.ts
│   │   │   └── update-scene.dto.ts
│   │   ├── entities/
│   │   │   └── scene-mode.entity.ts
│   │   └── services/
│   │       └── scene-scheduler.service.ts     # 场景定时调度
│   │
│   ├── message/                      # 消息记录模块 (F009)
│   │   ├── message.module.ts
│   │   ├── message.controller.ts
│   │   ├── message.service.ts
│   │   ├── dto/
│   │   │   ├── message-query.dto.ts
│   │   │   └── export-messages.dto.ts
│   │   ├── entities/
│   │   │   └── message.entity.ts
│   │   ├── processors/
│   │   │   └── message-export.processor.ts    # 导出任务 Worker
│   │   └── services/
│   │       └── message-stats.service.ts       # 统计分析服务
│   │
│   ├── notification/                 # 通知模块
│   │   ├── notification.module.ts
│   │   ├── notification.controller.ts
│   │   ├── notification.service.ts
│   │   ├── entities/
│   │   │   └── notification.entity.ts
│   │   └── gateways/
│   │       └── notification.gateway.ts        # WebSocket Gateway
│   │
│   ├── message-router/               # 消息路由模块
│   │   ├── message-router.module.ts
│   │   └── message-router.service.ts          # 消息路由核心逻辑
│   │
│   ├── audit/                        # 审计日志模块
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   ├── audit.interceptor.ts               # 审计拦截器
│   │   └── entities/
│   │       └── audit-log.entity.ts
│   │
│   ├── storage/                      # 存储模块
│   │   ├── storage.module.ts
│   │   ├── storage.service.ts                 # MinIO 操作封装
│   │   └── entities/
│   │       └── file-upload.entity.ts
│   │
│   └── health/                       # 健康检查模块
│       ├── health.module.ts
│       └── health.controller.ts               # /health 端点
│
├── test/                             # 测试
│   ├── app.e2e-spec.ts
│   ├── jest-e2e.json
│   └── fixtures/                     # 测试数据
│       ├── users.fixture.ts
│       └── messages.fixture.ts
│
├── migrations/                       # 数据库迁移
│   └── ...
│
├── .env.example                      # 环境变量示例
├── .env.development                  # 开发环境配置
├── .eslintrc.js                      # ESLint 配置
├── .prettierrc                       # Prettier 配置
├── .gitignore
├── docker-compose.yml                # Docker Compose 配置
├── docker-compose.prod.yml           # 生产 Docker Compose
├── nest-cli.json                     # NestJS CLI 配置
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── README.md
```

## 2. 根模块 (app.module.ts)

```typescript
@Module({
  imports: [
    // 基础设施
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    BullModule.forRootAsync({ useClass: RedisConfig }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 60 }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TerminusModule,

    // 公共模块
    CommonModule,

    // 业务模块
    AuthModule,
    UserModule,
    StyleModule,
    ReplyModule,
    PlatformModule,
    ContactModule,
    SceneModule,
    MessageModule,
    NotificationModule,
    MessageRouterModule,

    // 系统模块
    AuditModule,
    StorageModule,
    HealthModule,
  ],
})
export class AppModule {}
```

## 3. 依赖清单 (package.json dependencies)

### 核心框架

| 包名 | 说明 |
|------|------|
| `@nestjs/core` | NestJS 核心 |
| `@nestjs/common` | NestJS 通用模块 |
| `@nestjs/platform-express` | Express 适配器 |
| `@nestjs/config` | 配置管理 |

### 数据库与 ORM

| 包名 | 说明 |
|------|------|
| `@nestjs/typeorm` | TypeORM 集成 |
| `typeorm` | ORM 框架 |
| `pg` | PostgreSQL 驱动 |

### 缓存与队列

| 包名 | 说明 |
|------|------|
| `@nestjs/bullmq` | BullMQ 队列集成 |
| `bullmq` | 消息队列 |
| `ioredis` | Redis 客户端 |

### 认证与安全

| 包名 | 说明 |
|------|------|
| `@nestjs/passport` | Passport 集成 |
| `@nestjs/jwt` | JWT 模块 |
| `passport` | 认证框架 |
| `passport-jwt` | JWT 策略 |
| `bcrypt` | 密码哈希 |
| `@nestjs/throttler` | 请求限流 |
| `helmet` | HTTP 安全头 |

### WebSocket

| 包名 | 说明 |
|------|------|
| `@nestjs/websockets` | WebSocket 模块 |
| `@nestjs/platform-socket.io` | Socket.io 适配器 |
| `socket.io` | Socket.io 服务端 |

### API 文档

| 包名 | 说明 |
|------|------|
| `@nestjs/swagger` | Swagger 集成 |

### 数据校验

| 包名 | 说明 |
|------|------|
| `class-validator` | 类校验器 |
| `class-transformer` | 类转换器 |
| `joi` | 环境变量校验 |

### AI 引擎

| 包名 | 说明 |
|------|------|
| `@anthropic-ai/sdk` | Claude API SDK |

### 对象存储

| 包名 | 说明 |
|------|------|
| `minio` | MinIO SDK (S3 兼容) |

### 向量数据库

| 包名 | 说明 |
|------|------|
| `@qdrant/js-client-rest` | Qdrant REST 客户端 |

### 事件与调度

| 包名 | 说明 |
|------|------|
| `@nestjs/event-emitter` | 事件发射器 |
| `@nestjs/schedule` | 定时任务 |

### 日志

| 包名 | 说明 |
|------|------|
| `winston` | 日志框架 |
| `nest-winston` | NestJS Winston 集成 |

### 健康检查

| 包名 | 说明 |
|------|------|
| `@nestjs/terminus` | 健康检查 |

### 工具

| 包名 | 说明 |
|------|------|
| `uuid` | UUID 生成 |
| `dayjs` | 日期处理 |
| `lodash` | 工具函数 |
| `rxjs` | 响应式编程 |

### 开发依赖 (devDependencies)

| 包名 | 说明 |
|------|------|
| `@nestjs/cli` | NestJS CLI |
| `@nestjs/testing` | 测试工具 |
| `typescript` | TypeScript |
| `ts-node` | TS 运行时 |
| `jest` | 测试框架 |
| `ts-jest` | Jest TypeScript 支持 |
| `supertest` | HTTP 测试 |
| `eslint` | 代码检查 |
| `prettier` | 代码格式化 |
| `@types/node` | Node.js 类型 |
| `@types/jest` | Jest 类型 |
| `@types/bcrypt` | bcrypt 类型 |
| `@types/passport-jwt` | passport-jwt 类型 |

## 4. Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: .docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    env_file:
      - .env.development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./src:/app/src
    command: npm run start:dev

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: digital_twin
      POSTGRES_USER: digital_twin
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./.docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U digital_twin"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

volumes:
  postgres_data:
  redis_data:
  qdrant_data:
  minio_data:
```

## 5. 脚本命令 (package.json scripts)

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:generate": "npm run typeorm -- migration:generate -d src/config/database.config.ts",
    "migration:run": "npm run typeorm -- migration:run -d src/config/database.config.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/config/database.config.ts",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f api"
  }
}
```

## 6. 模块依赖关系

```
AppModule
├── CommonModule (全局)
│   └── 提供: Guards, Interceptors, Filters, Pipes
│
├── ConfigModule (全局)
│
├── AuthModule
│   └── 依赖: UserModule, JwtModule, PassportModule
│
├── UserModule
│   └── 依赖: (无外部模块依赖)
│
├── StyleModule
│   └── 依赖: StorageModule, BullModule (style-analysis queue)
│
├── ReplyModule
│   └── 依赖: StyleModule, ContactModule, SceneModule, BullModule
│
├── PlatformModule
│   └── 依赖: ContactModule, MessageRouterModule
│
├── ContactModule
│   └── 依赖: (无外部模块依赖)
│
├── SceneModule
│   └── 依赖: StyleModule, ScheduleModule
│
├── MessageModule
│   └── 依赖: ContactModule, StorageModule, BullModule
│
├── NotificationModule
│   └── 依赖: (WebSocket Gateway, EventEmitter)
│
├── MessageRouterModule
│   └── 依赖: ReplyModule, SceneModule, ContactModule, NotificationModule
│
├── AuditModule
│   └── 依赖: (EventEmitter)
│
├── StorageModule
│   └── 依赖: ConfigModule (MinIO config)
│
└── HealthModule
    └── 依赖: TerminusModule, TypeOrmModule, Redis
```

## 7. 初始化项目命令

```bash
# 1. 创建 NestJS 项目
npx @nestjs/cli new digital-twin --strict --package-manager npm

# 2. 安装核心依赖
npm install @nestjs/config @nestjs/typeorm typeorm pg \
  @nestjs/bullmq bullmq ioredis \
  @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt \
  @nestjs/throttler helmet \
  @nestjs/websockets @nestjs/platform-socket.io socket.io \
  @nestjs/swagger \
  @nestjs/event-emitter @nestjs/schedule \
  @nestjs/terminus \
  class-validator class-transformer joi \
  @anthropic-ai/sdk \
  minio \
  @qdrant/js-client-rest \
  winston nest-winston \
  uuid dayjs lodash rxjs

# 3. 安装开发依赖
npm install -D @types/bcrypt @types/passport-jwt @types/multer

# 4. 生成模块脚手架
npx nest g module auth
npx nest g controller auth
npx nest g service auth
# ... 对每个模块重复

# 5. 启动基础设施
docker compose up -d postgres redis qdrant minio

# 6. 运行数据库迁移
npm run migration:run

# 7. 启动开发服务器
npm run start:dev
```
