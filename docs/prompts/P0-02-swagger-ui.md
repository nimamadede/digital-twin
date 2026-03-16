# 任务: 启用 Swagger UI

## 目标
在 main.ts 中集成 @nestjs/swagger，使项目自动生成 OpenAPI 文档并提供可视化 UI。

## 前置条件
- 阅读 src/main.ts 当前代码
- 确认 @nestjs/swagger 已在 package.json 的 dependencies 中（如果没有，先 npm install）
- 浏览 2-3 个 Controller 文件，确认已有 @ApiTags / @ApiOperation 等装饰器

## 需要修改的文件（仅此一个）
1. `src/main.ts`

## 具体实现

在 main.ts 的 bootstrap 函数中，app.listen() 之前，添加:

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ... 在 bootstrap() 中:
const config = new DocumentBuilder()
  .setTitle('Digital Twin API')
  .setDescription('数字分身后端 API 文档')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api-docs', app, document);
```

## 注意事项
- 不要修改任何其他文件
- 不要修改已有的 globalPrefix、cors、validation pipe 等配置
- Swagger 路径设为 'api-docs'（不带 /api/v1 前缀）
- 仅在非 production 环境启用（通过 NODE_ENV 判断），或者始终启用也可以

## 验收标准
- [ ] npm run build 无报错
- [ ] 启动服务后访问 http://localhost:3000/api-docs 能看到 Swagger UI
- [ ] 所有已有 Controller 的接口都出现在文档中
- [ ] Bearer Auth 按钮可用
