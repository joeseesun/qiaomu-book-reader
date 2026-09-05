import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";
import { textPoint, captureReadingAnchor, restoreReadingAnchor, queueReadingLayout, shouldFollowContext, comfortableLineWidth, zoomAnchorOffset } from "../src/reader-experience.js";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const rect = (left, top, width = 400, height = 500) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("page following never replaces a pinned or explicitly removed source in the same book", () => {
  for (const mode of ["selection", "none"]) {
    assert.equal(shouldFollowContext(mode, true), false);
    assert.equal(shouldFollowContext(mode, false), true);
  }
  assert.equal(shouldFollowContext("follow", true), true);
});

test("AI page source waits for the actual CSS transition, not an assumed duration", () => {
  let callback;
  let moving = true;
  let syncs = 0;
  const fn = source.slice(source.indexOf("function settleReader("), source.indexOf("function rememberReaderJump("));
  const settle = vm.runInNewContext(`${fn}\nsettleReader`, {
    window: { clearTimeout() {}, setTimeout(fn) { callback = fn; } },
    captureReadingAnchor: () => ({ block: 15 }), syncOpenAiReaderContext() { syncs++; }, readerIsPdf: () => true,
  });
  const view = { areaEl: { clientWidth: 400 }, pager: { builtWidth: 400, flow: { isConnected: true,
    getAnimations: () => moving ? [{ playState: "running" }] : [],
  } } };
  settle(view);
  callback();
  assert.equal(syncs, 0);
  moving = false;
  callback();
  assert.equal(syncs, 1);
});

test("text anchors traverse inline markup without using HTML offsets", () => {
  const doc = new JSDOM("<p>甲乙<strong>丙丁</strong>戊己</p>").window.document;
  const block = doc.querySelector("p");
  assert.equal(textPoint(block, 2).node.textContent, "丙丁");
  assert.equal(textPoint(block, 3).offset, 1);
  assert.equal(textPoint(block, 100).offset, 2);
});

test("scroll reflow restores the partially visible paragraph, not its following paragraph", () => {
  const doc = new JSDOM("<div><section><p>甲乙丙</p></section></div>").window.document;
  const clip = doc.querySelector("div"), flow = doc.querySelector("section"), block = doc.querySelector("p");
  clip.getBoundingClientRect = () => rect(0, 100);
  block.getBoundingClientRect = () => rect(20, 400 - clip.scrollTop);
  Object.defineProperty(clip, "clientHeight", { value: 500 });
  clip.scrollTop = 340;
  const pager = { clip, flow, spread: 0, total: 10, scrollMode: true, currentPct: 0.2,
    _blocks: () => [block], blockEl: () => block, currentBlockIndex: () => 0,
    spreadForBlock: () => 0, jumpTo(n) { this.spread = n; clip.scrollTop = n * 500; return [n, this.total]; },
  };
  const anchor = captureReadingAnchor(pager);
  assert.equal(anchor.top, -40);
  restoreReadingAnchor(pager, anchor);
  assert.equal(clip.scrollTop, 340);
  assert.equal(block.getBoundingClientRect().top - clip.getBoundingClientRect().top, -40);
});

test("paged reflow restores a character on the second column of a long paragraph", () => {
  const doc = new JSDOM("<div><section><p>长段落</p></section></div>").window.document;
  const flow = doc.querySelector("section"), block = doc.querySelector("p");
  flow.getBoundingClientRect = () => rect(-800, 0);
  doc.defaultView.Range.prototype.getBoundingClientRect = () => rect(820, 0, 16, 22);
  const pager = { flow, sw: 800, total: 8, blockEl: () => block, spreadForBlock: () => 0,
    jumpTo(n) { this.spread = n; return [n, this.total]; },
  };
  restoreReadingAnchor(pager, { block: 0, offset: 2, pct: 0 });
  assert.equal(pager.spread, 2);
});

