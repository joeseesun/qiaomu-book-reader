import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { AI_PROVIDERS, aiProviderFor, buildAiRequestBody, buildAiRequestOptions, classifyAiHttpStatus, normalizeAiBase } from "../src/ai-providers.js";
import {
  buildCliInvocation,
  buildCliPrompt,
  cliReasoningEfforts,
  cliPathCandidates,
  createCliStreamParser,
  isCliAiProvider,
} from "../src/ai-cli.js";
import { READER_THEMES, READER_THEME_CHOICES, migrateReaderTheme } from "../src/reader-themes.js";
import { createOpenAiSseParser } from "../src/ai-stream.js";
import { isChineseSourceText, translateUiText } from "../src/i18n-runtime.js";
import { corruptBackupPath, createSerialTaskQueue, parseJsonRecord, readJsonRecordStore } from "../src/storage.js";

test("JSON stores reject arrays and invalid content instead of treating them as empty data", () => {
  assert.deepEqual(parseJsonRecord('{"book": {"pct": 0.5}}'), { book: { pct: 0.5 } });
  assert.throws(() => parseJsonRecord("[]"), /must contain a JSON object/);
  assert.throws(() => parseJsonRecord("not-json"), SyntaxError);
});

test("serial task queue preserves order and recovers after a failed save", async () => {
  const queue = createSerialTaskQueue();
  const calls = [];
  const first = queue.run(async () => { calls.push("first"); throw new Error("disk full"); });
  const second = queue.run(async () => { calls.push("second"); return 2; });
  await assert.rejects(first, /disk full/);
  assert.equal(await second, 2);
  assert.deepEqual(calls, ["first", "second"]);
});

test("unreadable JSON stores preserve raw content without overwriting the source", async () => {
  const files = new Map([["reading-progress.json", "{broken"]]);
  const writes = [];
  const adapter = {
    async exists(file) { return files.has(file); },
    async read(file) { return files.get(file); },
    async write(file, value) { writes.push([file, value]); files.set(file, value); },
  };
  const now = new Date("2026-09-02T10:20:30.456Z");
  const expectedBackup = corruptBackupPath("reading-progress.json", now);
  const result = await readJsonRecordStore(adapter, "reading-progress.json", "progress", now);
  assert.equal(result.status, "unreadable");
  assert.equal(result.value, null);
  assert.equal(result.backupPath, expectedBackup);
  assert.equal(files.get("reading-progress.json"), "{broken");
  assert.deepEqual(writes, [[expectedBackup, "{broken"]]);
});

test("read failures block the store without inventing a backup that was never written", async () => {
  const adapter = {
    async exists() { return true; },
    async read() { throw new Error("sync placeholder unavailable"); },
    async write() { throw new Error("must not write without raw content"); },
  };
  const result = await readJsonRecordStore(adapter, "reading-highlights.json", "highlights");
  assert.equal(result.status, "unreadable");
  assert.equal(result.value, null);
  assert.equal(result.backupPath, "");
  assert.match(result.error.message, /sync placeholder unavailable/);
});

test("reader persistence refuses to overwrite unreadable stores and reports real save failures", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /this\._blockedStores\.add\(path5\)/);
  assert.match(source, /if \(this\._blockedStores\.has\(path5\)\) return Promise\.resolve\(false\)/);
  assert.match(source, /results\.some\(\(result\) => result === false\)/);
  assert.match(source, /const saved = await this\._persistHighlights/);
  assert.match(source, /if \(!saved\) \{[\s\S]*Не удалось сохранить комментарий/);
  assert.match(source, /function renderReaderLoadError/);
  assert.match(source, /Попробовать снова/);
});

test("runtime diagnostics use the maintained plugin identity", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(?:error|warn|log)\("Book Reader:/);
  assert.doesNotMatch(source, /\bEltonReader\b/);
  assert.match(source, /const QiaomuBookReader = class extends Plugin/);
  assert.match(source, /export default QiaomuBookReader/);
});

test("Russian UI never leaks Chinese-first source keys", () => {
  const english = {
    "AI 解读": "AI reading",
    "Плагин поддерживается 向阳乔木": "The plugin is maintained by Qiaomu",
  };
  assert.equal(isChineseSourceText("AI 解读"), true);
  assert.equal(isChineseSourceText("Плагин поддерживается 向阳乔木"), false);
  assert.equal(translateUiText("zh", "AI 解读", english, {}), "AI 解读");
  assert.equal(translateUiText("en", "AI 解读", english, {}), "AI reading");
  assert.equal(translateUiText("ru", "AI 解读", english, {}), "AI reading");
  assert.equal(
    translateUiText("ru", "Плагин поддерживается 向阳乔木", english, {}),
    "Плагин поддерживается 向阳乔木",
  );
});

