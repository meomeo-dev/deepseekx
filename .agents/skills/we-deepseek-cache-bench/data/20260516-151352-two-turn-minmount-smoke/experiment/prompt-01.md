你正在 DeepSeekX app-server cache benchmark 的第 1 轮。workspace 为空。
这次是 2 轮 smoke test，不跑正式全量 benchmark；不要求 10,000 行停止条件，
但最终第 2 轮后必须有可打开网站、报告和可复现启动命令。

请构建一个真实可运行的网页产品原型：
“Revenue Command Center”，面向客户成功、收入运营和支持负责人，用于发现续约、
账单、工单、产品使用和事件风险。

第 1 轮目标：建立可运行项目骨架和首个完整产品切片。

要求：

1. 先检查 workspace，然后创建清晰的静态 Web 项目结构。
2. 使用原生 HTML/CSS/JS 或轻量 Node，不要安装大型框架。
3. 页面必须包含：
   - 顶部业务总览指标；
   - 账户风险列表；
   - 至少 3 个 coherent domains，例如 renewals、billing、support、usage、incidents；
   - 搜索、筛选、详情切换或状态更新等真实交互；
   - 空状态、错误状态或高风险状态展示。
4. 数据要在项目内结构化维护，不要只写死在 DOM 文本里。
5. 添加本地验收脚本，例如 `npm test` 或 `node scripts/validate.mjs`，检查关键文件、
   数据字段、DOM 文本和核心业务规则。
6. 提供启动入口，最好是 `npm start`，服务必须绑定 `0.0.0.0:5173`。
7. 实际运行验证命令，必要时修复失败。
8. 最后报告：创建了哪些文件、验证命令结果、first-party 行数估计、启动命令、
   预览 URL `http://localhost:5173`、第 2 轮建议。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code。
- 不要只做占位 demo；页面要能被用户实际体验。
- 保持文件适中，避免把所有逻辑放进一个巨大文件。
