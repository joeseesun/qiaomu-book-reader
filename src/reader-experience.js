// Content anchors survive font changes and viewport reflow; screen numbers do not.
export function textPoint(block, offset = 0) {
  if (!block) return null;
  const walker = block.ownerDocument.createTreeWalker(block, 4);
  let node;
  let remaining = Math.max(0, offset);
  let last = null;
  while ((node = walker.nextNode())) {
    last = node;
    if (remaining < node.length) return { node, offset: remaining };
    remaining -= node.length;
  }
  return last ? { node: last, offset: last.length } : null;
}

export function captureReadingAnchor(pager) {
  if (!pager?.flow || !pager.clip) return null;
  const blocks = [...pager._blocks()];
  const viewport = pager.clip.getBoundingClientRect();
  let index = Math.max(0, pager.currentBlockIndex());
  let point = null;
  const doc = pager.flow.ownerDocument;
  // Probe the first visible line. The caret can lie within a paragraph that
  // starts on an earlier CSS column, unlike a block bounding rectangle.
  for (const y of [12, 32, 56, 88]) {
    for (const x of [0.15, 0.3, 0.45]) {
      const range = doc.caretRangeFromPoint?.(viewport.left + viewport.width * x, viewport.top + y);
      if (!range || !pager.flow.contains(range.startContainer)) continue;
      const found = blocks.findIndex((block) => block.contains(range.startContainer));
      if (found < 0) continue;
      const prefix = doc.createRange();
      prefix.selectNodeContents(blocks[found]);
      prefix.setEnd(range.startContainer, range.startOffset);
      index = found;
      point = { offset: prefix.toString().length };
      break;
    }
    if (point) break;
  }
  const block = blocks[index];
  let lineTop = null;
  const caret = textPoint(block, point?.offset || 0);
  if (caret) {
    const range = doc.createRange();
    range.setStart(caret.node, Math.min(caret.offset, Math.max(0, caret.node.length - 1)));
    range.setEnd(caret.node, Math.min(caret.node.length, range.startOffset + 1));
    const bounds = range.getBoundingClientRect?.();
    if (bounds?.height) lineTop = bounds.top - viewport.top;
  }
  return {
    block: index, offset: point?.offset || 0, pct: pager.currentPct,
    spread: pager.spread, scroll: !!pager.scrollMode,
    top: block ? block.getBoundingClientRect().top - viewport.top : 0,
    lineTop,
    pdfPage: pager.currentPdfPageNumber?.() || null,
  };
}

export function restoreReadingAnchor(pager, anchor) {
  if (!anchor) return pager.jumpTo(0);
  let block = pager.blockEl(anchor.block);
  if (anchor.pdfPage) {
    block = pager.flow.querySelector(`[data-pdf-page-no="${Number(anchor.pdfPage)}"]`) || block;
  }
  let target = block ? pager.spreadForBlock(anchor.block) : Math.round(anchor.pct * Math.max(0, pager.total - 1));
  if (anchor.pdfPage && block && !pager.scrollMode) target = Math.round((block.getBoundingClientRect().left - pager.flow.getBoundingClientRect().left) / pager.sw);
  const point = textPoint(block, anchor.offset);
  if (point && !pager.scrollMode && !anchor.pdfPage) {
    const range = block.ownerDocument.createRange();
    range.setStart(point.node, Math.min(point.offset, Math.max(0, point.node.length - 1)));
    range.setEnd(point.node, Math.min(point.node.length, range.startOffset + 1));
    const rect = range.getBoundingClientRect?.();
    if (rect?.width && pager.sw) {
      target = Math.floor((rect.left - pager.flow.getBoundingClientRect().left + 1) / pager.sw);
    }
  }
  pager.jumpTo(target);
  if (pager.scrollMode && block) {
    let bounds = block.getBoundingClientRect();
    let wanted = anchor.scroll ? anchor.top : 0;
    if (point && anchor.scroll && Number.isFinite(anchor.lineTop) && !anchor.pdfPage) {
      const range = block.ownerDocument.createRange();
      range.setStart(point.node, Math.min(point.offset, Math.max(0, point.node.length - 1)));
      range.setEnd(point.node, Math.min(point.node.length, range.startOffset + 1));
      const line = range.getBoundingClientRect?.();
      if (line?.height) { bounds = line; wanted = anchor.lineTop; }
    }
    pager.clip.scrollTop += bounds.top - pager.clip.getBoundingClientRect().top - wanted;
    pager.spread = Math.max(0, Math.min(pager.total - 1, Math.floor(pager.clip.scrollTop / Math.max(1, pager.clip.clientHeight))));
  }
  return [pager.spread, pager.total];
}

// Coalesce resize bursts; an older layout may finish but can never run beside
// the newest one. Keep the original anchor throughout the whole burst.
export function queueReadingLayout(view, run) {
  view._layoutAgain = true;
  if (view._layoutPromise) return view._layoutPromise;
  const pager = view.pager;
  const sameGeometry = pager?.flow && view.areaEl
    && Math.abs(view.areaEl.clientWidth - pager.builtWidth) < 8
    && Math.abs(view.areaEl.clientHeight - pager.builtHeight) < 8;
  if (sameGeometry && !pager.scrollMode) pager.applyTransform(false);
  const anchor = (sameGeometry ? captureReadingAnchor(pager) : view._readingAnchor) || captureReadingAnchor(pager);
  const file = view.file;
  view._layoutPromise = (async () => {
    do {
      view._layoutAgain = false;
      await run(anchor);
    } while (view._layoutAgain && view.file === file && view.bookHtml && !view._closed);
  })().finally(() => { view._layoutPromise = null; });
  return view._layoutPromise;
}

export function shouldFollowContext(mode, sameBook) {
  return !sameBook || (mode !== "selection" && mode !== "none");
}

export function comfortableLineWidth(fontSize, maxCharacters, cjk) {
  return Math.max(1, fontSize) * (maxCharacters > 0 ? maxCharacters / 2 : cjk ? 32 : 36);
}

export function zoomAnchorOffset(oldStart, newStart, pointer, ratio) {
  return newStart + (pointer - oldStart) * ratio - pointer;
}