test("translation target labels follow the plugin interface language", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /const TRANSLATION_LANGUAGE_CHOICES = Object\.freeze/);
  assert.match(source, /\["zh-CN", "Китайский \(упрощённый\)"\]/);
  assert.match(source, /TRANSLATION_LANGUAGE_CHOICES\.forEach\(\(\[value, label\]\) => d\.addOption\(value, __ertr\(label\)\)\)/);
  assert.doesNotMatch(source, /\.addOption\("zh-CN", "简体中文"\)/);
});

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.03928
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test("AI presets contain supported providers and no legacy Elton service", () => {
  assert.equal(aiProviderFor("eltonlabs"), null);
  for (const id of ["codex-cli", "claude-cli", "grok-cli", "deepseek", "kimi", "qwen", "zhipu", "minimax", "siliconflow", "doubao", "openrouter", "openai", "ollama", "lmstudio", "custom"]) {
    assert.ok(AI_PROVIDERS[id], `missing provider: ${id}`);
  }
  for (const id of ["codex-cli", "claude-cli", "grok-cli"]) {
    assert.equal(AI_PROVIDERS[id].transport, "cli");
    assert.equal(AI_PROVIDERS[id].needsKey, false);
    assert.equal(AI_PROVIDERS[id].desktopOnly, true);
    assert.equal(isCliAiProvider(id), true);
  }
  assert.equal(AI_PROVIDERS.ollama.base, "http://localhost:11434/v1");
  assert.equal(AI_PROVIDERS.lmstudio.base, "http://localhost:1234/v1");
  assert.equal(normalizeAiBase(" https://example.com/v1/// "), "https://example.com/v1");
});

test("AI HTTP failures distinguish a rejected key from a refused request", () => {
  assert.equal(classifyAiHttpStatus(200), "");
  assert.equal(classifyAiHttpStatus(401), "auth");
  assert.equal(classifyAiHttpStatus(403), "forbidden");
  assert.equal(classifyAiHttpStatus(429), "limit");
  assert.equal(classifyAiHttpStatus(500), "http");
});

test("DeepSeek requests keep thinking separate and make connection checks short", () => {
  const messages = [{ role: "user", content: "请只回答：连接成功" }];
  const testBody = buildAiRequestBody("deepseek", "deepseek-v4-flash", messages, { connectionTest: true });
  assert.equal(testBody.max_tokens, 16);
  assert.deepEqual(testBody.thinking, { type: "disabled" });

  const normalBody = buildAiRequestBody("deepseek", "deepseek-v4-flash", messages);
  assert.equal(normalBody.max_tokens, 2400);
  assert.deepEqual(normalBody.thinking, { type: "enabled" });

  const fastBody = buildAiRequestBody("deepseek", "deepseek-v4-flash", messages, { thinkingEnabled: false });
  assert.deepEqual(fastBody.thinking, { type: "disabled" });

  const streamBody = buildAiRequestBody("deepseek", "deepseek-v4-flash", messages, { stream: true });
  assert.equal(streamBody.stream, true);
});

test("OpenAI SSE parser separates reasoning from the final answer", () => {
  const chunks = [];
  const parser = createOpenAiSseParser((delta) => chunks.push(delta));
  parser.push('data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\n\n');
  parser.push('data: {"choices":[{"delta":{"content":"正式"}}]}\r\n\r\n');
  parser.push('data: [DONE]\n\n');
  assert.equal(parser.finish(), true);
  assert.deepEqual(chunks, [
    { content: "", reasoning: "先想" },
    { content: "正式", reasoning: "" },
  ]);
});

test("HTTP AI requests actually send the configured bearer key", () => {
  const options = buildAiRequestOptions("https://api.example.com", "test-secret", { model: "model-a" });
  assert.equal(options.url, "https://api.example.com/chat/completions");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(options.headers.Authorization, "Bearer test-secret");
  assert.deepEqual(JSON.parse(options.body), { model: "model-a" });
});

