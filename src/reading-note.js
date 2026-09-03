const LEGACY_READING_HIGHLIGHTS_RE = /<!-- book-reader:highlights:start -->[\s\S]*?<!-- book-reader:highlights:end -->/g;
const READING_SECTION_RE = /^##[ \t]+(?:划线与批注|Quotes|Цитаты)[ \t]*$/gm;

function headingRanges(text, headingPattern) {
  const headings = [];
  headingPattern.lastIndex = 0;
  for (const match of text.matchAll(headingPattern)) {
    headings.push({ start: match.index, headingEnd: match.index + match[0].length });
  }
  return headings.map((heading) => {
    const next = /^##[ \t]+(?!#)/gm;
    next.lastIndex = heading.headingEnd;
    const found = next.exec(text);
    return { start: heading.start, end: found ? found.index : text.length };
  });
}

export function replaceManagedReadingHighlights(data, block, legacyHeading) {
  let text = String(data || "");
  const hadLegacyMarkers = LEGACY_READING_HIGHLIGHTS_RE.test(text);
  LEGACY_READING_HIGHLIGHTS_RE.lastIndex = 0;
  if (hadLegacyMarkers) {
    text = text.replace(LEGACY_READING_HIGHLIGHTS_RE, "").replace(/\n{3,}/g, "\n\n");
    READING_SECTION_RE.lastIndex = 0;
    text = text.replace(READING_SECTION_RE, `## ${legacyHeading}`);
    return `${text.replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}\n`;
  }
  const ranges = headingRanges(text, READING_SECTION_RE);
  if (!ranges.length) return `${text.replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}\n`;
  const insertAt = ranges[0].start;
  for (let i = ranges.length - 1; i >= 0; i--) {
    text = text.slice(0, ranges[i].start) + text.slice(ranges[i].end);
  }
  return `${text.slice(0, insertAt).replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}${text.slice(insertAt)}`.replace(/\s*$/, "") + "\n";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeExcerpt(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*\]\(obsidian:\/\/qiaomu-book-reader[^)]*\)/g, " ")
    .replace(/\s+\*\([^)]*\)\*\s*$/, " ")
    .replace(/[*_=~`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function untrackedExcerptBlocks(text, ranges, block) {
  const managed = normalizeExcerpt(block);
  const rescued = [];
  for (const range of ranges) {
    const lines = text.slice(range.start, range.end).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/^>\s/.test(lines[i])) continue;
      let end = i + 1;
      while (end < lines.length && !/^>\s/.test(lines[end]) && !/^\*\*[^*]+\*\*\s*$/.test(lines[end])) end++;
      const needle = normalizeExcerpt(lines[i].replace(/^>\s*/, ""));
      if (needle && !managed.includes(needle)) {
        rescued.push(lines.slice(i, end).join("\n").trim());
      }
      i = end - 1;
    }
  }
  return [...new Set(rescued)].filter(Boolean);
}

export function appendReadingNoteExcerpts(data, heading, block) {
  const text = String(data || "");
  const cleanHeading = String(heading || "").trim();
  const cleanBlock = String(block || "").trim();
  if (!cleanBlock) return text;
  const headingPattern = new RegExp(`^${escapeRegex(cleanHeading)}[ \\t]*$`, "gm");
  const ranges = headingRanges(text, headingPattern);
  if (!ranges.length) {
    return `${text.replace(/\s*$/, "")}\n\n${cleanHeading}\n\n${cleanBlock}\n`;
  }
  const end = ranges[0].end;
  const before = text.slice(0, end).replace(/\s*$/, "");
  const after = text.slice(end).replace(/^\s*/, "");
  return `${before}\n\n${cleanBlock}\n${after ? `\n${after}` : ""}`;
}

export function migrateAndReplaceReadingHighlights(data, block, legacyHeading, manualHeading) {
  const text = String(data || "");
  const ranges = headingRanges(text, READING_SECTION_RE);
  const rescued = untrackedExcerptBlocks(text, ranges, block);
  const replaced = replaceManagedReadingHighlights(text, block, legacyHeading);
  return rescued.length
    ? appendReadingNoteExcerpts(replaced, manualHeading, rescued.join("\n\n"))
    : replaced;
}
