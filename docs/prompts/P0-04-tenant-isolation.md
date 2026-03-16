# 任务: 多租户隔离与敏感数据安全审计

## 目标
审计所有 Service 层代码，确保业务查询都带 userId 过滤，敏感字段不泄露。

## 前置条件
- 阅读所有 src/*/*.service.ts 文件
- 阅读所有 src/*/*.controller.ts 文件
- 了解 @User() 装饰器的实现（在 src/common/ 或 src/auth/ 中）

## 执行步骤

### 第一步: 安全审计（仅输出报告，不写代码）
逐模块检查:

1. **租户隔离检查**
   对每个 Service 中的 find / findOne / update / delete 操作:
   - 是否在 where 条件中包含 userId？
   - 是否存在通过传入 ID 就能访问他人数据的路径？
   - Controller 中是否从 @User() 传递 userId 到 Service？

2. **敏感字段检查**
   - password 字段是否在所有返回中被排除？（@Exclude 或 select 排除）
   - platform token/secret 是否脱敏返回？
   - 聊天内容是否有必要的访问控制？

3. **输出格式**
   ```
   | 模块 | 文件 | 方法 | 问题 | 风险等级 | 建议修复 |
   ```

### 第二步: 等待我确认后，逐一修复
- 每次只修复一个模块
- 修复后运行该模块的测试确认无破坏

## 注意事项
- 这是安全审计任务，第一步仅做分析，不要直接改代码
- 不要改变 API 的行为和返回结构
- 修复时保持向后兼容

## 验收标准
- [ ] 审计报告覆盖所有业务模块
- [ ] 所有 find/update/delete 都带 userId 条件
- [ ] 密码字段在所有接口返回中不可见
- [ ] npm run test 全部通过
