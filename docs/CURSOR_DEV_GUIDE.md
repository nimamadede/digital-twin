# Cursor 开发执行指南

## 已创建的文件

```
.cursorrules                            ← Cursor 全局规则（自动加载）
docs/prompts/P0-01-user-profile-api.md  ← 任务1: 用户资料API
docs/prompts/P0-02-swagger-ui.md        ← 任务2: Swagger UI
docs/prompts/P0-03-migration-check.md   ← 任务3: 迁移一致性
docs/prompts/P0-04-tenant-isolation.md  ← 任务4: 安全审计
```

---

## 使用方法

### 步骤 1: 打开 Cursor，确认 .cursorrules 生效
在 Cursor 中打开项目根目录，.cursorrules 会自动加载为全局上下文。

### 步骤 2: 每次只执行一个任务
打开 Composer (Cmd+I) 或 Chat，输入:

```
请阅读 docs/prompts/P0-02-swagger-ui.md 并严格按其中的要求实现。
实现前先阅读所有「前置条件」中列出的文件。
实现后告诉我修改了哪些文件以及如何验证。
```

### 步骤 3: 每完成一个任务，验证后再进入下一个

---

## 关键技巧：如何让 Cursor 输出稳定可用的代码

### 1. 用 @file 精确喂上下文
在 Cursor Chat 中用 @ 引用文件，而不是让它自己猜:
```
@src/user/user.service.ts @src/user/user.entity.ts
@src/auth/auth.controller.ts
请按 @docs/prompts/P0-01-user-profile-api.md 的要求实现 UserController
```

### 2. 分步执行，不要一次性要求太多
❌ 错误: "把 P0 的 4 个任务全部完成"
✅ 正确: "先只做 P0-02 Swagger UI，改好后我验证再做下一个"

### 3. 先分析后编码
对于复杂任务（如 P0-03 迁移、P0-04 安全审计）:
```
先执行第一步（分析），输出报告给我看。
不要写任何代码，等我确认后再实现。
```

### 4. 每次改完立即验证
让 Cursor 在实现后自行运行验证:
```
实现后请运行以下命令并告诉我结果:
1. npm run build
2. npm run test -- --testPathPattern=user
```

### 5. 修复时给出上下文
如果出错，不要只说"修一下"，要把错误信息贴给它:
```
npm run build 报了以下错误:
[贴错误日志]
请修复，只改必要的地方，不要重构其他代码。
```

### 6. 控制改动范围
在 prompt 中明确限制:
```
只修改 src/main.ts 这一个文件。不要动其他文件。
不要添加新的 npm 依赖。
不要重命名或重构现有代码。
```

---

## 推荐执行顺序

| 顺序 | 任务 | 预计改动量 | 依赖 |
|------|------|-----------|------|
| 1 | P0-02 Swagger UI | 仅改 main.ts | 无 |
| 2 | P0-01 用户资料 API | 新增 3 文件 + 改 2 文件 | 无 |
| 3 | P0-03 迁移检查 | 先分析再改 | 建议在 1,2 完成后 |
| 4 | P0-04 安全审计 | 先分析再改 | 建议最后做 |

先做 Swagger UI，因为改动最小、最容易验证，能快速建立信心。

---

## 出现问题时的应对

### Cursor 生成了不符合规范的代码
重新发送，在 prompt 中强调:
```
你的实现不符合 .cursorrules 中的规范。具体问题:
- Controller 缺少 @ApiTags
- Service 中用了 console.log 而不是 Logger
请严格按 .cursorrules 中的规范重新生成。
```

### Cursor 改了不该改的文件
在 Cursor 的 diff 视图中，只 Accept 你需要的文件改动，Reject 其余的。

### 生成的代码无法编译
```
请阅读以下文件确认类型和导入路径:
@src/user/user.entity.ts
@src/auth/guards/jwt-auth.guard.ts
然后修复编译错误，只改报错的文件。
```
