import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { searchBookBlocks, searchableQuery, nextSearchIndex } from "../src/reader-search.js";
import { loadAiDrafts, normalizeDrafts } from "../src/ai-drafts.js";
import { aiAnswerMarker, appendAiAnswer, verifiedQuotes, normalizeLocationMarks } from "../src/reading-workflow.js";
import { bindAiComposer } from "../src/ai-composer.js";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("search supports single Han, literal metacharacters and original Unicode offsets", () => {
  assert.equal(searchableQuery("书"), "书");
  assert.equal(searchableQuery("a"), "");
  assert.equal(searchableQuery("  "), "");
  assert.deepEqual(searchBookBlocks(["İ前言 书与书"], "书").map((h) => h.offset), [4, 6]);
  assert.deepEqual(searchBookBlocks(["A+B a+b"], "a+b").map((h) => h.offset), [0, 4]);
  assert.equal(searchBookBlocks(["书".repeat(500)], "书").length, 300);
  assert.equal(nextSearchIndex(-1, -1, 3), 2);
  assert.equal(nextSearchIndex(2, 1, 3), 0);
  assert.equal(nextSearchIndex(0, -1, 3), 2);
});

function memoryAdapter(initial = {}) {
  const files = new Map(Object.entries(initial));
  return { files, fail: false,
    async exists(path) { return files.has(path); },
    async read(path) { return files.get(path); },
    async write(path, data) { if (this.fail) throw Error("Disk full"); files.set(path, data); },
    async process(path, fn) { if (this.fail) throw Error("Disk full"); files.set(path, fn(files.get(path))); },
  };
}

test("drafts survive restart, isolate books, and clear without touching other books", async () => {
  const adapter = memoryAdapter();
  const store = await loadAiDrafts(adapter, "drafts.json", null, globalThis);
  store.set("a.epub", "问题 A"); store.set("b.pdf", "问题 B");
  await store.flush();
  const reopened = await loadAiDrafts(adapter, "drafts.json", null, globalThis);
  assert.equal(reopened.texts.get("a.epub"), "问题 A");
  reopened.set("a.epub", ""); await reopened.flush();
  assert.deepEqual(JSON.parse(adapter.files.get("drafts.json")), { "b.pdf": { text: "问题 B", updatedAt: JSON.parse(adapter.files.get("drafts.json"))["b.pdf"].updatedAt } });
});

test("draft caps evict the oldest books and reject malformed records", () => {
  const value = Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`${i}.epub`, { text: "x".repeat(21000), updatedAt: i }]));
  value.bad = { text: 123 };
  const result = normalizeDrafts(value);
  assert.equal(Object.keys(result).length, 30);
  assert.equal(result["0.epub"], undefined);
  assert.equal(result["34.epub"].text.length, 20000);
});

test("draft write failures retain memory, retry safely, and never overwrite corrupt data", async () => {
  const adapter = memoryAdapter(); let notices = 0;
  const store = await loadAiDrafts(adapter, "drafts.json", () => notices++, globalThis);
  adapter.fail = true; store.set("a.epub", "保留"); await store.flush();
  assert.equal(store.texts.get("a.epub"), "保留"); assert.equal(notices, 1);
  adapter.fail = false; await store.flush();
  assert.equal(JSON.parse(adapter.files.get("drafts.json"))["a.epub"].text, "保留");
  adapter.files.set("drafts.json", "{broken");
  store.set("a.epub", "新版"); await store.flush();
  assert.equal(adapter.files.get("drafts.json"), "{broken");
  const reopened = await loadAiDrafts(adapter, "drafts.json", () => notices++, globalThis);
  reopened.set("b.pdf", "暂存"); await reopened.flush();
  assert.equal(adapter.files.get("drafts.json"), "{broken");
});

test("draft stays durable while sending; a new follow-up survives older completion", async () => {
  const { window } = new JSDOM("<textarea></textarea><button></button>");
  const input = window.document.querySelector("textarea"), button = window.document.querySelector("button");
  input.setCssProps = () => {};
  let settle, saved;
  const chat = { _setSending() {}, _send: () => new Promise((resolve) => { settle = resolve; }) };
  bindAiComposer(input, button, chat, { onDraftChange: (value) => { saved = value; } });
  const type = (value) => { input.value = value; input.dispatchEvent(new window.Event("input")); };
  type("第一个问题"); button.click();
  assert.equal(saved, "第一个问题");
  type("下一轮草稿"); settle(true); await tick();
  assert.equal(saved, "下一轮草稿");
  button.click(); settle(false); await tick();
  assert.equal(saved, "下一轮草稿");
  button.click(); settle(true); await tick();
  assert.equal(saved, "");
});

