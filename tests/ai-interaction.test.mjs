import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";
import { bindAiComposer } from "../src/ai-composer.js";
import { suggestAiNoteTitle } from "../src/ai-note-title.js";
import { shouldFollowContext } from "../src/reader-experience.js";
import { verifiedQuotes } from "../src/reading-workflow.js";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function dom() {
  const { window } = new JSDOM("<main></main>");
  const proto = window.HTMLElement.prototype;
  proto.createEl = function(tag, opts = {}) {
    const el = this.ownerDocument.createElement(tag);
    if (typeof opts === "string") el.className = opts;
    else { el.className = opts.cls || ""; el.textContent = opts.text || ""; }
    this.append(el);
    return el;
  };
  proto.createDiv = function(opts) { return this.createEl("div", opts); };
  proto.createSpan = function(opts) { return this.createEl("span", opts); };
  proto.addClass = function(...names) { this.classList.add(...names); };
  proto.removeClass = function(...names) { this.classList.remove(...names); };
  proto.setText = function(text) { this.textContent = text; };
  proto.empty = function() { this.replaceChildren(); };
  proto.setCssProps = function(props) { for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value); };
  return window;
}

function composer() {
  const window = dom();
  const input = window.document.createElement("textarea");
  const send = window.document.createElement("button");
  window.document.body.append(input, send);
  const calls = [];
  let settle;
  const chat = {
    busy: false, canCancel: true, _setSending() {},
    async _send(text) {
      this.busy = true;
      calls.push(text);
      const result = await new Promise((resolve) => { settle = resolve; });
      this.busy = false;
      return result;
    },
  };
  bindAiComposer(input, send, chat);
  const enter = (opts = {}) => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", cancelable: true, ...opts }));
  const type = (text) => { input.value = text; input.dispatchEvent(new window.Event("input")); };
  return { window, input, send, chat, calls, enter, type, finish: (result) => settle(result) };
}

test("quick prompts stay visible in new and existing chats, including while sending", () => {
  const renderSource = source.slice(source.indexOf("function renderAiComposerPrompts("), source.indexOf("function bindAiSlashPrompts("));
  const sendingStart = source.indexOf("  _setSending(busy) {");
  const sendingSource = source.slice(sendingStart, source.indexOf("\n  // Obsidian", sendingStart));
  const items = ["解释一下", "举个例子", "总结要点", "自定义问题"].map((name) => ({ name, prompt: `prompt:${name}` }));
  let menu;
  class Menu {
    constructor() { this.entries = []; menu = this; }
    addItem(build) {
      const entry = { setTitle(title) { this.title = title; return this; }, onClick(fn) { this.click = fn; return this; } };
      build(entry); this.entries.push(entry);
    }
    showAtMouseEvent() {}
  }
  const sandbox = { aiQuickPrompts: () => items, __ertr: (s) => s, Menu, svgIcon() {} };
  const render = vm.runInNewContext(`${renderSource}\nrenderAiComposerPrompts`, sandbox);
  const setSending = vm.runInNewContext(`({${sendingSource}})._setSending`, sandbox);
  for (const turns of [[], [{ role: "assistant", content: "Existing answer" }]]) {
    const window = dom();
    const host = window.document.querySelector("main");
    const calls = [];
    const send = window.document.createElement("button");
    send.toggleClass = (name, enabled) => send.classList.toggle(name, enabled);
    const chat = { plugin: { settings: {} }, turns, _send: (prompt) => calls.push(prompt), sendEl: send, canCancel: true };
    const row = render(host, chat);
    assert.equal(row.hidden, false);
    assert.equal(host.querySelector(".er-ai-prompt-expand"), null);
    assert.equal(chat.quickPromptButtons.length, 4);
    chat.quickPromptButtons[0].click();
    assert.deepEqual(calls, [items[0].prompt], "one click sends the configured prompt");
    chat.busy = true;
    setSending.call(chat, true);
    assert.equal(row.hidden, false, "generation must not collapse prompts");
    assert.ok(chat.quickPromptButtons.every((button) => button.disabled));
    chat.quickPromptButtons[1].click();
    assert.equal(calls.length, 1);
    chat.busy = false;
    setSending.call(chat, false);
    assert.equal(row.hidden, false);
    assert.ok(chat.quickPromptButtons.every((button) => !button.disabled));
    chat.quickPromptButtons[3].click();
    assert.equal(menu.entries[0].title, "自定义问题");
    menu.entries[0].click();
    assert.equal(calls[1], items[3].prompt);
  }
  items.length = 0;
  const host = dom().document.querySelector("main");
  assert.equal(render(host, { plugin: { settings: {} } }), null);
  assert.equal(host.children.length, 0, "empty settings do not leave an unused expander");
  assert.doesNotMatch(source, /promptExpand|promptRow/);
});

