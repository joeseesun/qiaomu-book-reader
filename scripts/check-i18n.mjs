import fs from "node:fs/promises";
import vm from "node:vm";
import { parse } from "acorn";
import { ER_ZH_CN } from "../src/i18n-zh.js";

const source = await fs.readFile(new URL("../src/main.js", import.meta.url), "utf8");
const manifest = JSON.parse(await fs.readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));

function readEnglishDictionary(code) {
  const first = code.match(/const __erEN = (\{[^\n]*\});/);
  if (!first) throw new Error("Could not find the primary English dictionary");
  const dictionary = vm.runInNewContext(`(${first[1]})`, Object.create(null));
  const assignmentPattern = /Object\.assign\(__erEN,\s*(\{[\s\S]*?\})\s*\);/g;
  for (const match of code.matchAll(assignmentPattern)) {
    Object.assign(dictionary, vm.runInNewContext(`(${match[1]})`, Object.create(null)));
  }
  return dictionary;
}

function placeholders(value) {
  return [...String(value).matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
}

function translatedLiterals(code) {
  const ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
  const values = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "__ertr") {
      const first = node.arguments?.[0];
      if (first?.type === "Literal" && typeof first.value === "string") values.add(first.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object" && typeof value.type === "string") visit(value);
    }
  };
  visit(ast);
  return [...values];
}

const english = readEnglishDictionary(source);
const missing = Object.keys(english).filter((key) => ER_ZH_CN[key] == null || ER_ZH_CN[key] === "");
const usedLiterals = translatedLiterals(source);
const missingUsedEnglish = usedLiterals.filter((key) => english[key] == null);
const missingUsedChinese = usedLiterals.filter((key) => ER_ZH_CN[key] == null || ER_ZH_CN[key] === "");
const placeholderErrors = Object.keys(english).filter((key) =>
  JSON.stringify(placeholders(english[key])) !== JSON.stringify(placeholders(ER_ZH_CN[key])),
);
const bannedChineseCopy = [
  "报价", "报价单", "图书笔记", "读书笔记", "选择的新笔记", "选择的笔记",
  "书本笔记中的文字", "天气晴朗", "请先登录再添加翻译", "没有导出选择",
  "开放图书馆", "表示欢迎（入职）", "＃＃ 引号", "开发{0}", "移除背光",
];
const bannedCopyErrors = Object.entries(ER_ZH_CN)
  .filter(([, value]) => bannedChineseCopy.some((phrase) => String(value).includes(phrase)))
  .map(([key, value]) => `${key} → ${value}`);
const cyrillicCopyErrors = Object.entries(ER_ZH_CN)
  .filter(([, value]) => /[А-Яа-яЁё]/.test(String(value)))
  .map(([key, value]) => `${key} → ${value}`);

