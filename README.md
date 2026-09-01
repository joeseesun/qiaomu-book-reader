# Qiaomu Book Reader

在 Obsidian 里直接阅读 EPUB、FB2 和 PDF，把划线、批注、阅读进度沉淀为真正属于你的 Markdown 阅读笔记。

[English](#english) · [问题反馈](https://github.com/joeseesun/qiaomu-book-reader/issues)

> 中文优先、数据本地、每本书一篇阅读笔记。
> Chinese-first, local-first, with one Markdown reading note per book.

## 适合谁

如果你希望电子书、阅读进度和笔记都留在自己的 Obsidian 仓库里，而不是被锁在某个阅读平台中，这个插件就是为这种工作流设计的。

## 主要功能

- 在 Obsidian 中阅读 EPUB、FB2 和 PDF，支持分页、滚动、单页与双页。
- 中文优先界面，内置系统黑体、宋体、楷体、霞鹜文楷、思源宋体和思源黑体等字体选项。
- 选中文本后就近完成三色划线、复制、批注和创建摘录笔记。
- 每本书自动建立一份专用阅读笔记，集中保存划线与批注。
- 阅读笔记中的 `↩` 图标可精确跳回原书段落，不夹带“返回原文”等干扰文字。
- 阅读进度自动保存；书籍、进度、划线与笔记随 Obsidian 仓库一起同步。
- 书库按阅读状态、文件夹和主题筛选，并支持自定义封面。

## 安装

### 使用 BRAT

1. 在 Obsidian 第三方插件市场安装 **BRAT**。
2. 打开 BRAT → **Add beta plugin**。
3. 输入 `joeseesun/qiaomu-book-reader`。
4. 在“第三方插件”中启用 **Qiaomu Book Reader**。

### 手动安装

从 [最新版本](https://github.com/joeseesun/qiaomu-book-reader/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`，放入：

```text
<你的仓库>/.obsidian/plugins/qiaomu-book-reader/
```

重新加载 Obsidian 后启用插件。插件 ID 为 `qiaomu-book-reader`；BRAT 会按这个 ID 安装到独立目录，并从本仓库的 GitHub Releases 持续更新。

如果你曾安装原版 `elton-reader-books`，请先停用原插件，再安装本插件。阅读进度与划线文件仍保存在仓库中；需要沿用旧设置时，可将旧目录中的 `data.json` 复制到新目录。

## 阅读笔记如何工作

首次打开一本书时，插件会创建或关联一份带有 `type: reading-note` 标记的专用 Markdown 笔记。之后的新划线和批注自动汇总到“划线与批注”章节；插件不会仅凭书名误把人物、项目或模板笔记当成阅读笔记。

批注以普通正文显示在摘录下方，不使用引用样式。每条摘录末尾的 `↩` 是返回原书位置的链接。

## 隐私与联网

阅读、划线、批注、笔记和进度完全在本地工作，无需账号，也没有遥测、分析或广告。

只有两项可选功能会联网，并且默认关闭：

| 功能 | 发送内容 | 服务 |
| --- | --- | --- |
| 翻译所选文字 | 仅当前选中的段落 | Google Translate |
| AI 解析段落 | 仅当前选中的段落和书名 | 你选择的 Elton AI、OpenRouter、OpenAI，或本地 Ollama / LM Studio |

API 密钥保存在插件的本地设置中。如果仓库参与同步，对应配置文件也可能一起同步。

## 从源码构建

```bash
npm install
npm run check:i18n
npm run build
npx eslint src/
```

构建产物是仓库根目录的 `main.js`。

## 作者与致谢

Qiaomu Book Reader 由 [向阳乔木](https://qiaomu.ai) 改造与维护：

- X：[@vista8](https://x.com/vista8)
- GitHub：[@joeseesun](https://github.com/joeseesun)
- 乔木推荐：[tuijian.qiaomu.ai](https://tuijian.qiaomu.ai)

本项目基于 Elton Labs 的 [swayinfo/elton-reader](https://github.com/swayinfo/elton-reader) 改造。感谢原作者和所有贡献者。项目继续采用 MIT License，并保留原版权声明。

## English

Qiaomu Book Reader is a Chinese-first EPUB, FB2 and PDF reader for Obsidian. It keeps highlights, annotations, automatic reading progress and one dedicated Markdown reading note per book inside your own vault.

Install it with BRAT using `joeseesun/qiaomu-book-reader`, or download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/joeseesun/qiaomu-book-reader/releases/latest). The plugin ID is `qiaomu-book-reader`.

The reader works offline. Optional translation and AI passage analysis are off by default and send only the selected passage to the service you explicitly configure. See the Chinese section above for the full feature and privacy notes.

Maintained by [Qiaomu](https://qiaomu.ai). Based on the MIT-licensed [Elton Reader](https://github.com/swayinfo/elton-reader) project by Elton Labs, with thanks to its author and contributors.

## License

[MIT](LICENSE) · Third-party notices are listed in [NOTICE.md](NOTICE.md).
