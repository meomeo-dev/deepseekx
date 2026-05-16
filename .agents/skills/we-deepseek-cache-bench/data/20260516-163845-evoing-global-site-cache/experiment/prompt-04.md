你正在同一个 DeepSeekX app-server thread 中执行 Evoing full benchmark 第 4 轮。
请先阅读当前 workspace，不要假设固定结构。

第 3 轮实际状态：

- `npm test` 通过：349 checks, 0 failed。
- first-party source：5,750 行，45 个文件；距离 10,000+ 目标仍差约 4,250 行。
- 已有内容域：capabilities、service catalog、methodology、industry deep、solutions、case studies、articles、offices、careers、leadership。
- 已有交互：语言切换、导航、能力筛选、methodology、industry detail、insight/article filters、solutions/cases/offices/careers 渲染和筛选。

第 4 轮目标：继续扩展真实官网内容与体验，补充高端咨询公司应有的 trust、governance、resources、client journey、品牌材料和可验证交互，提升行数但不做 filler。

请完成：

1. 新增数据文件：
   - `src/data/trust.json`：安全、AI governance、privacy、risk management、responsible AI、compliance frameworks，双语；
   - `src/data/client-journeys.json`：不同客户角色（CEO/CIO/CTO/COO/CFO/CHRO）进入 Evoing 的 journey，痛点、推荐路线、会议议程、成功指标；
   - `src/data/resources.json`：白皮书、playbook、briefing、webinar、assessment 等资源库，含 category、industry、language、format、summary；
   - `src/data/partners.json`：技术、云、数据、AI、security 生态伙伴类型与合作场景；
   - `src/data/brand-assets.json`：品牌原则、语气、视觉资产、presentation modules，用于官网上的 brand/media kit 区块。
2. 新增页面区块：
   - Trust & Governance：展示 responsible AI / security / compliance；
   - Client Journey：角色选择器，按 C-suite role 显示推荐路线；
   - Resource Library：资源筛选，模拟下载/请求访问状态；
   - Partner Ecosystem：生态矩阵；
   - Brand / Media Kit：品牌资产和 presentation modules。
3. 新增 JS 模块：trust、journeys、resources、partners、brand-assets 的渲染/筛选/状态逻辑。
4. 新增 CSS 模块，保持专业、高端、信息密度高，但移动端可读。
5. 更新 `scripts/validate.mjs`：验证新增数据、HTML 容器、JS/CSS 模块、关系完整性、双语覆盖、交互 hook。
6. 实际运行 `npm test` 并修复失败。
7. 最后报告当前行数、验证结果、距离 10k 缺口、下一轮建议。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code；内容必须像真实商业咨询公司官网。
- 不引入大型框架或不必要依赖。
- 保持模块化，避免单文件过大。