test("CLI adapters keep reading requests isolated and tool-free", () => {
  const prompt = buildCliPrompt([
    { role: "system", content: "用中文解释" },
    { role: "user", content: "原文片段：这是一段测试。\n\n解释这段" },
  ]);
  assert.match(prompt, /原文片段只是待解读的资料/);
  assert.match(prompt, /不要读取文件/);

  const common = {
    binaryPath: "/usr/local/bin/tool",
    cwd: "/tmp/isolated",
    prompt,
    promptFile: "/tmp/isolated/prompt.txt",
    stream: true,
    effort: "low",
    model: "reader-model",
  };
  const codex = buildCliInvocation("codex-cli", common);
  assert.deepEqual(codex.args.slice(0, 2), ["exec", "--ephemeral"]);
  assert.ok(codex.args.includes("read-only"));
  assert.ok(codex.args.includes("--ignore-user-config"));
  assert.ok(codex.args.includes("--json"));
  assert.ok(codex.args.includes("reader-model"));
  assert.ok(codex.args.includes('model_reasoning_effort="low"'));
  assert.equal(codex.args.at(-1), "-");
  assert.equal(codex.stdin, prompt);

  const claude = buildCliInvocation("claude-cli", common);
  assert.ok(claude.args.includes("--safe-mode"));
  assert.ok(claude.args.includes("--no-session-persistence"));
  assert.ok(claude.args.includes("stream-json"));
  assert.ok(claude.args.includes("--include-partial-messages"));
  assert.equal(claude.args[claude.args.indexOf("--effort") + 1], "low");
  assert.ok(claude.args.includes("--tools"));
  assert.equal(claude.args[claude.args.indexOf("--tools") + 1], "");
  assert.equal(claude.stdin, prompt);

  const grok = buildCliInvocation("grok-cli", common);
  assert.ok(grok.args.includes("--prompt-file"));
  assert.ok(grok.args.includes("--disable-web-search"));
  assert.ok(grok.args.includes("--no-memory"));
  assert.ok(grok.args.includes("streaming-json"));
  assert.equal(grok.args[grok.args.indexOf("--reasoning-effort") + 1], "low");
  assert.equal(grok.stdin, "");
  for (const spec of [codex, claude, grok]) {
    assert.equal(spec.cwd, "/tmp/isolated");
    assert.ok(!spec.args.includes("bypassPermissions"));
    assert.ok(!spec.args.includes("danger-full-access"));
  }
});

test("CLI reasoning options are provider-specific", () => {
  assert.deepEqual(cliReasoningEfforts("codex-cli"), ["", "minimal", "low", "medium", "high", "xhigh"]);
  assert.deepEqual(cliReasoningEfforts("claude-cli"), ["", "low", "medium", "high", "xhigh", "max"]);
  assert.ok(!cliReasoningEfforts("grok-cli").includes("max"));
});

test("CLI stream parsers separate thoughts from the visible answer", () => {
  const cases = [
    {
      id: "codex-cli",
      chunks: [
        '{"type":"item.completed","item":{"type":"reasoning","text":"先想"}}\n',
        '{"type":"item.completed","item":{"type":"agent_message","text":"正式回答"}}\n',
      ],
    },
    {
      id: "claude-cli",
      chunks: [
        '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"先想"}}}\n',
        '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"正式"}}}\n',
        '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"回答"}}}\n',
      ],
    },
    {
      id: "grok-cli",
      chunks: [
        '{"type":"thought","data":"先想"}\n',
        '{"type":"text","data":"正式"}\n{"type":"text","data":"回答"}\n',
      ],
    },
  ];
  for (const sample of cases) {
    const deltas = [];
    const parser = createCliStreamParser(sample.id, (delta) => deltas.push(delta));
    sample.chunks.forEach((chunk) => parser.push(chunk));
    parser.finish();
    assert.deepEqual(parser.result(), { answer: "正式回答", reasoning: "先想", error: "" });
    assert.ok(deltas.some((delta) => delta.reasoning));
    assert.ok(deltas.some((delta) => delta.content));
  }
});

test("CLI detection includes GUI-safe common install locations", () => {
  const candidates = cliPathCandidates("codex-cli", {
    platform: "darwin",
    home: "/Users/reader",
    envPath: "/custom/bin:/usr/bin",
    pathApi: { join: (...parts) => parts.join("/").replace(/\/{2,}/g, "/") },
  });
  assert.ok(candidates.includes("/custom/bin/codex"));
  assert.ok(candidates.includes("/Users/reader/.local/bin/codex"));
  assert.ok(candidates.includes("/opt/homebrew/bin/codex"));
  assert.ok(candidates.indexOf("/Users/reader/.local/bin/codex") < candidates.indexOf("/custom/bin/codex"));
});

test("reading themes migrate legacy names and meet WCAG AA contrast", () => {
  assert.equal(migrateReaderTheme("light"), "paper");
  assert.equal(migrateReaderTheme("sepia"), "warm");
  assert.equal(migrateReaderTheme("dark"), "night");
  assert.deepEqual(READER_THEME_CHOICES, ["auto", "paper", "warm", "celadon", "night", "eink"]);
  for (const id of READER_THEME_CHOICES.filter((name) => name !== "auto")) {
    const theme = READER_THEMES[id];
    assert.ok(contrast(theme.bg, theme.text) >= 4.5, `${id} contrast is too low`);
  }
});