const errors = [];
if (missing.length) errors.push(`Missing Chinese translations: ${missing.join(" | ")}`);
if (missingUsedEnglish.length) errors.push(`Used strings missing from English dictionary: ${missingUsedEnglish.join(" | ")}`);
if (missingUsedChinese.length) errors.push(`Used strings missing from Chinese dictionary: ${missingUsedChinese.join(" | ")}`);
if (placeholderErrors.length) errors.push(`Placeholder mismatch: ${placeholderErrors.join(" | ")}`);
if (bannedCopyErrors.length) errors.push(`Literal or misleading Chinese copy: ${bannedCopyErrors.join(" | ")}`);
if (cyrillicCopyErrors.length) errors.push(`Russian text left in Chinese copy: ${cyrillicCopyErrors.join(" | ")}`);
if (!source.includes('let __erLang = "zh"') || !source.includes('language: "zh"')) {
  errors.push("Simplified Chinese is not the runtime and settings default");
}
if (source.includes("getLanguage")) {
  errors.push("The plugin still derives its default language from Obsidian instead of defaulting to Chinese");
}
if (!/[\u3400-\u9fff]/.test(manifest.description || "")) {
  errors.push("manifest.json description is not Chinese");
}
if (!/[\u3400-\u9fff]/.test(packageJson.description || "")) {
  errors.push("package.json description is not Chinese");
}
if (!source.includes('"Book Reader обновлён до {0}": "Qiaomu Book Reader has been updated to {0}"') && !ER_ZH_CN["Book Reader обновлён до {0}"].startsWith("Qiaomu Book Reader")) {
  errors.push("The update notice is not branded and translated for Chinese users");
}
if (!source.includes('.addOption("zh", "简体中文")')) errors.push("Missing Simplified Chinese language option");
if (!source.includes("Object.values(READER_FONTS)")) errors.push("Font controls do not use the unified font registry");
if (!source.includes('id: "sourceHanSerif"') || !source.includes('id: "sourceHanSans"')) {
  errors.push("Source Han Serif and Source Han Sans are missing from the reader font registry");
}
if (!source.includes('function backlinkLabel() { return "↩"; }')) {
  errors.push("Reading-note backlinks are not rendered as a quiet icon-only link");
}
if (!source.includes('registerObsidianProtocolHandler("qiaomu-book-reader"') || !source.includes('registerObsidianProtocolHandler("elton-reader"')) {
  errors.push("New Qiaomu backlinks or legacy Elton backlink compatibility are missing");
}
if (!source.includes("iconBacklinksMigrated") || !source.includes("await syncHighlightsToReadingNote(this.app, this, bookPath, items)")) {
  errors.push("Existing managed reading notes are not migrated to icon-only backlinks on upgrade");
}
if (source.includes('.setName(__ertr("Подпись этой ссылки"))')) {
  errors.push("The retired text-label setting for reading-note backlinks is still visible");
}
if (!source.includes('svgIcon(logo, "qiaomu-library")') || source.includes('brand.createDiv("er-lib-logo").setText("\\u{1F4DA}")')) {
  errors.push("The library still uses the old emoji logo instead of the Qiaomu book mark");
}
if (!source.includes("autoBookNote: true") || !source.includes("quotesToBookNote: true")) {
  errors.push("Reading notes and highlight synchronisation are not enabled by default");
}
if (!source.includes("const tplPath = bookNoteTemplatePath(this.app)")) {
  errors.push("Reading-note creation can still reuse the standalone excerpt template");
}
if (!source.includes("if (!isMarkedReadingNote(app, md)) continue")) {
  errors.push("Frontmatter inference can still capture ordinary or template notes");
}
if (!source.includes('fm["book-reader-note"] = true')) {
  errors.push("Created reading notes are not marked explicitly");
}
if (!source.includes("readingSectionRanges") || !source.includes("syncHighlightsToReadingNote")) {
  errors.push("Highlights and comments are not synchronised through a heading-managed reading-note section");
}
if (source.includes("const READING_HIGHLIGHTS_START") || source.includes("const READING_HIGHLIGHTS_END")) {
  errors.push("Internal reading-note boundary markers are still emitted into user notes");
}
if (source.includes('> **${__ertr("Комментарий к выделению")}')) {
  errors.push("Highlight comments still render inside the quote block");
}
if ((source.match(/await persistCurrentReaderPosition\(this\)/g) || []).length < 2) {
  errors.push("Desktop and mobile readers do not flush the final automatic reading position on close");
}
if (!source.includes("pager.flow.isConnected") || !source.includes("pager.clip.isConnected")) {
  errors.push("Close-time progress can overwrite the paragraph anchor from detached layout geometry");
}
if (source.includes('id: "save-position"') || source.includes('svgIcon(saveBtn, "bookmark-plus")') || source.includes('setTitle(__ertr("Создать точку возврата"))')) {
  errors.push("The redundant manual restore-point action is still visible");
}
const runtimeSource = source.slice(source.indexOf('let __erLang = "zh"'));
if (runtimeSource.includes("saveNow(") || runtimeSource.includes("snap.manual")) {
  errors.push("Manual restore-point code or icon styling is still present in the runtime");
}
if (!source.includes('await reader.plugin.saveProgress(reader.file.path, current, total, block)')) {
  errors.push("Automatic reading progress is not flushed when the reader closes");
}
if (!source.includes("openOrCreateBookNoteBeside") || !source.includes('svgIcon(noteBtn, "note")') || !source.includes('{ mode: "split" }')) {
  errors.push("The reader toolbar does not create or open the reading note beside the book");
}
if (!source.includes('let body = "";') || !source.includes("stripGeneratedReadingNoteTitle") || !source.includes("readingNoteTitlesMigratedV4") || !source.includes("markedInText") || !source.includes("bookNoteFiles(this.app)")) {
  errors.push("Generated reading notes still repeat the filename as an H1 heading");
}
if (!source.includes('["yellow", "green", "pink"].includes(item.id)')) {
  errors.push("Selection popup does not expose the intended three-colour palette");
}
if (!source.includes('act("er-hl-comment-btn", "message"') || !source.includes('createEl("textarea", { cls: "er-hl-comment-textarea" })')) {
  errors.push("Selection popup does not provide an inline nearby comment editor");
}
if (!source.includes('const quick = c.createDiv("er-rs-quick")') || !source.includes('label: __ertr("Доп. настройки")')) {
  errors.push("Reading settings do not use primary controls with progressive disclosure");
}
if (/\bname:\s*__ertr\("(?:Жёлтый|Зелёный|Голубой|Розовый)"\)/.test(source)) {
  errors.push("Highlight colour labels are translated eagerly before the saved language is loaded");
}
for (const label of ["Жёлтый", "Зелёный", "Голубой", "Розовый"]) {
  if (!source.includes(`label: () => __ertr("${label}")`)) {
    errors.push(`Highlight colour label is not translated lazily: ${label}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`i18n OK: ${Object.keys(english).length} English keys covered by Simplified Chinese.`);
