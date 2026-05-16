你正在同一个 DeepSeekX app-server thread 中继续第 2 轮，也是本次 2 轮 smoke
benchmark 的最后一轮。请先阅读当前 workspace，不要假设固定结构。

第 1 轮实际状态：

- 项目名：Revenue Command Center。
- 文件：package.json、server.mjs、public/index.html、public/css/styles.css、
  public/js/data.js、public/js/utils.js、public/js/components.js、public/js/app.js、
  scripts/validate.mjs。
- `npm test` 已通过：87 passed, 0 failed。
- first-party line count：1313 行，9 个文件。
- 启动入口：`npm start`，server.mjs 已绑定 `0.0.0.0:5173`。
- 当前页面包含指标、账户风险列表、renewals/billing/support/usage/incidents、
  搜索、筛选、详情面板、空状态和错误状态。

本轮目标：在不跑全量 10k 行的前提下，把项目打磨到“用户可以打开体验”的最终
2 轮 smoke 产物，并留下可复现报告。

请完成：

1. 移除外部网络资源依赖，特别是 Google Fonts 或任何远程资源；页面必须离线可渲染。
2. 增加一个更完整的最终产品切片，至少包含以下两类：
   - 行动队列/next best actions：把续约、账单、支持、使用、事件风险综合成可执行任务；
   - 业务报告或风险剧本：展示每个高风险账户的推荐动作、owner、due date、影响金额。
3. 增加真实交互：例如 owner/status 筛选、action 完成/暂缓状态、导出文本、报告标签切换，
   或详情面板里的 playbook 选择。交互必须实际改变页面状态。
4. 增加最终报告页或项目内说明文件，例如 `public/report.html` 或 `REPORT.md`，记录：
   - 本次 2 轮 smoke benchmark 的目标；
   - 如何启动网站；
   - 如何运行验证；
   - 已实现功能；
   - 未达到正式 10k 行 benchmark 的说明和下一轮建议。
5. 扩展 `scripts/validate.mjs`，验证新增功能、离线资源约束、报告文件、启动脚本。
6. 实际运行 `npm test`，必要时修复失败。
7. 最后启动或说明启动命令：`npm start`，用户可通过 `http://localhost:5173` 打开。
8. 最终报告里写清楚：修改文件、验证结果、first-party 行数估计、启动命令、URL、剩余风险。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不使用大型框架，不安装不必要依赖。
- 不用脚本批量生成 filler code。
- 保持代码组织清楚，新增逻辑尽量拆到合适模块。
- 这是最后一轮，请确保网站能打开、验证能通过、报告存在。
