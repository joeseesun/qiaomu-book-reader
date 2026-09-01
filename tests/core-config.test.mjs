import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { AI_PROVIDERS, aiProviderFor, normalizeAiBase } from "../src/ai-providers.js";
import { READER_THEMES, READER_THEME_CHOICES, migrateReaderTheme } from "../src/reader-themes.js";

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
  for (const id of ["deepseek", "kimi", "qwen", "zhipu", "minimax", "siliconflow", "doubao", "openrouter", "openai", "ollama", "lmstudio", "custom"]) {
    assert.ok(AI_PROVIDERS[id], `missing provider: ${id}`);
  }
  assert.equal(AI_PROVIDERS.ollama.base, "http://localhost:11434/v1");
  assert.equal(AI_PROVIDERS.lmstudio.base, "http://localhost:1234/v1");
  assert.equal(normalizeAiBase(" https://example.com/v1/// "), "https://example.com/v1");
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

test("public README no longer advertises Elton products", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.doesNotMatch(readme, /Elton/i);
  assert.match(readme, /DeepSeek/);
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