test("public README credits the upstream project without advertising legacy services", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.doesNotMatch(readme, /Elton AI|eltonlabs\.org|ai\.eltonlabs/i);
  assert.match(readme, /https:\/\/github\.com\/swayinfo\/elton-reader/);
  assert.match(readme, /感谢 Elton Reader 原作者 Elton Labs 及所有贡献者/);
  assert.match(readme, /Original copyright notices and third-party license information remain/);
  assert.match(readme, /DeepSeek/);
  assert.match(readme, /Codex CLI/);
  assert.match(readme, /Claude Code CLI/);
  assert.match(readme, /Grok CLI/);
  assert.match(readme, /CLI 模式仅支持桌面版 Obsidian/);
  assert.match(readme, /Obsidian 的密钥库/);
});

test("AI prompt and context are Chinese-first", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const start = source.indexOf("function aiSystemChat");
  const end = source.indexOf("const TranslateModal", start);
  const aiSource = source.slice(start, end);
  assert.match(aiSource, /你是一名克制、准确的阅读助手/);
  assert.match(aiSource, /书名：《/);
  assert.doesNotMatch(aiSource, /Из книги|Фрагмент|Перевод|По словам/);
});

test("selection popup keeps primary actions compact and moves note tools into More", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = source.indexOf("function addBarButtons");
  const end = source.indexOf("const AiExplainModal", start);
  const popupSource = source.slice(start, end);
  assert.match(popupSource, /view\.plugin\.settings\.aiEnabled && aiReady/);
  assert.match(popupSource, /act\("er-hl-ai", "wand-sparkles"/);
  assert.match(popupSource, /new AiExplainModal\(view\.app, view\.plugin, cur\.text, view\.file, view\)\.open\(\)/);
  assert.match(popupSource, /act\("er-hl-menu", "more"/);
  assert.match(popupSource, /setTitle\(__ertr\("Создать заметку"\)\)/);
  assert.match(popupSource, /setTitle\(__ertr\("Удалить выделение"\)\)/);
  assert.doesNotMatch(popupSource, /act\("er-hl-note"/);
  assert.match(source, /createDiv\(\{ cls: "er-hl-comment-quote", text: cur\.text \}\)/);
  assert.match(source, /e\.key === "Enter" && !e\.shiftKey/);
  assert.match(source, /e\.key === "Escape"[\s\S]*view\._hideHlPopup\(\)/);
  assert.match(css, /\.er-hl-popup-commenting \.er-hl-actions \{ display:none; \}/);
  assert.match(css, /-webkit-line-clamp:3/);
  assert.doesNotMatch(source, /brain-circuit/);
});

test("AI dialog offers editable quick prompts and keeps reasoning separate", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const chinese = fs.readFileSync(new URL("../src/i18n-zh.js", import.meta.url), "utf8");
  for (const label of ["解释一下", "举个例子", "总结要点", "对我有什么用", "换个角度看", "出题考考我"]) {
    assert.match(chinese, new RegExp(label));
  }
  assert.match(source, /const DEFAULT_AI_QUICK_PROMPTS/);
  assert.match(source, /const AiPromptLibraryModal = class extends Modal/);
  assert.match(source, /new AiPromptLibraryModal\(this\.app, this\.plugin/);
  assert.match(source, /chip\.addEventListener\("click", \(\) => this\._send\(item\.prompt\)\)/);
  assert.match(source, /this\.plugin\.settings\.aiQuickPrompts = this\.usingDefaults \? null : clean/);
  assert.match(source, /this\.items\.splice\(index, 1\)/);
  assert.match(source, /createEl\("details", \{ cls: "er-ai-reason" \}\)/);
  assert.match(source, /reasoningBox\.open = false/);
  assert.match(source, /onDelta/);
});

test("book-note append asks to open only once", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const start = source.indexOf("async function exportHighlightsToBookNote");
  const end = source.indexOf("const HighlightExportModal", start);
  const exportSource = source.slice(start, end);
  assert.match(source, /bookNoteAppendPromptSeen: false/);
  assert.match(exportSource, /bookNoteAppendPromptSeen !== true/);
  assert.match(exportSource, /bookNoteAppendPromptSeen = true/);
  assert.match(exportSource, /await plugin\._saveLocalData\(\)/);
});

test("reader themes stay on the page while navigation follows Obsidian", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.er-top \{[^}]*background:var\(--background-primary\)/s);
  assert.match(css, /\.er-bot \{[^}]*background:var\(--background-primary\)/s);
  assert.match(css, /\.er-area \{[^}]*background:var\(--er-bg/s);
  assert.doesNotMatch(css, /\.er-top, \.er-bot \{ background:color-mix\([^}]*--er-bg/s);
});

test("settings use task tabs, concise intros, and Chinese-first copy", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const chinese = fs.readFileSync(new URL("../src/i18n-zh.js", import.meta.url), "utf8");
  assert.match(source, /er-settings-head/);
  assert.match(source, /er-settings-intro/);
  assert.match(source, /body\.dataset\.tab = this\._tab/);
  assert.match(chinese, /"Ширина строки": "每行字数"/);
  assert.match(chinese, /"Данные": "存储与同步"/);
  assert.match(chinese, /只改变书页；顶部和底部工具栏始终跟随 Obsidian/);
  assert.match(chinese, /按自己的阅读习惯调整，所有设置都会自动保存/);
  assert.match(chinese, /"Подтвердить": "确定"/);
  assert.match(source, /const baseMustBeVisible = providerId === "custom"/);
  assert.match(source, /aiModels: \{\}/);
  assert.match(source, /aiThinking: \{\}/);
  assert.match(source, /aiCliEfforts: \{\}/);
  assert.match(source, /p\.transport === "cli" \|\| !p\.model \|\| p\.local/);
  assert.match(source, /setName\(__ertr\("思考强度"\)\)/);
  assert.match(source, /setName\(__ertr\("Режим мышления"\)\)/);
  assert.match(source, /advanced\.open = modelIsCustom \|\| baseIsCustom/);
  assert.match(source, /createEl\("details", \{ cls: "er-ai-advanced" \}\)/);
  assert.match(source, /createEl\("details", \{ cls: "er-settings-disclosure" \}\)/);
  assert.match(source, /setName\(__ertr\("正文字体"\)\)/);
  assert.match(source, /setName\(__ertr\("字号"\)\)/);
  assert.match(source, /setName\(__ertr\("行距"\)\)/);
  assert.match(source, /labels: \{ ru: "Georgia", en: "Georgia", zh: "Georgia" \}/);
  assert.match(source, /labels: \{ ru: "Lora", en: "Lora", zh: "Lora" \}/);
  assert.match(source, /labels: \{ ru: "Inter", en: "Inter", zh: "Inter" \}/);
});

