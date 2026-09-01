# Qiaomu Book Reader

**中文** · [English](#english) · [下载最新版](https://github.com/joeseesun/qiaomu-book-reader/releases/latest) · [问题反馈](https://github.com/joeseesun/qiaomu-book-reader/issues)

> 在 Obsidian 中阅读 EPUB、FB2 和 PDF，把进度、划线和批注沉淀为自己的 Markdown 阅读笔记。
> Read EPUB, FB2 and PDF in Obsidian and keep progress, highlights and annotations in your own Markdown notes.

中文优先、本地优先、每本书一篇阅读笔记。阅读本身完全离线，AI 能力由你选择服务并主动启用。

## 你会得到什么

| 能力 | 实际效果 |
| --- | --- |
| 内置阅读器 | EPUB、FB2、PDF，支持分页、滚动、单页与双页 |
| 中文排版 | 系统黑体、宋体、楷体、霞鹜文楷、思源宋体、思源黑体等字体 |
| 阅读主题 | 纸白、暖纸、青瓷、夜间和电子墨水；只改变书页，工具栏跟随 Obsidian |
| 就近批注 | 选中文字后完成三色划线、复制、评论和创建摘录笔记 |
| 专用阅读笔记 | 每本书自动关联一篇 Markdown 笔记，汇总划线与评论 |
| 精确返回原文 | 笔记中的 `↩` 可跳回原书对应段落 |
| 自动进度 | 翻页、滚动和关闭书籍时自动保存，不需要手动点击保存 |
| 可选 AI 阅读 | 模型与思考强度独立设置、折叠思考过程、可自定义快捷提示词；支持 CLI、国产模型与本地模型 |

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

</details>

## AI 辅助阅读

AI 默认关闭。启用后，可以围绕选中的原文通俗解释、举例、提炼要点、联系实际、换角度分析或生成测试题，并继续自由追问。快捷提示词支持在插件设置中新增、修改、删除和恢复默认，也可从 AI 对话框右上角直接管理。模型提供思考过程时会单独显示，回答完成后自动折叠，不与正式回答混在一起。

- 本机账号：Codex CLI、Claude Code CLI、Grok CLI。安装并登录一次后，插件可直接复用账号，无需再填 API 密钥。三个 CLI 分别记住自己的模型和思考强度。
- 国产模型：DeepSeek、Kimi、通义千问、智谱 GLM、MiniMax。
- 聚合服务：硅基流动、豆包/火山方舟、OpenRouter。
- 国际服务：OpenAI。
- 本地模型：Ollama、LM Studio。
- 高级配置：任意 OpenAI 兼容接口。

API 密钥保存在 Obsidian 的密钥库中，不会写入插件 `data.json`。设置页可发送一条不含书籍内容的最短消息测试连接。

CLI 模式会自动检测可执行文件和登录状态，在独立临时目录中运行，禁用工具、文件编辑和项目规则；超时、停止生成或关闭窗口时会终止子进程并删除临时文件。Claude Code 和 Grok 按模型事件逐字显示；Codex 的稳定 `exec --json` 目前在一条回答完成后返回消息事件，因此设置页会明确提示，不伪装成逐字流式。CLI 模式仅支持桌面版 Obsidian。

## 外观与阅读设置

插件设置的“外观”页和书内“阅读设置”使用同一组数据。主题、正文字体、字号和行距直接展示；分设备外观、电子墨水屏、对齐、插图和沉浸阅读等低频选项收在“更多外观选项”中。书内弹窗只在竖向滚动，并为滚动条预留空间，不再遮住控件。

## 阅读笔记如何工作

首次打开一本书时，插件会创建或关联一份带有 `type: reading-note` 标记的专用 Markdown 笔记。之后的新划线和评论自动汇总到“划线与批注”章节；插件不会仅凭书名误把人物、项目或模板笔记当成阅读笔记。

评论以普通正文显示在引文下方，不使用引用样式。每条引文末尾的 `↩` 是返回原书位置的链接。

## 隐私与联网

书籍、进度、划线、评论和笔记均在本地工作，无需账号，没有遥测、分析或广告。

| 可选功能 | 发送内容 | 目标服务 |
| --- | --- | --- |
| 翻译所选文字 | 当前选中的段落 | Google Translate |
| AI 辅助阅读 | 当前选中的段落、书名和你的问题 | 你明确选择并配置的模型服务 |
| 本机 CLI 账号 | 当前选中的段落、书名和你的问题 | Codex、Claude 或 Grok 的云端服务 |
| 本地 AI | 当前选中的段落、书名和你的问题 | 本机 Ollama 或 LM Studio，不离开设备 |

两项联网功能均默认关闭。插件不会自动发送整本书或整章内容。

## 从源码构建

```bash
npm install
npm run check:i18n
npm run build
npx eslint src/
```

构建产物是仓库根目录的 `main.js`。

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

Qiaomu Book Reader is a Chinese-first EPUB, FB2 and PDF reader for Obsidian. It keeps automatic reading progress, highlights, annotations, and one dedicated Markdown reading note per book inside your vault.

Install it with BRAT using `joeseesun/qiaomu-book-reader`, or download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/joeseesun/qiaomu-book-reader/releases/latest).

Reading works fully offline. Optional AI reading assistance includes editable quick prompts and supports signed-in Codex CLI, Claude Code CLI and Grok CLI accounts without additional API-key setup, plus DeepSeek, Kimi, Qwen, GLM, MiniMax, SiliconFlow, Doubao, OpenRouter, OpenAI, Ollama, LM Studio, and custom OpenAI-compatible endpoints. CLI providers are desktop-only and still send the selected passage to their cloud service. AI is off by default, keys are stored with Obsidian SecretStorage, and only the passage you explicitly act on is sent.

## Acknowledgements and provenance

Qiaomu Book Reader began as a fork of the MIT-licensed [swayinfo/elton-reader](https://github.com/swayinfo/elton-reader) project. We thank the original Elton Reader author, Elton Labs, and every contributor whose work provided the technical foundation and inspiration for this project.

This repository is now an independently maintained long-term fork with its own plugin ID, release channel, and product name. Original copyright notices and third-party license information remain in [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

Maintained by [Qiaomu](https://qiaomu.ai). Third-party notices and upstream attribution are preserved in [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

## License

[MIT](LICENSE)
