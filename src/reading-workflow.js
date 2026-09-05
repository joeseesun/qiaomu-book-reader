export async function aiAnswerMarker(bookPath, answer, crypto = window.crypto) {
  const bytes = new TextEncoder().encode(JSON.stringify([bookPath, answer.trim()]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `<!-- qiaomu-ai-answer:${Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("")} -->`;
}

export function appendAiAnswer(existing, { title, answer, marker }) {
  if (existing.includes(marker)) return existing;
  const heading = String(title || "").replace(/[\r\n]+/g, " ").trim();
  const ownHeading = /^#{1,6}\s+([^\n]+)(?:\n|$)/.exec(answer.trim())?.[1].trim();
  const section = ownHeading === heading ? "" : `## ${heading}\n\n`;
  return `${existing.replace(/\s*$/, "")}\n\n${section}${marker}\n\n${answer.trim()}\n`;
}

export function verifiedQuotes(answer, sources) {
  const normalize = (text) => String(text || "").replace(/\s+/g, "");
  const haystacks = sources.filter(Boolean).map(normalize);
  const candidates = [...String(answer).matchAll(/“([^”\n]{8,500})”|「([^」\n]{8,500})」|"([^"\n]{16,500})"|^>\s*(.{8,500})$/gm)]
    .map((match) => (match[1] || match[2] || match[3] || match[4]).replace(/\*\*|__/g, "").trim());
  return [...new Set(candidates)].filter((text) => haystacks.some((source) => source.includes(normalize(text)))).slice(0, 5);
}

export function normalizeLocationMarks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.id === "string" && item.id && typeof item.bookPath === "string" && item.bookPath && typeof item.title === "string" && Number.isInteger(item.anchor?.block) && item.anchor.block >= 0)
    .slice(-500).map((item) => ({
      id: item.id.slice(0, 80), bookPath: item.bookPath.slice(0, 500), title: item.title.slice(0, 80),
      excerpt: String(item.excerpt || "").slice(0, 160),
      anchor: { block: item.anchor.block, offset: Math.max(0, Number(item.anchor.offset) || 0), pct: Math.min(1, Math.max(0, Number(item.anchor.pct) || 0)), pdfPage: Math.max(0, Number(item.anchor.pdfPage) || 0) },
    }));
}
