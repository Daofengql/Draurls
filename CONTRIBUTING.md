# 贡献指南

感谢您对 Draurls 项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 先检查 [Issues](https://github.com/Daofengql/Draurls/issues) 是否已有类似问题
2. 如果没有，创建新的 Issue，并提供：
   - 清晰的标题和描述
   - 复现步骤（针对 bug）
   - 预期行为与实际行为
   - 环境信息（操作系统、浏览器/版本等）
   - 相关日志或截图

### 提交代码

#### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/Daofengql/Draurls.git
cd Draurls

# 后端开发
cd backend
cp .env.example .env
# 编辑 .env 配置数据库和 Redis
go run cmd/server/main.go

# 前端开发（新终端）
cd frontend
npm install
npm run dev
```

#### 代码规范

**Go 后端：**
- 遵循 [Effective Go](https://go.dev/doc/effective_go) 指南
- 使用 `gofmt` 格式化代码
- 添加必要的注释和文档
- 编写单元测试

**React 前端：**
- 使用 TypeScript 编写代码
- 遵循 ESLint 和 Prettier 配置
- 组件使用函数式组件 + Hooks
- 使用 Tailwind CSS 进行样式开发

#### 提交 PR

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m "feat: 添加某功能"`
4. 推送分支：`git push origin feature/your-feature-name`
5. 创建 Pull Request

#### Commit 消息规范

使用语义化提交消息：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整（不影响功能）
- `refactor:` 重构（既不是新功能也不是修复）
- `perf:` 性能优化
- `test:` 添加测试
- `chore:` 构建过程或辅助工具的变动

示例：
```
feat: 添加批量导出短链接功能

- 支持导出为 CSV 和 JSON 格式
- 添加导出进度提示
```

## 代码审查

所有 PR 都需要经过代码审查。请确保：

- 代码通过所有测试
- 添加了相应的测试用例
- 更新了相关文档
- 遵循项目的代码规范

## 行为准则

请尊重所有贡献者，保持友好和专业的沟通方式。

## 获取帮助

如有任何问题，欢迎：
- 提交 [Issue](https://github.com/Daofengql/Draurls/issues)
- 加入我们的讨论区
- 查看 [文档](docs)