test("IME candidate confirmation, Shift+Enter and composing keyCode do not submit", async () => {
  const c = composer();
  c.type("解释这段话");
  c.input.dispatchEvent(new c.window.CompositionEvent("compositionstart"));
  c.enter();
  c.input.dispatchEvent(new c.window.CompositionEvent("compositionend"));
  c.enter({ isComposing: true });
  c.enter({ keyCode: 229 });
  c.enter({ shiftKey: true });
  assert.deepEqual(c.calls, []);
  assert.equal(c.input.value, "解释这段话");
  c.enter();
  assert.deepEqual(c.calls, ["解释这段话"]);
  c.finish(true);
  await tick();
});

test("Enter during generation preserves the next draft; an earlier failure does not overwrite it", async () => {
  const c = composer();
  c.type("第一个问题");
  c.enter();
  c.type("尚未发送的追问");
  c.enter();
  assert.equal(c.input.value, "尚未发送的追问");
  assert.equal(c.calls.length, 1);
  c.finish(false);
  await tick();
  assert.equal(c.input.value, "尚未发送的追问");
});

test("failed sends restore untouched input, but respect a deliberately cleared draft", async () => {
  const c = composer();
  c.type("请解释");
  c.enter();
  c.finish(false);
  await tick();
  assert.equal(c.input.value, "请解释");
  c.enter();
  c.type("新草稿");
  c.type("");
  c.finish(false);
  await tick();
  assert.equal(c.input.value, "");
});

function chatHarness(explain, overrides = {}) {
  const window = dom();
  const context = {
    window, AbortController, Modal: class {}, console: { error() {} },
    __ertr: (s) => s, newAiSessionKey: () => window.crypto.randomUUID(),
    normalizeAiTurnContext: (value) => value ? { ...value } : null,
    svgIcon() {}, verifiedQuotes, aiExplain: explain, copyToClipboard: async () => true, Notice: class {},
    createNoteFromAiAnswer: async () => null,
    renderAiUserTurn: (log, turn) => log.createDiv({ cls: "er-ai-msg-me", text: turn.content }),
    createAiStreamingMarkdownRenderer: (_owner, el, _path, opts) => ({
      update(text) { const follow = opts.beforeRender(); el.setText(text); opts.afterRender(follow); },
      async finish(text) { const follow = opts.beforeRender(); el.setText(text); opts.afterRender(follow); },
      dispose() {},
    }),
    ...overrides,
  };
  const helpers = source.slice(source.indexOf("function aiLogFollowsTail("), source.indexOf("function createAiStreamingMarkdownRenderer("));
  const cls = source.slice(source.indexOf("const AiExplainModal = class"), source.indexOf("// Desktop AI stays docked"));
  const { Chat, createLog } = vm.runInNewContext(`${helpers}\n${cls}\n({ Chat: AiExplainModal, createLog: createAiChatLog })`, context);
  const chat = Object.create(Chat.prototype);
  Object.assign(chat, { plugin: { settings: {} }, app: {}, turns: [], structuredContext: true,
    book: "测试书", bookFile: { path: "books/test.epub" },
    pendingContext: { kind: "selection", text: "原文" },
    aiSessionKey: "initial", _setSending() {}, persisted: 0,
    async _persistSession() { this.persisted += 1; },
  });
  chat.log = createLog(window.document.querySelector("main"), chat);
  return { chat, window };
}

for (const reason of ["cancelled", "timeout", "acpstopped"]) {
  test(`${reason} keeps partial Markdown, source, actions and history`, async () => {
    const { chat } = chatHarness(async (_text, _plugin, _turns, _book, { onDelta }) => {
      onDelta({ content: "## 已输出\n\n有价值的内容" });
      throw Object.assign(new Error(reason), { erReason: reason });
    });
    assert.equal(await chat._send("解释原文"), true);
    assert.equal(chat.turns.length, 2);
    assert.equal(chat.turns[0].context.text, "原文");
    assert.equal(chat.turns[1].content, "## 已输出\n\n有价值的内容");
    assert.equal(chat.turns[1].interrupted, true);
    assert.match(chat.log.textContent, /有价值的内容/);
    assert.equal(chat.log.querySelectorAll(".er-ai-act").length, 3);
    assert.equal(chat.busy, false);
    assert.equal(chat.persisted, 1);
    assert.notEqual(chat.aiSessionKey, "initial");
  });
}

