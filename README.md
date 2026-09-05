# Qiaomu Book Reader

**中文** · [English](#english) · [下载最新版](https://github.com/joeseesun/qiaomu-book-reader/releases/latest) · [问题反馈](https://github.com/joeseesun/qiaomu-book-reader/issues)

> 在 Obsidian 中阅读 EPUB、FB2 和 PDF，把进度、划线和批注沉淀为自己的 Markdown 阅读笔记。
> Read EPUB, FB2 and PDF in Obsidian and keep progress, highlights and annotations in your own Markdown notes.

中文优先、本地优先、每本书一篇阅读笔记。阅读本身完全离线，AI 能力由你选择服务并主动启用。

[真实 Obsidian 界面](docs/assets/4.0.1-epub-ai.jpg) · [交互优化与验收清单](docs/interaction-polish-4.0.1.md) · [构建验证](https://github.com/joeseesun/qiaomu-book-reader/actions)

当前源码包含 4.0.1 交互优化；BRAT 和手动下载版本以 GitHub Releases 为准，合并 main 不会自动更新已安装插件。

## 你会得到什么

| 能力 | 实际效果 |
| --- | --- |
| 内置阅读器 | EPUB、FB2、PDF，支持分页、滚动、单页与双页 |
| 中文排版 | 内置霞鹜文楷屏幕版、霞鹜臻楷 GB、朱雀仿宋、思源宋体和思源黑体，不依赖系统安装；另有系统黑体、宋体、楷体等选项 |
| 阅读主题 | 纸白、暖纸、青瓷、月白和夜间；只改变书页，工具栏跟随 Obsidian |
| 就近批注 | 选中文字后完成三色划线、复制、评论和创建摘录笔记 |
| 专用阅读笔记 | 每本书自动关联一篇 Markdown 笔记，汇总划线与评论 |
| 精确返回原文 | 笔记中的 `↩` 可跳回原书对应段落 |
| 自动进度 | 翻页、滚动和关闭书籍时自动保存，不需要手动点击保存 |
| 可选 AI 阅读 | 模型与思考强度独立设置、折叠思考过程、可自定义快捷提示词；支持 CLI、国产模型与本地模型 |

### PDF 阅读方式

PDF 不再被拆成容易错位的普通段落，而是始终保留原始页面：图表、表格、字体和版式由 PDF.js 整页呈现。有可靠文字层的页面会在原页上叠加透明文本层，继续支持选择、复制、搜索、划线、批注和 AI 上下文；扫描页或文字层不可读的页面只提供原页阅读、进度、本书笔记和返回页码，不伪造文字能力。每本 PDF 只使用一份“本书笔记”，不再为每页重复创建笔记入口。一本混合型 PDF 会逐页判断能力。PDF 页面可在 50%–300% 之间缩放，放大后可拖动或滚动查看，原页、文字层和划线会保持对齐。

## 安装

### 使用 BRAT（推荐）

1. 在 Obsidian 第三方插件市场安装 **BRAT**。
2. 打开 BRAT → **Add beta plugin**。
3. 输入 `joeseesun/qiaomu-book-reader`。
4. 在“第三方插件”中启用 **Qiaomu Book Reader**。

之后的新版本会通过 GitHub Releases 由 BRAT 持续更新。

<details>
<summary>手动安装</summary>

从 [最新版本](https://github.com/joeseesun/qiaomu-book-reader/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`，放入：

```text
<你的仓库>/.obsidian/plugins/qiaomu-book-reader/
```

重新加载 Obsidian 后启用插件。插件 ID 为 `qiaomu-book-reader`。

五款内置中文字体已压缩嵌入 `main.js`，无需再复制字体文件或安装系统字体。朱雀仿宋目前采用上游官方 v0.212 预览测试版，仅作为可选字体提供。

</details>

## AI 辅助阅读

“保存 AI 回复”把完整 Markdown 回答作为笔记正文，原文放在后面的来源区。标题在本地根据回答的主题标题、重点短语或内容句自动提取，过滤“总结”“关键概念”等通用小标题；保存前可修改，不额外调用模型。保存成功后按钮变为“已保存 · 打开笔记”，不会关闭对话，也不会自动抢走阅读焦点。

同一面板内，未发送草稿按书分别保留（最多 30 本，关闭面板或重启后不保留）。新建对话保留当前草稿；已发送的来源固定在对应问题下。单条删除与批量清空都需要确认，删除当前对话后不会在关闭面板时重新写回。

AI 默认关闭。启用后，文本型 PDF 会把整份可提取文字作为新对话的默认上下文；如果选中了原文，则本轮改用选文上下文做精读。常规 PDF 发送全文，超过 180,000 字符时按页均匀精简并明确标注，避免只截掉后半本。你可以通俗解释、举例、提炼要点、联系实际、换角度分析或生成测试题，并继续自由追问。书内“阅读设置”新增“AI 助读”标签，可就近开关 AI、查看当前服务与模型、调节思考模式/强度、回答语言和快捷问题；API 密钥、接口地址等低频敏感配置仍留在插件系统设置。DeepSeek V4 可单独开关思考模式；模型提供思考过程时会单独显示，回答完成后自动折叠，不与正式回答混在一起。

- 本机账号：Codex CLI、Claude Code CLI、Grok CLI、Kimi Code CLI、ZCode CLI。安装并登录一次后，插件可直接复用账号，无需再填 API 密钥。每个 CLI 分别记住自己的模型和思考强度；Grok 的常驻 ACP 会关闭后台自动更新，避免更新进程阻塞首字输出。
- 国产模型：DeepSeek、Kimi、通义千问、智谱 GLM、MiniMax。
- 聚合服务：硅基流动、豆包/火山方舟、OpenRouter。
- 国际服务：OpenAI。
- 本地模型：Ollama、LM Studio。
- 高级配置：任意 OpenAI 兼容接口。

API 密钥保存在 Obsidian 的密钥库中，不会写入插件 `data.json`。设置页可发送一条不含书籍内容的最短消息测试连接。

CLI 模式会自动检测可执行文件和登录状态，在独立临时目录中运行，并拒绝工具、文件和终端权限。Grok 与 Kimi 使用 CLI 自带的 ACP；Codex 使用 [`codex-acp`](https://github.com/agentclientprotocol/codex-acp)，Claude 使用 [`claude-agent-acp`](https://github.com/agentclientprotocol/claude-agent-acp)，ZCode 目前使用社区 [`zcode-acp`](https://github.com/william0wang/zcode-acp)。同一阅读对话复用常驻进程与 ACP session，首轮发送阅读上下文，后续只发送新问题；切换或清空对话会使用新的 session。会话过期或 ACP 进程意外退出且尚未产生回答时，插件会自动重建并安全重试一次；登录、模型、会话和进程故障会分别提示。设置页会区分“原生 ACP”和“需单独安装适配器”，并可分别检测 CLI 与适配器路径。CLI 模式仅支持桌面版 Obsidian。

## 外观与阅读设置

插件设置的“外观”页和书内“阅读设置”使用同一组数据。书内弹窗按任务分为“阅读”和“AI 助读”两个标签；主题、正文字体、字号和行距直接展示，分设备外观、电子墨水屏、对齐、插图和沉浸阅读等低频选项收在“更多阅读设置”中。弹窗只在竖向滚动，并为滚动条预留空间，不再遮住控件。

## 阅读笔记如何工作

首次打开一本书时，插件会创建或关联一份带有 `type: reading-note` 标记的专用 Markdown 笔记。之后的新划线和评论自动汇总到“划线与批注”章节；插件不会仅凭书名误把人物、项目或模板笔记当成阅读笔记。

评论以普通正文显示在引文下方，不使用引用样式。每条引文末尾的 `↩` 是返回原书位置的链接。

## 隐私与联网

书籍、进度、划线、评论和笔记均在本地工作，无需账号，没有遥测、分析或广告。

| 可选功能 | 发送内容 | 目标服务 |
| --- | --- | --- |
| 翻译所选文字 | 当前选中的段落 | Google Translate |
| AI 辅助阅读 | 你主动附加的 PDF 全文、当前页或选中文本、书名和问题 | 你明确选择并配置的模型服务 |
| 本机 CLI 账号 | 你主动附加的 PDF 全文、当前页或选中文本、书名和问题 | Codex、Claude、Grok、Kimi 或 ZCode 的云端服务 |
| 本地 AI | 当前选中的段落、书名和你的问题 | 本机 Ollama 或 LM Studio，不离开设备 |

两项联网功能均默认关闭。只有在你主动向 AI 提问时，文本型 PDF 才会在该对话首轮发送整书文字上下文；扫描 PDF 不发送页面图片或伪造 OCR 文本。

## 从源码构建

```bash
npm install
npm run check:i18n
npm run build
npx eslint src/
```

构建产物是仓库根目录的 `main.js`。五款内置字体的来源、版本与许可见 [fonts/README.md](fonts/README.md) 和 [fonts/OFL.txt](fonts/OFL.txt)。

## 鸣谢与项目来源

Qiaomu Book Reader 起源于 MIT 开源项目 [swayinfo/elton-reader](https://github.com/swayinfo/elton-reader)。感谢 Elton Reader 原作者 Elton Labs 及所有贡献者打下的阅读器基础，为本项目的持续改造提供了代码基础与启发。

当前仓库是由向阳乔木独立维护的长期 fork，已使用独立的插件 ID、发布渠道和产品名称，并持续围绕中文界面、中文阅读排版、阅读笔记与 AI 辅助阅读进行开发。原始版权声明和第三方许可信息保留在 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md) 中。

## 作者

Qiaomu Book Reader 由 [向阳乔木](https://qiaomu.ai) 维护：

- X：[@vista8](https://x.com/vista8)
- GitHub：[@joeseesun](https://github.com/joeseesun)
- 乔木推荐：[tuijian.qiaomu.ai](https://tuijian.qiaomu.ai)

第三方开源软件、上游来源和版权声明见 [NOTICE.md](NOTICE.md) 与 [LICENSE](LICENSE)。

---

<a name="english"></a>

# English

Qiaomu Book Reader is a Chinese-first EPUB, FB2 and PDF reader for Obsidian. PDF files retain their original fixed page layout; pages with a reliable text layer support selection, search, highlights, annotations and full-document or selected-text AI context, while scan-only pages provide original-page reading, progress and one book-level note without pretending OCR is available. The plugin keeps one dedicated Markdown reading note per book inside your vault.

Install it with BRAT using `joeseesun/qiaomu-book-reader`, or download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/joeseesun/qiaomu-book-reader/releases/latest).

Reading works fully offline. In-reader settings are split into Reading and AI Assistance tabs, keeping frequent AI controls close to the book while API keys and endpoint URLs remain in Obsidian plugin settings. Optional AI reading assistance includes editable quick prompts and supports signed-in Codex CLI, Claude Code CLI, Grok CLI, Kimi Code CLI, and ZCode CLI accounts without additional API-key setup, plus DeepSeek, Kimi, Qwen, GLM, MiniMax, SiliconFlow, Doubao, OpenRouter, OpenAI, Ollama, LM Studio, and custom OpenAI-compatible endpoints. CLI chats use persistent ACP sessions: Grok and Kimi provide ACP natively, while Codex, Claude, and ZCode use separately installed adapters. If an ACP session expires or its process exits before returning any content, the plugin rebuilds it and retries once; authentication, model, session, and process failures are reported separately. Grok ACP is launched with background auto-update disabled so an updater cannot delay the first streamed token. CLI providers are desktop-only and still send the page or selection you explicitly attach to their cloud service. AI is off by default and keys are stored with Obsidian SecretStorage.

Saving an AI reply preserves its complete Markdown body with the source below it. An editable title is extracted locally from the reply's topic, emphasis or content, with no extra model request. Saving keeps the chat open, and the saved action opens the existing note. Unsent drafts stay separate for up to 30 books during the sidebar lifetime, but are not persisted across restarts. Deleting conversations requires confirmation. These 4.0.1 source changes are separate from the latest GitHub Release used by BRAT.

## Acknowledgements and provenance

Qiaomu Book Reader began as a fork of the MIT-licensed [swayinfo/elton-reader](https://github.com/swayinfo/elton-reader) project. We thank the original Elton Reader author, Elton Labs, and every contributor whose work provided the technical foundation and inspiration for this project.

This repository is now an independently maintained long-term fork with its own plugin ID, release channel, and product name. Original copyright notices and third-party license information remain in [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

Maintained by [Qiaomu](https://qiaomu.ai). Third-party notices and upstream attribution are preserved in [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

## License

[MIT](LICENSE)