test("PDF scan anchors restore the native page even when there are no text blocks", () => {
  const doc = new JSDOM('<section><div data-pdf-page-no="8"></div></section>').window.document;
  const flow = doc.querySelector("section"), page = doc.querySelector("div");
  flow.getBoundingClientRect = () => rect(0, 0);
  page.getBoundingClientRect = () => rect(2800, 0);
  const pager = { flow, sw: 400, total: 12, blockEl: () => null, spreadForBlock: () => 0,
    jumpTo(n) { this.spread = n; return [n, this.total]; },
  };
  restoreReadingAnchor(pager, { block: 0, pdfPage: 8, pct: 0.5 });
  assert.equal(pager.spread, 7);
});

test("resize bursts are serialized and share the original anchor", async () => {
  const anchor = { block: 15, offset: 27 };
  const view = { file: {}, bookHtml: "book", _readingAnchor: anchor };
  let finish;
  const seen = [];
  const run = async (point) => { seen.push(point); if (seen.length === 1) await new Promise((resolve) => { finish = resolve; }); };
  const first = queueReadingLayout(view, run);
  const second = queueReadingLayout(view, run);
  queueReadingLayout(view, run);
  assert.equal(first, second);
  assert.equal(seen.length, 1);
  finish();
  await first;
  assert.equal(seen.length, 2);
  assert.ok(seen.every((point) => point === anchor));
  assert.equal(view._layoutPromise, null);
});

test("a pending resize is discarded after changing book; failures allow later reflows", async () => {
  const view = { file: {}, bookHtml: "book", _readingAnchor: { block: 1 } };
  let finish;
  let calls = 0;
  const run = async () => { calls++; await new Promise((resolve) => { finish = resolve; }); };
  const pending = queueReadingLayout(view, run);
  queueReadingLayout(view, run);
  view.file = {};
  finish();
  await pending;
  assert.equal(calls, 1);
  await assert.rejects(queueReadingLayout(view, async () => { throw new Error("layout"); }));
  await queueReadingLayout(view, async () => { calls++; });
  assert.equal(calls, 2);
});

test("automatic line length is bounded while explicit user values keep their meaning", () => {
  assert.equal(comfortableLineWidth(20, 0, true), 640);
  assert.equal(comfortableLineWidth(20, 0, false), 720);
  assert.equal(comfortableLineWidth(20, 90, true), 900);
});

test("PDF zoom correction keeps the pointer's document point despite centered margins", () => {
  // The old sheet starts at x=100. Doubling removes that margin, requiring
  // 100px of scroll to leave the same document point below x=300.
  assert.equal(zoomAnchorOffset(100, 0, 300, 2), 100);
  assert.equal(zoomAnchorOffset(-100, 0, 300, 0.5), -100);
});

test("initial layout and reflow scroll events cannot overwrite the saved reading position", () => {
  let saves = 0;
  let updates = 0;
  const factory = source.slice(source.indexOf("function createReaderPaginator("), source.indexOf("function readerPaginationMappingCollapsed("));
  const create = vm.runInNewContext(`${factory}\ncreateReaderPaginator`, {
    Paginator: class { currentBlockIndex() { return 15; } }, clampPdfZoom: () => 1,
  });
  const view = { file: { path: "book.epub" }, plugin: { saveProgress() { saves++; } }, updateUI() { updates++; } };
  const pager = create(view);
  for (const flag of ["_openingBook", "_layoutPromise", "_closed"]) {
    view[flag] = true;
    pager.onSpreadChange(0, 10);
    view[flag] = false;
  }
  assert.equal(saves, 0);
  assert.equal(updates, 0);
  pager.onSpreadChange(2, 10);
  assert.equal(saves, 1);
  assert.equal(updates, 1);
});

test("scroll anchors do not inherit smooth scrolling from CSS", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /scroll-behavior:\s*smooth/);
  assert.match(source, /behavior: animate \? "smooth" : "auto"/);
});

