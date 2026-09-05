import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";
import { FONT_FILE_ACCEPT, importedReaderFonts } from "../src/reader-fonts.js";
import { normalizeCustomFontFamily, resolveReaderFont, syncPageButtons } from "../src/reader-appearance.js";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("custom fonts accept Chinese names, spaces, quoted commas and generic fallbacks", () => {
  assert.equal(normalizeCustomFontFamily("  思源宋体, PingFang SC, sans-serif "), '"思源宋体", "PingFang SC", sans-serif');
  assert.equal(normalizeCustomFontFamily("'Font, Special', ui-serif"), '"Font, Special", ui-serif');
  assert.equal(normalizeCustomFontFamily('"serif", serif'), '"serif", serif');
});

test("custom fonts cannot escape the generated CSS or silently drop invalid suffixes", () => {
  for (const input of ['serif; color:red', '</style><script>1</script>', 'url(https://example.com/font)', 'var(--font)',
    'serif,', ',serif', 'serif,,sans-serif', '"unterminated', 'serif\\x', 'a\nb', 'a'.repeat(501), "a'bad"]) {
    assert.equal(normalizeCustomFontFamily(input), null, input);
  }
});

test("empty, corrupt and unknown stored fonts safely fall back; built-ins still resolve", () => {
  const fonts = { georgia: "Georgia,serif", kaiti: "KaiTi,serif" };
  for (const customFontFamily of ["", null, {}, "serif;color:red"]) {
    assert.equal(resolveReaderFont({ fontFamily: "custom", customFontFamily }, fonts), fonts.georgia);
  }
  assert.equal(resolveReaderFont({ fontFamily: "unknown" }, fonts), fonts.georgia);
  assert.equal(resolveReaderFont({ fontFamily: "kaiti", customFontFamily: "ignored" }, fonts), fonts.kaiti);
  assert.equal(resolveReaderFont({ fontFamily: "custom", customFontFamily: "楷体" }, fonts), '"楷体"');
});

test("always-on arrows retain handlers, move outside immersive chrome and return in order", () => {
  const dom = new JSDOM('<div id="root" class="er-immersive"><div id="toolbar"><button id="prev"></button><span>page</span><button id="next"></button></div></div>');
  const doc = dom.window.document;
  const elements = { root: doc.getElementById("root"), toolbar: doc.getElementById("toolbar"), previous: doc.getElementById("prev"), next: doc.getElementById("next") };
  const view = { plugin: { settings: {} }, _pageButtons: elements };
  let page = 4;
  elements.previous.addEventListener("click", () => page--);
  elements.next.addEventListener("click", () => page++);
  syncPageButtons(view);
  assert.equal(elements.previous.parentElement, elements.toolbar);
  view.plugin.settings.pageButtonsVisibility = "always";
  for (let i = 0; i < 3; i++) syncPageButtons(view);
  assert.equal(elements.previous.parentElement, elements.root);
  assert.equal(elements.next.parentElement, elements.root);
  assert.equal(elements.root.querySelectorAll("button").length, 2);
  elements.next.click();
  assert.equal(page, 5);
  elements.previous.click();
  assert.equal(page, 4);
  view.plugin.settings.pageButtonsVisibility = "hover";
  syncPageButtons(view);
  assert.equal(elements.toolbar.firstElementChild, elements.previous);
  assert.equal(elements.toolbar.lastElementChild, elements.next);
  assert.equal(elements.root.querySelectorAll(".er-page-edge").length, 0);
  dom.window.close();
});

test("returning arrows preserve the shared navigation tools and page location order", () => {
  const dom = new JSDOM('<div id="root"><div id="toolbar" class="er-navigation"><div class="er-navigation-tools">contents / search</div><button id="prev"></button><div class="er-bot-center">page</div><button id="next"></button></div></div>');
  const doc = dom.window.document;
  const toolbar = doc.getElementById("toolbar");
  const view = { plugin: { settings: { pageButtonsVisibility: "always" } }, _pageButtons: { root: doc.getElementById("root"), toolbar, previous: doc.getElementById("prev"), next: doc.getElementById("next") } };
  const tools = toolbar.firstElementChild;
  syncPageButtons(view);
  assert.equal(toolbar.children.length, 2);
  assert.equal(toolbar.firstElementChild, tools);
  view.plugin.settings.pageButtonsVisibility = "hover";
  syncPageButtons(view);
  assert.deepEqual([...toolbar.children].map((el) => el.id || el.className), ["er-navigation-tools", "prev", "er-bot-center", "next"]);
  dom.window.close();
});

test("custom font editor reveals on selection, commits on change and preserves last valid value", async () => {
  const dom = new JSDOM('<div id="host"></div>');
  const { document, HTMLElement, Event } = dom.window;
  HTMLElement.prototype.createEl = function(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.text) element.textContent = options.text;
    if (options.type) element.type = options.type;
    element.className = options.cls || "";
    for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, value);
    this.append(element);
    return element;
  };
  HTMLElement.prototype.createDiv = function(options) { return this.createEl("div", typeof options === "string" ? { cls: options } : options); };
  HTMLElement.prototype.empty = function() { this.replaceChildren(); };
  HTMLElement.prototype.setText = function(value) { this.textContent = value; };
  const code = source.slice(source.indexOf("function buildCustomFontInput("), source.indexOf("function buildPageButtonsSetting("));
  const build = vm.runInNewContext(`${code}\nbuildCustomFontInput`, { __ertr: (s) => s, normalizeCustomFontFamily, FONT_FILE_ACCEPT, importedReaderFonts, resolveReaderFont, FONTS: { georgia: "Georgia,serif" } });
  const settings = { fontFamily: "georgia", customFontFamily: "" };
  let applies = 0;
  const host = document.getElementById("host");
  const refresh = build(host, { settings, _saveLocalData: async () => true }, async () => applies++);
  assert.equal(host.firstElementChild.hidden, true);
  settings.fontFamily = "custom";
  refresh();
  assert.equal(host.firstElementChild.hidden, false);
  const input = host.querySelector('input[type="text"]');
  input.value = "宋体, serif";
  input.dispatchEvent(new Event("input"));
  assert.equal(applies, 0);
  input.dispatchEvent(new Event("change"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(applies, 1);
  assert.equal(settings.customFontFamily, '"宋体", serif');
  input.value = "serif;display:none";
  input.dispatchEvent(new Event("change"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(applies, 1);
  assert.equal(settings.customFontFamily, '"宋体", serif');
  input.value = "";
  input.dispatchEvent(new Event("change"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settings.customFontFamily, "");
  assert.equal(input.getAttribute("aria-invalid"), "false");
  dom.window.close();
});
