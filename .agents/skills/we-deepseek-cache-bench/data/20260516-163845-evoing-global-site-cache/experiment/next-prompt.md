你正在同一个 DeepSeekX app-server thread 中执行 Evoing full benchmark 第 5 轮。
请先阅读当前 workspace。注意：第 4 轮虽然新增了 trust/resources 等骨架，但 first-party
source 只有 5,934 行，新增模块偏浅，距离正式 10,000+ 目标还差约 4,100 行。

第 4 轮实际状态：

- `npm test` 通过：189 checks, 0 failed。
- first-party source：5,934 行，60 个文件。
- 新增 trust/client-journeys/resources/partners/brand-assets 数据和模块，但多个 JS/CSS 很短：
  trust.js 4 行、partners.js 3 行、main.js 46 行、trust.css 22 行、resources.css 29 行。
- 当前验证仍只是 warning 低于 10,000。最终轮必须超过 10,000。

第 5 轮目标：做实质性扩展，不能只加骨架。请把 Evoing 官网补成真正完整的全球商业咨询公司宣传站，显著增加真实 first-party source，目标本轮达到至少 8,500 行，下一轮收口超过 10,000。

请完成：

1. 深化现有数据，而不是只新增浅文件：
   - 扩展 `case-studies.json` 到至少 16 个详尽案例，每个案例包含 bilingual overview、challenge bullets、intervention phases、architecture/operating model detail、results metrics、quote、team model、timeline milestones。
   - 扩展 `articles.json` 到至少 24 篇文章摘要，每篇含 4-6 个 section bullets、key takeaways、author bio refs、related capabilities。
   - 扩展 `resources.json` 到至少 24 个资源，每个有 audience、format、abstract、whatYouWillLearn、request form tags。
   - 扩展 `solutions.json` 到至少 12 个解决方案，每个包含 modules、diagnostics、implementation roadmap、KPIs。
   - 扩展 `trust.json` 和 `partners.json`，增加具体 frameworks、controls、ecosystem plays、governance model。
2. 做实 JS/CSS：
   - `trust.js`、`partners.js`、`brand-assets.js` 不得只是占位，要渲染 cards、tabs 或 matrices；
   - `resources.js` 支持 category/audience/format 筛选和 request-access 状态；
   - `case-studies.js` 支持 detail drawer 和 related filters；
   - `articles.js` 支持 preview panel 和 saved-reading 状态；
   - CSS 为这些交互提供完整布局、状态、响应式。
3. 添加新的深度页面区块或组件：
   - Value proof / impact calculator（静态模型即可，用户输入或选择后更新指标）；
   - Executive briefing builder：按角色/行业/目标生成推荐 briefing agenda；
   - Global delivery model：展示 squads、pods、nearshore/offshore、governance cadence。
4. 新增必要数据文件，例如 `value-models.json`、`briefings.json`、`delivery-model.json`，但必须真实使用在 UI 中。
5. 更新 `scripts/validate.mjs`：
   - 验证新增/扩展记录数量；
   - 验证长格式字段存在且双语；
   - 验证 JS/CSS 不再是浅占位；
   - 验证 first-party source 至少 8,500 行（本轮目标），如果低于 8,500 则失败。
6. 实际运行 `npm test`，如果失败，修复直到通过。
7. 最后报告当前行数、验证结果、主要新增能力、距离 10k 的缺口。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code；内容必须是具体、可信的咨询官网内容。
- 不引入大型框架或不必要依赖。
- 保持模块化，避免单个文件过大；可以拆分数据与 UI 模块。