test("focus mode restores both sidebar states and is idempotent", () => {
  const doc = new JSDOM("<main></main>").window.document;
  const root = doc.querySelector("main");
  root.toggleClass = (name, on) => root.classList.toggle(name, on);
  root.createEl = (tag, options) => {
    const el = doc.createElement(tag);
    for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
    root.append(el);
    return el;
  };
  const side = (collapsed) => ({ collapsed, collapse() { this.collapsed = true; }, expand() { this.collapsed = false; } });
  const workspace = { leftSplit: side(true), rightSplit: side(false), getLeavesOfType: () => [] };
  const view = { app: { workspace }, contentEl: root };
  const fn = source.slice(source.indexOf("function setReadingFocus("), source.indexOf("function setupReaderSelection("));
  const focus = vm.runInNewContext(`${fn}\nsetReadingFocus`, { AI_CHAT_VIEW_TYPE: "ai-chat", captureReadingAnchor: () => ({ block: 15 }), __ertr: (s) => s, setIcon() {} });
  focus(view, true);
  focus(view, true);
  assert.equal(workspace.leftSplit.collapsed, true);
  assert.equal(workspace.rightSplit.collapsed, true);
  assert.equal(root.querySelectorAll("button").length, 1);
  focus(view, false);
  focus(view, false);
  assert.equal(workspace.leftSplit.collapsed, true);
  assert.equal(workspace.rightSplit.collapsed, false);
  assert.equal(root.querySelectorAll("button").length, 0);

  workspace.leftSplit.expand();
  const aiLeaf = { getRoot: () => workspace.rightSplit, view: { containerEl: { isShown: () => true } } };
  workspace.getLeavesOfType = () => [aiLeaf];
  focus(view, true);
  assert.equal(workspace.leftSplit.collapsed, true, "file tree folds away");
  assert.equal(workspace.rightSplit.collapsed, false, "visible right AI stays open");
  focus(view, false);
  assert.equal(workspace.leftSplit.collapsed, false);

  aiLeaf.view.containerEl.isShown = () => false;
  focus(view, true);
  assert.equal(workspace.rightSplit.collapsed, true, "a dormant AI tab does not preserve unrelated right panels");
  focus(view, false);
  aiLeaf.view.containerEl.isShown = () => true;
  aiLeaf.getRoot = () => workspace.leftSplit;
  focus(view, true);
  assert.equal(workspace.rightSplit.collapsed, true, "AI outside the right dock does not preserve that dock");
  focus(view, false);
});

test("opening AI and activating its right dock preserve focus without restoring the file tree", async () => {
  const start = source.indexOf('this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {');
  const end = source.indexOf("\n    }));", start) + "\n    }));".length;
  let onActiveLeaf, cleared = 0, exited = 0;
  const workspace = {
    leftSplit: { collapsed: true }, rightSplit: { collapsed: true },
    on(_event, callback) { onActiveLeaf = callback; }
  };
  const reader = { app: { workspace }, _focusRestore: [{}], _hideHlPopup() {}, registerEvent() {} };
  vm.runInNewContext(`(function() { ${source.slice(start, end)} }).call(reader)`, {
    reader, AI_CHAT_VIEW_TYPE: "ai-chat", recheck() {}, syncOpenAiReaderContext() {},
    clearAiSource() { cleared++; },
    setReadingFocus(view, enabled) { assert.equal(enabled, false); view._focusRestore = null; exited++; }
  });
  class AiChatView {
    getViewType() { return "ai-chat"; }
    setContext(context) { this.context = context; }
  }
  const aiLeaf = { getRoot: () => workspace.rightSplit, view: new AiChatView() };
  workspace.getLeavesOfType = () => [aiLeaf];
  workspace.revealLeaf = (leaf) => { workspace.rightSplit.collapsed = false; onActiveLeaf(leaf); };
  const method = source.slice(source.indexOf("  async openAiChat("), source.indexOf("  // Open the library."));
  const plugin = vm.runInNewContext(`({${method}})`, {
    AI_CHAT_VIEW_TYPE: "ai-chat", AiChatView,
    setReadingFocus() { throw new Error("Opening AI must not exit focus"); }
  });
  plugin.app = reader.app;
  await plugin.openAiChat({ readerView: reader, text: "current page" });
  assert.ok(reader._focusRestore);
  assert.equal(workspace.leftSplit.collapsed, true);
  assert.equal(workspace.rightSplit.collapsed, false);
  assert.equal(exited, 0);
  assert.equal(cleared, 0);
  assert.equal(aiLeaf.view.context.text, "current page");
  onActiveLeaf({ view: { getViewType: () => "markdown" } });
  assert.equal(reader._focusRestore, null, "switching away from reading still exits focus");
  assert.equal(exited, 1);
  assert.equal(cleared, 1);
});