test("AI append preserves Markdown and existing prose, deduplicates by full answer and book", async () => {
  const answer = "## 核心观点\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [ ] 保留任务";
  const marker = await aiAnswerMarker("book.epub", answer, webcrypto);
  const result = appendAiAnswer("# 用户笔记\n\n不能覆盖", { title: "标题", answer, marker });
  assert.ok(result.startsWith("# 用户笔记\n\n不能覆盖"));
  assert.ok(result.includes(answer));
  assert.equal(appendAiAnswer(result, { title: "另一个标题", answer, marker }), result);
  assert.notEqual(await aiAnswerMarker("other.epub", answer, webcrypto), marker);
  assert.notEqual(await aiAnswerMarker("book.epub", answer + "。", webcrypto), marker);
});

test("only quoted text actually contained in sent sources becomes a citation", () => {
  const answer = "作者说“机械化策略可以缓解紧张情绪”，以及“这是一段模型编造的引文”。\n> 机械化策略可以缓解紧张情绪\n第 100 页";
  assert.deepEqual(verifiedQuotes(answer, ["机械化策略可以\n缓解紧张情绪。"]), ["机械化策略可以缓解紧张情绪"]);
  assert.deepEqual(verifiedQuotes(answer, []), []);
});

test("bookmarks normalize durable text and PDF anchors without keeping DOM references", () => {
  const valid = { id: "x", bookPath: "book.pdf", title: "第七页", anchor: { block: 4, offset: 2, pct: .5, pdfPage: 7, node: {} } };
  const marks = normalizeLocationMarks([null, {}, { ...valid, anchor: { block: -1 } }, valid]);
  assert.equal(marks.length, 1);
  assert.deepEqual(marks[0].anchor, { block: 4, offset: 2, pct: .5, pdfPage: 7 });
});

test("history filtering never replaces Obsidian Modal's keyboard scope", () => {
  const keyboardScope = { handleKey() {} };
  const Modal = class { constructor() { this.scope = keyboardScope; } };
  const code = source.slice(source.indexOf("const AiChatHistoryModal = class"), source.indexOf("// Mobile uses the same attached-source"));
  const History = vm.runInNewContext(`${code}; AiChatHistoryModal`, { Modal });
  const modal = new History({}, { bookFile: { path: "book.epub" } });
  assert.equal(modal.scope, keyboardScope);
  assert.equal(modal.filterScope, "book");
});

test("real search controller handles IME, wraps hits, preserves one return point and restores focus", () => {
  const { window } = new JSDOM("<button id='trigger'></button><section></section>");
  const proto = window.HTMLElement.prototype;
  proto.createEl = function(tag, options = {}) {
    const el = window.document.createElement(tag);
    if (typeof options === "string") el.className = options;
    else { el.className = options.cls || ""; el.textContent = options.text || ""; for (const [key, val] of Object.entries(options.attr || {})) el.setAttribute(key, val); }
    this.appendChild(el); return el;
  };
  proto.createDiv = function(options) { return this.createEl("div", options); };
  proto.createSpan = function(options) { return this.createEl("span", options); };
  proto.empty = function() { this.replaceChildren(); };
  proto.setText = function(text) { this.textContent = text; };
  proto.addClass = function(value) { this.classList.add(value); };
  proto.removeClass = function(value) { this.classList.remove(value); };
  proto.toggleClass = function(value, flag) { this.classList.toggle(value, flag); };
  const positions = []; let returns = 0, closed = false;
  const code = source.slice(source.indexOf("function buildFindPanelFor("), source.indexOf("function buildTocPanelFor("));
  const build = vm.runInNewContext(`${code}; buildFindPanelFor`, {
    window, __ertr: (s) => s, searchableQuery, searchBookBlocks, nextSearchIndex,
    clearFoundIn() {}, markFoundIn() {}, readerSearchTexts: () => ["书中有书"],
    pageForBlock: () => "", readerIsPdf: () => false, chapterForBlock: () => "第一章",
    rememberReaderJump: () => returns++, restoreReadingAnchor: (_pager, anchor) => { positions.push(anchor.offset); return [0, 1]; },
  });
  const panel = window.document.querySelector("section");
  const view = { findBtn: window.document.querySelector("button"), pager: { currentPct: 0, currentBlockIndex: () => 0 }, updateUI() {}, plugin: { saveProgress() {} }, file: { path: "book.epub" } };
  build(view, panel, { close: () => { closed = true; } });
  const input = view._findInput;
  const key = (key, options = {}) => input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  input.value = "书";
  input.dispatchEvent(new window.CompositionEvent("compositionstart")); key("Enter"); assert.deepEqual(positions, []);
  input.dispatchEvent(new window.CompositionEvent("compositionend"));
  key("Enter"); key("Enter"); key("Enter", { shiftKey: true });
  assert.deepEqual(positions, [0, 3, 0]); assert.equal(returns, 1);
  assert.equal(panel.querySelectorAll(".er-find-item").length, 2);
  key("Escape"); assert.equal(closed, true); assert.equal(window.document.activeElement, view.findBtn);
  window.close();
});
