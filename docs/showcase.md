# 真实界面截图 / Screenshot evidence

日期：2026-09-05。环境：macOS、Obsidian 1.13.7、Qiaomu Book Reader 4.0.1 源码标准构建。

本次 130 项测试、1184 项国际化覆盖检查、ESLint、标准版及社区候选版构建/产物校验均通过。截图所用标准版 `main.js` 的 SHA-256 为 `032dab5812c63d82b38120395b69b2325fc4425f1da68f19de411b1146eb90d8`。

## 展示什么

| 截图 | 用户价值 | 验证方式 |
| --- | --- | --- |
| [阅读与 AI 同屏](assets/showcase-reader-ai.jpg) | 不离开书页就能围绕内容提问 | 真实阅读器和 AI 控制器渲染，表格、任务列表、常驻提示词可见 |
| [保存回答](assets/showcase-save-answer.jpg) | 回答直接成为自己的 Markdown 笔记 | 实际点击保存；读回笔记，完整回答、表格、任务列表与文末来源均保留 |
| [中文排版](assets/showcase-typography.jpg) | 在书旁调整纸页主题、中文字体和布局 | 实际打开阅读设置，霞鹜文楷与纸白主题生效 |
| [书内搜索](assets/showcase-search.jpg) | 搜索、目录和跳转集中在底栏 | 搜索“理解”，读回三个结果及章节信息，正文匹配高亮 |
| [PDF 原页](assets/showcase-pdf.jpg) | 双栏、图表、表格保留原始位置 | 原创两页 PDF 原页渲染，点击放大后读回 125% |
| [封面书库](assets/showcase-library.jpg) | 从书架开始阅读 | 三本原创 EPUB 与一份原创 PDF，封面/首页面正确显示 |

截图通过 Computer Use 实际操作和截取，使用隔离演示仓库；没有用户文件树、私人对话、密钥或商业报告页面。文件为原始 JPEG 截图，没有合成控件或更换界面内容。

## 样本与真实性边界

- EPUB 与 PDF 的文字、封面、图表均为本次原创演示素材；图表数字明确标注为示意数据，不代表研究结论。
- 对话通过真实 AI 视图控制器加载固定样本，回答中可见“原创演示回答，用于展示界面，未调用模型”。它验证 Markdown 展示与保存路径，不验证任何具体模型、网络连接或首字速度。
- 本次没有使用用户现有账号、修改用户模型配置或发起付费模型请求。
- 静态截图不能证明流式时序、输入法行为或长期稳定性；这些能力的证据应查看控制器测试及独立实测记录。
- 展示的是源码构建，不代表 GitHub 最新 Release 已包含所有功能，更不代表已通过 Obsidian 市场审核。
- 自定义字体名与翻页按钮常驻的其他开发分支不在本次截图中，不作为已交付能力宣传。

## English

These are real Computer Use screenshots of Obsidian 1.13.7 running the 4.0.1 source build in an isolated demo vault. Books, covers and PDF graphics are original demonstration material; chart values are explicitly illustrative. AI replies are seeded fixtures, visibly labeled as demonstrations without a model call. The real save action was executed and the resulting Markdown was checked. No private vault data or credentials are included. Static images demonstrate layout and functionality, not streaming latency, model quality, mobile-device validation, release availability or directory approval.

The screenshots and original demo content on this page are provided under this repository's MIT license. They do not change the licenses of Obsidian or third-party bundled assets.