test("selection toolbar stays hidden until mouse release and removes document listeners on close", () => {
  const { window } = new JSDOM('<main><div class="popup er-hl-popup-on"></div><article></article></main>');
  const area = window.document.querySelector("article");
  let checks = 0;
  const view = { areaEl: area, hlPopup: window.document.querySelector(".popup"), _scheduleSelCheck() { checks++; } };
  const fn = source.slice(source.indexOf("function setupReaderSelection("), source.indexOf("function readerPageContext("));
  vm.runInNewContext(`${fn}\nsetupReaderSelection`, {})(view);
  area.dispatchEvent(new window.PointerEvent("pointerdown", { pointerType: "mouse", button: 0 }));
  assert.equal(view._selectionDragging, true);
  assert.equal(view.hlPopup.classList.contains("er-hl-popup-on"), false);
  window.document.dispatchEvent(new window.PointerEvent("pointerup"));
  assert.equal(view._selectionDragging, false);
  assert.equal(checks, 1);
  view._selectionCleanup();
  area.dispatchEvent(new window.PointerEvent("pointerdown", { pointerType: "mouse", button: 0 }));
  assert.equal(view._selectionDragging, false);
});

test("selection toolbar is clamped inside a narrow reader viewport", () => {
  const { window } = new JSDOM("<main><div></div></main>");
  const root = window.document.querySelector("main"), pop = root.firstChild;
  root.getBoundingClientRect = () => rect(100, 50, 260, 500);
  Object.defineProperties(root, { clientWidth: { value: 260 }, clientHeight: { value: 500 } });
  Object.defineProperties(pop, { offsetWidth: { value: 244 }, offsetHeight: { value: 70 } });
  const start = source.indexOf("function positionHlPopup(");
  const end = source.indexOf("function followFootnote(", start);
  const place = vm.runInNewContext(`${source.slice(start, end)}\npositionHlPopup`, { erIsMobile: () => false });
  place({ contentEl: root, hlPopup: pop }, rect(340, 510, 100, 28), 260, 44);
  assert.ok(parseFloat(pop.style.left) >= 0);
  assert.ok(parseFloat(pop.style.left) + 244 <= 260);
  assert.ok(parseFloat(pop.style.top) >= 0);
  assert.ok(parseFloat(pop.style.top) + 70 <= 500);
  assert.equal(pop.style.maxWidth, "244px");
});

test("PDF page picker uses original pages even when zoom creates more screenfuls", () => {
  let pick;
  let count;
  const clip = { scrollTop: 0, clientHeight: 500, getBoundingClientRect: () => rect(0, 50) };
  const pages = Array.from({ length: 32 }, (_, index) => ({ getBoundingClientRect: () => rect(0, index * 1200 + 50 - clip.scrollTop) }));
  const pager = { flow: { querySelectorAll: () => pages }, clip, total: 77, spread: 0, scrollMode: true,
    currentPdfPageNumber: () => 1, currentBlockIndex: () => 7,
  };
  const fn = source.slice(source.indexOf("function readerPdfPages("), source.indexOf("function syncPdfZoomControls("));
  const open = vm.runInNewContext(`${fn}\nopenReaderPagePicker`, {
    readerIsPdf: () => true, rememberReaderJump() {},
    GoToPageModal: class { constructor(_app, total, _at, go) { count = total; pick = go; } open() {} },
  });
  open({ file: { path: "report.pdf" }, pager, app: {}, updateUI() {}, plugin: { saveProgress() {} } });
  assert.equal(count, 32);
  pick(8);
  assert.equal(clip.scrollTop, 8400);
  assert.equal(pager.spread, 16);
});