test("a failure before content leaves no unanswered model turn", async () => {
  const { chat } = chatHarness(async () => { throw Object.assign(new Error(), { erReason: "timeout" }); });
  assert.equal(await chat._send("解释原文"), false);
  assert.equal(chat.turns.length, 0);
  assert.equal(chat.busy, false);
});

test("old answer regeneration cannot mutate a later question", async () => {
  const { chat } = chatHarness(async () => "回答");
  await chat._send("问题一");
  const oldButton = chat.log.querySelector(".er-ai-regenerate");
  await chat._send("问题二");
  assert.equal(oldButton.isConnected, false);
  oldButton.click();
  assert.equal(chat.turns.length, 4);
  assert.equal(chat.turns[2].content, "问题二");
  assert.equal(chat.log.querySelectorAll(".er-ai-regenerate").length, 1);
});

test("answer completion respects reading earlier text and offers a jump back", async () => {
  let finish;
  const { chat, window } = chatHarness(async () => new Promise((resolve) => { finish = resolve; }));
  Object.defineProperties(chat.log, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  const running = chat._send("问题");
  chat.log.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -100 }));
  chat.log.scrollTop = 100;
  chat.log.dispatchEvent(new window.Event("scroll"));
  finish("完成的回答");
  await running;
  assert.equal(chat.log.scrollTop, 100);
  const jump = window.document.querySelector(".er-ai-jump-latest");
  assert.equal(jump.hidden, false);
  jump.click();
  assert.equal(chat.log.scrollTop, 1000);
  assert.equal(jump.hidden, true);
});

test("saving an answer writes once, keeps the conversation open, and opens only on a second click", async () => {
  let saved;
  let writes = 0;
  let opens = 0;
  let closes = 0;
  const { chat } = chatHarness(async () => "AI 回答正文", {
    createNoteFromAiAnswer: async (...args) => { writes++; saved = args; return { path: "notes/answer.md" }; },
  });
  chat.app.workspace = { async openLinkText(path) { opens++; assert.equal(path, "notes/answer.md"); } };
  chat.app.vault = { getAbstractFileByPath: (path) => ({ path }) };
  chat.close = () => { closes++; };
  await chat._send("为什么");
  const button = [...chat.log.querySelectorAll(".er-ai-act")].find((el) => el.textContent === "保存 AI 回复");
  button.click();
  await tick();
  assert.equal(saved[2], "AI 回答正文");
  assert.equal(saved[3], "为什么");
  assert.equal(saved[4].text, "原文");
  assert.equal(saved[6].open, false);
  assert.equal(button.textContent, "已保存 · 打开笔记");
  assert.equal(opens, 0);
  assert.equal(closes, 0);
  button.click();
  await tick();
  assert.equal(opens, 1);
  assert.equal(writes, 1);
});

test("sending refreshes the page once and freezes source while generation continues", async () => {
  let finish;
  const { chat } = chatHarness(async () => new Promise((resolve) => { finish = resolve; }));
  chat._prepareContext = () => { chat.pendingContext = { kind: "page", text: "发送瞬间页面" }; };
  const pending = chat._send("解释");
  chat.pendingContext.text = "后来翻到的页面";
  assert.equal(chat.turns[0].context.text, "发送瞬间页面");
  finish("回答");
  await pending;
  assert.equal(chat.turns[0].context.text, "发送瞬间页面");
});

test("answer save captures its original book and retains saved-note metadata", async () => {
  let args;
  const { chat } = chatHarness(async () => "回答", {
    createNoteFromAiAnswer: async (...value) => { args = value; return { path: "notes/original.md" }; },
  });
  const book = chat.bookFile;
  await chat._send("问题");
  chat.bookFile = { path: "books/another.epub" };
  chat.log.querySelectorAll(".er-ai-act")[1].click();
  await tick();
  assert.equal(args[5], book);
  assert.equal(chat.turns[1].savedNotePath, "notes/original.md");
});

test("re-rendering a saved reply opens its existing note; a deleted note can be saved again", async () => {
  let writes = 0, opens = 0, exists = true;
  const { chat } = chatHarness(async () => "回答", {
    createNoteFromAiAnswer: async () => { writes++; return { path: "notes/saved.md" }; },
  });
  chat.app.vault = { getAbstractFileByPath: (path) => exists ? { path } : null };
  chat.app.workspace = { async openLinkText() { opens++; } };
  await chat._send("问题");
  chat.turns[1].savedNotePath = "notes/saved.md";
  const group = chat.log.createDiv();
  chat._actions(group, "回答", { turn: chat.turns[0], answerTurn: chat.turns[1] });
  const save = group.querySelectorAll("button")[1];
  assert.equal(save.textContent, "已保存 · 打开笔记");
  save.click();
  await tick();
  assert.equal(opens, 1);
  assert.equal(writes, 0);
  exists = false;
  save.click();
  await tick();
  assert.equal(writes, 1);
});

