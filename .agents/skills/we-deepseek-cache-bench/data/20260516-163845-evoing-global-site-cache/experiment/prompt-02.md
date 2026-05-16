你正在同一个 DeepSeekX app-server thread 中执行 Evoing full benchmark 第 2 轮。
请先阅读当前 workspace，不要假设固定结构。

第 1 轮实际状态：

- 项目：Evoing 全球官网，口号“智能及代码，代码及智能”。
- 技术：无框架静态网站，`npm start` 通过 `server.mjs` 绑定 `0.0.0.0:5173`。
- 文件结构：`src/index.html`、`src/css/{brand,layout,components,main}.css`、
  `src/js/{i18n,navigation,filter,main}.js`、`src/data/{navigation,capabilities,industries,regions,cases}.json`、
  `scripts/validate.mjs`。
- `npm test` 已通过：151 checks, 0 failed。
- first-party source：约 2,615 行，距离正式 10,000+ 行目标还很远。
- 已有内容：hero、导航、能力、行业、区域、案例、洞察、career/contact 基础，双语结构，筛选与语言切换。

第 2 轮目标：把官网扩展为更完整的全球商业咨询公司网站，而不是只加长现有页面。

请完成：

1. 增加真实内容域和结构化数据：
   - 方法论/engagement model：从诊断、战略、原型、工程交付、运营迁移到价值实现；
   - 详细服务目录：每个 capability 下有可销售 offerings、deliverables、typical stakeholders、time-to-value；
   - 行业深页数据：每个行业包含 pain points、Evoing approach、outcomes、case references；
   - 洞察中心数据：至少 10 篇双语 insights，含 category、region、reading time、summary；
   - 全球团队或 leadership 数据：角色、城市、专长、语言；
   - 可复用内容模块，不要把所有文本堆在 `index.html`。
2. 增加前端交互：
   - insight/category/region 筛选；
   - methodology step 切换或 timeline；
   - industry detail drill-down；
   - contact form 基本状态校验。
3. 扩展 CSS 和 JS，但保持模块化，必要时新增文件，例如 `src/js/insights.js`、
   `src/js/contact.js`、`src/data/methodology.json` 等。
4. 更新 `scripts/validate.mjs`：验证新数据文件、数据关系、交互钩子、双语覆盖、启动脚本、
   first-party line count，并继续允许 line count warning，直到最终轮才必须达标。
5. 实际运行 `npm test`，修复失败。
6. 最后报告：新增文件、核心功能、验证结果、当前行数、启动命令、下一轮缺口。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code；内容必须像真实咨询官网。
- 不引入大型框架或不必要依赖。
- 保持 Evoing 品牌：全球、高端、咨询 + 工程、双语，“智能及代码，代码及智能”。