test("PDF pan mode drags its scroller and consumes the following click", () => {
  const { window } = new JSDOM('<article><div class="er-pdf-page-break"><span>PDF</span></div></article>');
  const area = window.document.querySelector("article"), page = area.firstChild, text = page.firstChild;
  area.setPointerCapture = () => {};
  page.scrollTop = 200;
  page.scrollLeft = 100;
  let clicks = 0;
  const view = { areaEl: area, pager: { scrollMode: false }, pdfPanMode: true };
  const fn = source.slice(source.indexOf("function setupPdfZoomInteractions("), source.indexOf("function aiHttpError("));
  vm.runInNewContext(`${fn}\nsetupPdfZoomInteractions`, { readerIsPdf: () => true, PDF_ZOOM_DEFAULT: 1 })(view);
  area.addEventListener("click", () => { clicks++; });
  text.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse", button: 0, clientX: 120, clientY: 180 }));
  area.dispatchEvent(new window.PointerEvent("pointermove", { bubbles: true, clientX: 80, clientY: 130 }));
  assert.equal(page.scrollLeft, 140);
  assert.equal(page.scrollTop, 250);
  assert.equal(view._pdfPanning, true);
  area.dispatchEvent(new window.PointerEvent("pointerup"));
  text.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(clicks, 0);
  assert.equal(view._pdfPanning, false);
});

test("sidebar source refresh preserves composer and history DOM; pinned and removed states survive", async () => {
  const cls = source.slice(source.indexOf("const AiChatView = class"), source.indexOf('for (const method of ["_setSending"'));
  const context = { ItemView: class {}, shouldFollowContext, clearAiSource() {},
    normalizeAiTurnContext: (value) => value?.text ? { kind: value.kind, text: value.text, page: value.page } : null,
    aiTurnsHaveDocumentContext: () => false, bookNoteLinkFor: () => "book", newAiSessionKey: () => "new",
    erAutoFocus() {}, Notice: class {}, __ertr: (s) => s,
  };
  const Chat = vm.runInNewContext(`${cls}\nAiChatView`, context);
  const chat = Object.create(Chat.prototype);
  const bookFile = { path: "book.epub" };
  const input = { value: "未发送草稿" }, log = { scrollTop: 123 };
  let renders = 0;
  Object.assign(chat, { turns: [], bookFile, inputEl: input, log, plugin: {}, contextMode: "follow", contextUnavailable: false,
    pendingContext: { kind: "page", text: "旧页" }, pendingContextHost: { isConnected: true },
    _refreshPendingContext() { renders++; }, _renderConversation() { throw new Error("must not rebuild chat"); },
  });
  const next = { bookFile, kind: "page", text: "新页", page: "2" };
  chat.setContext(next, { follow: true });
  assert.equal(chat.pendingContext.text, "新页");
  assert.equal(chat.inputEl, input);
  assert.equal(chat.log, log);
  assert.equal(chat.log.scrollTop, 123);
  assert.equal(renders, 1);
  chat.contextMode = "selection";
  chat.pendingContext = { kind: "selection", text: "固定选文" };
  chat.setContext(next, { follow: true });
  assert.equal(chat.pendingContext.text, "固定选文");
  chat.contextMode = "none";
  chat.pendingContext = null;
  chat.setContext(next, { follow: true });
  assert.equal(chat.pendingContext, null);
  chat.busy = true;
  chat.setContext(next, { follow: true });
  assert.equal(chat._deferredContext.value, next);
  await tick();
});