function sidebarHarness() {
  const window = dom();
  class File { constructor(path) { this.path = path; this.basename = path; } }
  const files = new Map(["a.epub", "b.epub"].map((path) => [path, new File(path)]));
  const normalize = source.slice(source.indexOf("function normalizeAiChatHistory("), source.indexOf("function normalizeAiTurnContext("));
  const cls = source.slice(source.indexOf("const AiChatView = class"), source.indexOf('for (const method of ["_setSending"'));
  const context = {
    window, ItemView: class {}, TFile: File, __ertr: (s) => s, Notice: class {},
    normalizeAiTurnContext: (value) => value?.text ? { kind: value.kind, text: value.text } : null,
    newAiSessionKey: () => window.crypto.randomUUID(), aiChatTitle: () => "会话",
    clearAiSource() {}, erAutoFocus() {}, shouldFollowContext,
    bookNoteLinkFor: () => "", aiTurnsHaveDocumentContext: (turns) => turns.some((turn) => turn.context?.kind === "document"),
    readerDefaultAiContext: () => ({ kind: "page", text: "当前页" }),
  };
  const { Chat, normalizeHistory } = vm.runInNewContext(`${normalize}\n${cls}\n({ Chat: AiChatView, normalizeHistory: normalizeAiChatHistory })`, context);
  const texts = new Map();
  const chat = new Chat({}, { settings: { aiChatHistory: [] }, aiDraftStore: { texts, set: (key, text) => texts.set(key, text) }, async saveAll() {} });
  chat.app = { vault: { getAbstractFileByPath: (path) => files.get(path) } };
  chat.contentEl = window.document.querySelector("main");
  chat._renderConversation = function() {
    this.contentEl.empty();
    this.inputEl = this.contentEl.createEl("textarea");
    this.pendingContextHost = this.contentEl.createDiv();
  };
  chat._refreshPendingContext = () => {};
  chat._renderUnavailable = () => chat.contentEl.empty();
  return { chat, files, normalizeHistory };
}

test("switching books isolates drafts, including returning to stored history", async () => {
  const { chat, files } = sidebarHarness();
  const select = (path) => chat.setContext({ kind: "page", text: path, bookFile: files.get(path) });
  select("a.epub");
  chat.inputEl.value = "A 的未发送草稿";
  chat.turns = [{ role: "user", content: "A问题" }, { role: "assistant", content: "A回答" }];
  select("b.epub");
  assert.equal(chat.inputEl.value, "");
  chat.inputEl.value = "B 的未发送草稿";
  select("a.epub");
  assert.equal(chat.inputEl.value, "A 的未发送草稿");
  assert.equal(chat.turns[1].content, "A回答");
  select("b.epub");
  assert.equal(chat.inputEl.value, "B 的未发送草稿");
  chat._newChat();
  assert.equal(chat.inputEl.value, "B 的未发送草稿");
  assert.equal(chat.turns.length, 0);
});

test("manual conversation titles survive persistence and reset for new conversations", async () => {
  const { chat, files, normalizeHistory } = sidebarHarness();
  chat.bookFile = files.get("a.epub");
  const session = { id: "renamed", title: "我自己的标题", titleEdited: true, bookPath: "a.epub", contextVersion: 1, turns: [{ role: "user", content: "问题" }, { role: "assistant", content: "答案" }] };
  chat.loadSession(session, { skipPersist: true });
  await chat._persistSession();
  assert.equal(chat.plugin.settings.aiChatHistory[0].title, "我自己的标题");
  assert.equal(normalizeHistory(chat.plugin.settings.aiChatHistory)[0].titleEdited, true);
  chat._newChat();
  assert.equal(chat.sessionTitle, "");
});

test("switching books before a send settles cannot erase the recoverable question", () => {
  const { chat, files } = sidebarHarness();
  chat.setContext({ kind: "page", text: "A", bookFile: files.get("a.epub") });
  chat.plugin.aiDraftStore.set("a.epub", "尚未确认发送的问题");
  chat.inputEl.value = "";
  chat.busy = false;
  chat.inputController = { pending: true };
  chat._rememberDraft();
  assert.equal(chat.drafts.get("a.epub"), "尚未确认发送的问题");
});

