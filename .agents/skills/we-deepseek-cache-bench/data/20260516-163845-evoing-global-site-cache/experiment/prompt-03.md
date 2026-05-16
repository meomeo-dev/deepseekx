你正在同一个 DeepSeekX app-server thread 中执行 Evoing full benchmark 第 3 轮。
请先阅读当前 workspace，不要假设固定结构。

第 2 轮实际状态：

- `npm test` 通过：323 checks, 0 failed。
- first-party source：4,178 行，30 个文件；仍低于正式 10,000+ 目标。
- 已有数据和模块：methodology、service-catalog、industry-deep、insights、leadership；
  JS 包括 insights/contact/methodology/industry-detail；CSS 包括 methodology/insights/industry-detail/leadership。
- 页面已有 hero、capabilities、methodology、services、industries、insights、leadership、careers、contact、regions。

第 3 轮目标：把 Evoing 官网从“首页 + 数据”扩展成更像全球咨询公司的完整营销网站，
加入更多可体验的业务内容和页面级模块，继续提升真实 first-party source 行数。

请完成：

1. 增加以下真实内容域和数据文件：
   - `src/data/solutions.json`：至少 8 个跨能力解决方案，每个包含双语 name、problem、approach、modules、outcomes、metrics、relatedCapabilities、industries。
   - `src/data/case-studies.json`：至少 8 个案例详页级记录，每个包含双语标题、client archetype、challenge、intervention、architecture/operating model、results、timeline、region、industry、capabilities。
   - `src/data/articles.json`：至少 12 个洞察文章摘要，含双语 headline、deck、sections、author、category、region、date、readingTime。
   - `src/data/offices.json`：全球办公室详细信息，含 city、region、address style、focus areas、languages、timezone、contact channel。
   - `src/data/careers.json`：招聘岗位、职业路径、价值观、面试流程，双语。
2. 增加页面区块：
   - Solutions section：可按 capability 或 industry 筛选；
   - Case Studies section：卡片 + detail drawer/panel；
   - Article/Insights expanded section：支持 category/region 筛选，并能查看 article preview；
   - Offices section：region tabs 或 office filter；
   - Careers section：job family filter 和职位卡。
3. 增加 JS 模块：solutions、case-studies、articles、offices、careers 的渲染/筛选/详情逻辑。
4. 增加对应 CSS 模块，保持高端咨询官网视觉，避免单色主题过重。
5. 更新 `scripts/validate.mjs`：验证新增数据关系、最小数量、双语覆盖、HTML 容器、JS/CSS 模块、交互 hook。
6. 实际运行 `npm test`，修复失败。
7. 最后报告：新增文件、验证结果、当前行数、距离 10k 的缺口、下一轮建议。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code；内容应像真实商业咨询公司官网。
- 不引入大型框架或不必要依赖。
- 保持模块化，避免单文件过大。