test("quote template is language-neutral and migrates the old Russian fragment", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /const QUOTE_TEMPLATE_DEFAULT = "> \{text\}\\n\\n— \[\[\{book\}\]\]\{page\}\{link\}"/);
  assert.doesNotMatch(source, /— из \[\[\{book\}\]\]/i);
  assert.match(source, /quoteTemplate\.replace\(\/\u2014\\s\+из/);
});

test("reading settings own their scroll area without horizontal overflow", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.er-rs-modal \.modal-content\.er-rs \{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable/s);
  assert.match(css, /\.er-rs > \*, \.er-rs-card, \.er-rs-col, \.er-rs-quick, \.er-rs-grid \{[^}]*min-width:0/s);
  assert.match(css, /\.er-rs-modal \.modal-content\.er-rs \{[^}]*padding-right:calc\(var\(--er-pad\) \+ 8px\)/s);
});

test("reading settings split reading and AI assistance without exposing secrets", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = source.indexOf("const ReadSettingsModal");
  const end = source.indexOf("function parseNoteTags", start);
  const modalSource = source.slice(start, end);
  assert.match(modalSource, /initialTab = "reading"/);
  assert.match(modalSource, /\[\["reading", __ertr\("阅读"\)\], \["ai", __ertr\("AI 助读"\)\]\]/);
  assert.match(modalSource, /_drawAi\(c\)/);
  assert.match(modalSource, /setName\(__ertr\("当前服务"\)\)/);
  assert.match(modalSource, /setName\(__ertr\("回答语言"\)\)/);
  assert.match(modalSource, /setName\(__ertr\("快捷问题"\)\)/);
  assert.match(modalSource, /openPluginAiSettings\(this\.app, plugin\)/);
  assert.doesNotMatch(modalSource, /SecretComponent|API 密钥|接口地址/);
  assert.match(source, /new ReadSettingsModal\(this\.app, this\.readerView, "ai"\)\.open\(\)/);
  assert.match(css, /\.er-rs-tabs \{/);
  assert.match(css, /\.er-rs-ai-card \{/);
});
