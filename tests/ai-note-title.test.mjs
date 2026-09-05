import assert from "node:assert/strict";
import test from "node:test";
import { suggestAiNoteTitle } from "../src/ai-note-title.js";

const cases = [
  ["heading", "## 重要性如何放大紧张\n\n买房决策…", "重要性如何放大紧张"],
  ["generic heading", "## 总结\n\n重要性会放大紧张。紧张会损害决策质量。", "重要性会放大紧张"],
  ["reader prompt headings", "## 这段在说什么\n\n这是在写某位人物**从头到脚的打扮**。\n\n## 关键概念\n\n帽子和盔甲\n\n## 值得追问", "从头到脚的打扮"],
  ["heading with prefix", "# 核心观点：重要性会损害决策质量\n\n解释", "重要性会损害决策质量"],
  ["setext", "决策与情绪\n=====\n正文", "决策与情绪"],
  ["fenced fake heading", "```md\n# 假标题\n```\n\n## 真正的主题\n\n正文", "真正的主题"],
  ["markdown links and formatting", "## **[决策质量](https://example.test)** 与 `情绪`\n正文", "决策质量 与 情绪"],
  ["task list", "- [x] 建立可复用的决策清单。\n- [ ] 检查风险", "建立可复用的决策清单"],
  ["sentence", "这段话主要讲的是：重要性会放大紧张。然后…", "重要性会放大紧张"],
  ["table skips syntax", "| 方案 | 效果 |\n| --- | --- |\n\n优先减少决策压力。", "优先减少决策压力"],
  ["frontmatter", "---\ntitle: fake\n---\n# The cost of urgency\nBody", "The cost of urgency"],
  ["filename characters", "# A/B: decisions?\nBody", "A B decisions"],
];
for (const [name, answer, expected] of cases) {
  test(`AI note title: ${name}`, () => assert.equal(suggestAiNoteTitle(answer), expected));
}
test("AI note title: local fallback and bounded Unicode titles", () => {
  assert.equal(suggestAiNoteTitle("```js\nlet a = 1;\n```", { fallback: "AI 回复" }), "AI 回复");
  assert.equal(suggestAiNoteTitle("", { fallback: "AI 回复" }), "AI 回复");
  assert.ok(Array.from(suggestAiNoteTitle("思考".repeat(100))).length <= 32);
  assert.ok(Array.from(suggestAiNoteTitle("word ".repeat(100))).length <= 60);
  const title = suggestAiNoteTitle("标题😀".repeat(50));
  assert.doesNotMatch(title, /[\uD800-\uDBFF]$/);
});
