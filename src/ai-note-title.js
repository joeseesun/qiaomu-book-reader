// Local, deterministic suggestions: never send another request just to save a
// reply. Prefer an actual topic heading; otherwise use the first content line.
function plainText(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path, label) => label || path)
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot);/g, (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "", "&gt;": "", "&quot;": "" })[entity])
    .replace(/^\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)、]\s*)?/, "")
    .replace(/[*_~`]/g, "")
    .replace(/^[一二三四五六七八九十\d]+[、.．)）]\s*/, "")
    .replace(/\s+/g, " ").trim();
}

function topic(value) {
  return plainText(value)
    .replace(/^(?:标题|主题|核心观点|一句话总结|总结|结论|回答|答案|title|summary|answer)\s*[:：]\s*/i, "")
    .replace(/^(?:好的[，,。！!]?|当然[，,。！!]?)\s*/, "")
    .replace(/^(?:这段(?:话|文字|内容)?(?:主要)?(?:讲的是|说的是|讨论的是)|核心观点是)\s*[:：]?\s*/, "")
    .trim();
}

function meaningful(text) {
  return /[\p{L}\p{N}]/u.test(text) && !/^(?:好的|当然|总结|结论|回答|答案|分析|解释|要点|核心观点|关键概念|为什么这样表达|值得追问|怎么理解|原文信息|一句话总结|举个例子|解释一下|总结要点|原文在讲什么|这段在说什么|一个可以接着想的问题|(?:内容|原文|选文)(?:分析|解读|总结)|summary|answer|analysis|conclusion|key takeaways|key concepts|introduction|overview)[:：。.!！?？\s]*$/i.test(text);
}

export function suggestAiNoteTitle(answer, { fallback = "AI reply", max = 60 } = {}) {
  // Do not mistake headings inside code fences or frontmatter for prose.
  const lines = String(answer || "").replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "").split(/\r?\n/);
  const candidates = [];
  const emphasized = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence || !line || /^\s*(?:\||[-=]{3,}\s*$|\[\^?[^\]]+\]:|https?:\/\/)/.test(line)) continue;
    const text = topic(line);
    if (!meaningful(text)) continue;
    const heading = /^#{1,6}\s+/.test(line) || /^\s*(?:={3,}|-{3,})\s*$/.test(lines[i + 1] || "");
    candidates.push({ text, heading });
    for (const match of line.matchAll(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g)) {
      const phrase = topic(match[1] || match[2]);
      const length = Array.from(phrase).length;
      if (meaningful(phrase) && length >= 6 && length <= 32) emphasized.push(phrase);
    }
  }
  let result = candidates.find((item) => item.heading)?.text || emphasized[0] || candidates[0]?.text || fallback;
  result = result.split(/[。！？!?]|\.(?:\s|$)/)[0].trim() || fallback;
  // Sanitize without depending on the Obsidian runtime; use codepoints so a
  // length boundary cannot split an emoji. The caller also sanitizes filenames.
  result = result.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  const limit = /[\p{Script=Han}]/u.test(result) ? Math.min(max, 32) : max;
  if (Array.from(result).length > limit) {
    result = Array.from(result).slice(0, limit).join("");
    const boundary = result.search(/[，,；;：:][^，,；;：:]*$/);
    if (boundary >= limit / 2) result = result.slice(0, boundary);
    else if (!/[\p{Script=Han}]/u.test(result) && result.lastIndexOf(" ") >= limit / 2) result = result.slice(0, result.lastIndexOf(" "));
  }
  return result.replace(/^[.\s“”「」]+|[.\s，,；;：:。!?！？…—–\-“”「」]+$/g, "") || fallback;
}
