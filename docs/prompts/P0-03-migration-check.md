# 任务: 数据库迁移一致性核查

## 目标
对照 docs/database-schema.md 中定义的 15 张表，检查现有迁移文件是否完整，补齐缺失的表或字段。

## 前置条件
- 阅读 docs/database-schema.md 完整内容
- 阅读 src/config/migrations/ 下所有已有迁移文件
- 阅读所有 Entity 文件（src/*//*.entity.ts），对比字段定义

## 执行步骤

### 第一步: 分析（仅输出分析报告，不写代码）
逐表对照 database-schema.md 与 Entity / 现有 migration:
- 哪些表已由 migration 创建？
- 哪些表仅有 Entity 但无 migration？
- 哪些字段在 schema 中定义了但 Entity 中缺失？
- 将分析结果以表格形式输出给我

### 第二步: 等待我确认后，再生成补充迁移
- 使用 TypeORM CLI 风格生成 migration 文件
- 文件名: {timestamp}-AddMissingTables.ts
- 放在 src/config/migrations/
- up() 中创建缺失的表和字段
- down() 中做对应的回滚

## 注意事项
- 不要修改已有的迁移文件
- 不要修改 Entity 文件（除非发现 Entity 与 schema 不一致，需先报告）
- 不要使用 synchronize:true
- 如果有歧义，先问我再动手

## 验收标准
- [ ] 分析报告清晰列出所有差异
- [ ] 新迁移文件包含完整的 up() 和 down()
- [ ] npm run build 无报错
- [ ] typeorm migration:run 能成功执行（或至少 SQL 逻辑正确）
