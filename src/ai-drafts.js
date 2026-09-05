import { createSerialTaskQueue, readJsonRecordStore, writeVerifiedJsonRecord } from "./storage.js";

export const DRAFT_LIMIT = 20000;
export function normalizeDrafts(value) {
  return Object.fromEntries(Object.entries(value || {})
    .filter(([path, item]) => path && path.length <= 500 && typeof item?.text === "string" && item.text)
    .sort((a, b) => (Number(b[1].updatedAt) || 0) - (Number(a[1].updatedAt) || 0))
    .slice(0, 30).map(([path, item]) => [path, { text: item.text.slice(0, DRAFT_LIMIT), updatedAt: Number(item.updatedAt) || 0 }]));
}

// Independent of synced settings. Never overwrite an unreadable draft file.
export async function loadAiDrafts(adapter, path, onError, clock = window) {
  const result = await readJsonRecordStore(adapter, path, "AI drafts");
  let blocked = result.status === "unreadable", notified = false, timer, dirty = false;
  let records = normalizeDrafts(result.value);
  const texts = new Map(Object.entries(records).map(([key, item]) => [key, item.text]));
  const queue = createSerialTaskQueue();
  const report = () => { if (!notified) onError?.(); notified = true; };
  if (blocked) report();
  const flush = () => {
    clock.clearTimeout(timer);
    if (!dirty || blocked) return queue.drain();
    const snapshot = JSON.parse(JSON.stringify(records));
    dirty = false;
    return queue.run(async () => {
      try { await writeVerifiedJsonRecord(adapter, path, snapshot); notified = false; }
      catch (error) {
        dirty = true;
        if (error.code === "ER_STORE_UNREADABLE") blocked = true;
        report();
      }
    });
  };
  return {
    texts,
    set(key, text) {
      if (!key) return;
      const value = String(text || "").slice(0, DRAFT_LIMIT);
      if ((texts.get(key) || "") === value) return;
      if (value) records[key] = { text: value, updatedAt: Date.now() };
      else delete records[key];
      records = normalizeDrafts(records);
      texts.clear();
      for (const [book, item] of Object.entries(records)) texts.set(book, item.text);
      dirty = true;
      clock.clearTimeout(timer);
      timer = clock.setTimeout(() => { void flush(); }, 350);
    },
    flush,
  };
}
