// Offsets always refer to the original UTF-16 text used by DOM Range.
export function searchableQuery(query) {
  const q = String(query || "").trim();
  return q.length >= 2 || /\p{Script=Han}/u.test(q) ? q : "";
}

export function searchBookBlocks(blocks, query, limit = 300) {
  const q = searchableQuery(query);
  if (!q || limit <= 0) return [];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "giu");
  const hits = [];
  for (let block = 0; block < blocks.length && hits.length < limit; block++) {
    const text = String(blocks[block] || "");
    pattern.lastIndex = 0;
    let match;
    while (hits.length < limit && (match = pattern.exec(text))) {
      const offset = match.index, end = offset + match[0].length;
      const start = Math.max(0, offset - 45), stop = Math.min(text.length, end + 55);
      hits.push({ block, offset, hit: match[0], pre: (start ? "…" : "") + text.slice(start, offset), post: text.slice(end, stop) + (stop < text.length ? "…" : "") });
    }
  }
  return hits;
}

export function nextSearchIndex(current, direction, count) {
  if (!count) return -1;
  if (current < 0) return direction < 0 ? count - 1 : 0;
  return (current + direction + count) % count;
}
