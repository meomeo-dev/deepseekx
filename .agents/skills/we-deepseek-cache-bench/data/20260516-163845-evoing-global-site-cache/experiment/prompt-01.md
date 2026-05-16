你正在 DeepSeekX app-server cache benchmark 的第 1 轮。workspace 为空。
这是正式全量 benchmark，不是 smoke test。最终停止条件包括：first-party source
超过 10,000 行、网站能在 `0.0.0.0:5173` 打开、验证通过、报告完整。

项目目标：为全球商业咨询公司 Evoing 开发一个可运行的全球官网，用于宣传：
“智能及代码，代码及智能”。网站应体现商业咨询、AI transformation、software
engineering、strategy、operations、industry advisory 和全球服务能力。

第 1 轮目标：建立项目基础、品牌系统、信息架构和可运行首屏体验。

要求：

1. 先检查当前 workspace，然后创建清晰的静态 Web 项目结构。
2. 使用原生 HTML/CSS/JS 或轻量 Node，不要安装大型框架。
3. 创建 Evoing 全球官网首版，至少包含：
   - 首页 hero：Evoing 作为第一视口强信号；口号“智能及代码，代码及智能”；
   - 全球导航，包含 Capabilities、Industries、Insights、Careers、Contact；
   - 中英双语内容基础，至少提供语言切换状态或双语文案结构；
   - 品牌视觉系统：颜色、排版、按钮、卡片、状态；
   - 至少 3 个业务区块：AI strategy、code modernization、operating model 或类似；
   - 数据结构文件，保存 capabilities、industries、regions、case highlights 等。
4. 添加基本交互：导航、语言切换、能力筛选或行业切换。
5. 添加本地验证脚本，例如 `npm test` 或 `node scripts/validate.mjs`，检查关键文件、
   数据结构、文案、启动脚本和业务规则。
6. 提供启动入口 `npm start`，服务必须绑定 `0.0.0.0:5173`。
7. 实际运行验证命令，必要时修复失败。
8. 最后报告：文件清单、验证结果、first-party 行数、启动命令、URL、下一轮建议。

约束：

- 不读取或打印任何 API key、`.env` 或凭据。
- 不用脚本批量生成 filler code。
- 不要只做占位 landing page；要构建可逐轮扩展的真实全球官网。
- 保持模块化，避免所有逻辑集中在一个巨大文件。