test("explicitly detached sources stay detached after persistence and normalization", async () => {
  const { chat, normalizeHistory } = sidebarHarness();
  chat.text = "旧页面";
  chat.turns = [{ role: "user", content: "不引用的问题" }, { role: "assistant", content: "回答", savedNotePath: "notes/a.md" }];
  await chat._persistSession();
  const [record] = normalizeHistory(chat.plugin.settings.aiChatHistory);
  assert.equal(record.turns[0].context, undefined);
  assert.equal(record.turns[1].savedNotePath, "notes/a.md");
  const [legacy] = normalizeHistory([{ id: "old", text: "旧版原文", turns: chat.turns }]);
  assert.equal(legacy.turns[0].context.text, "旧版原文");
});

test("deleting the active history starts fresh without resurrecting it", async () => {
  const { chat, files } = sidebarHarness();
  chat.setContext({ kind: "page", text: "正文", bookFile: files.get("a.epub") });
  chat.turns = [{ role: "user", content: "问题" }, { role: "assistant", content: "回答" }];
  await chat._persistSession();
  const id = chat.chatRecordId;
  await chat._removeHistory((item) => item.id === id);
  assert.equal(chat.turns.length, 0);
  await chat._persistSession();
  assert.equal(chat.plugin.settings.aiChatHistory.length, 0);
});

test("failed history deletion preserves the current conversation and stored items", async () => {
  const { chat } = sidebarHarness();
  chat.turns = [{ role: "user", content: "问题" }, { role: "assistant", content: "回答" }];
  await chat._persistSession();
  chat.plugin.saveAll = async () => { throw new Error("disk full"); };
  await chat._removeHistory(() => true);
  assert.equal(chat.turns.length, 2);
  assert.equal(chat.plugin.settings.aiChatHistory.length, 1);
  assert.equal(chat._historySaving, false);
  await chat._persistSession();
  assert.equal(chat._historySaveFailed, true);
});

test("note-saving integration uses the answer topic, never the generic question", async () => {
  let result;
  const fn = source.slice(source.indexOf("async function createNoteFromAiAnswer("), source.indexOf("function _escHtml("));
  const save = vm.runInNewContext(`${fn}\ncreateNoteFromAiAnswer`, {
    __ertr: (s) => s, suggestAiNoteTitle,
    normalizeAiTurnContext: (context) => context,
    createNoteFromSelection: (...args) => { result = args; },
  });
  const answer = "## 重要性如何放大紧张\n\n**紧张会损害决策质量。**";
  await save({}, {}, answer, "解释一下", { text: "书中原文" }, { path: "a.epub" });
  assert.equal(result[2], "重要性如何放大紧张");
  assert.equal(result[4].noteBody, answer);
  assert.equal(result[4].sourceText, "书中原文");
});

function titleModal() {
  const window = dom();
  const results = [];
  const cls = source.slice(source.indexOf("const NoteTitleModal = class"), source.indexOf("function processTemplateManually("));
  class Modal {
    constructor() { this.contentEl = window.document.querySelector("main"); }
    close() { this.onClose(); }
  }
  const NoteModal = vm.runInNewContext(`${cls}\nNoteTitleModal`, {
    Modal, __ertr: (s) => s, sanitizeNoteTitle: (s) => s, suggestNoteTitle: (s) => s,
    notesFolderPath: () => "", allVaultTags: () => [], FolderSuggest: null,
    parseNoteTags: () => [], erPath: (s) => s, erAutoFocus() {},
  });
  const modal = new NoteModal({}, { settings: {}, _saveLocalData: async () => {} }, "重要性如何放大紧张", null, (value) => results.push(value), { kind: "ai-answer" });
  modal.onOpen();
  return { modal, window, results, input: modal.contentEl.querySelector("input") };
}

test("title form allows editing and ignores IME Enter; submit fires once", async () => {
  const { modal, window, input, results } = titleModal();
  assert.equal(input.value, "重要性如何放大紧张");
  assert.ok(input.getAttribute("aria-label"));
  input.value = "我修改的主题";
  const enter = (opts) => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ...opts }));
  enter({ isComposing: true });
  assert.equal(results.length, 0);
  enter();
  enter();
  modal.onClose();
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "我修改的主题");
});

test("invalid note names show an accessible error; cancelling creates nothing", () => {
  const { modal, window, input, results } = titleModal();
  input.value = "///...";
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter" }));
  assert.equal(results.length, 0);
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(modal.contentEl.querySelector('[role="alert"]').hidden, false);
  modal.close();
  assert.deepEqual(results, [null]);
});
