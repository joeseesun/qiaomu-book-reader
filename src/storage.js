export function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseJsonRecord(raw, label = "JSON") {
  const value = JSON.parse(raw);
  if (!isPlainRecord(value)) throw new TypeError(`${label} must contain a JSON object`);
  return value;
}

// Each call receives its own result promise, while failures are absorbed only
// by the internal tail. One failed write therefore reaches its caller without
// permanently blocking every later save.
export function createSerialTaskQueue() {
  let tail = Promise.resolve();
  return {
    run(task) {
      const result = tail.then(task);
      tail = result.catch(() => {});
      return result;
    },
    drain() {
      return tail;
    },
  };
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// process() serializes a read/modify/write through Obsidian's adapter on both
// desktop and mobile. A separate recovery snapshot is still needed: this API
// cannot protect against an external sync client replacing a file afterwards.
export async function writeVerifiedJsonRecord(adapter, file, value, { validateExisting = true } = {}) {
  const raw = JSON.stringify(value, null, 2);
  parseJsonRecord(raw, file);
  if (await adapter.exists(file)) {
    await adapter.process(file, (current) => {
      if (validateExisting) {
        try { parseJsonRecord(current, file); }
        catch (cause) {
          throw Object.assign(new Error("JSON store became unreadable", { cause }), { code: "ER_STORE_UNREADABLE" });
        }
      }
      return raw;
    });
  } else {
    await adapter.write(file, raw);
  }
  if (await adapter.read(file) !== raw) throw new Error("JSON store write verification failed");
}

export function mergeReadingProgress(restored, current) {
  const merged = { ...restored };
  for (const [book, entry] of Object.entries(current || {})) {
    if (isPlainRecord(entry) && (!merged[book] || (entry.lastRead || 0) >= (merged[book].lastRead || 0))) {
      merged[book] = entry;
    }
  }
  return merged;
}

export function corruptBackupPath(file, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${file}.corrupt-${stamp}.bak`;
}

export async function readJsonRecordStore(adapter, file, label = "JSON", now = new Date()) {
  let raw = "";
  try {
    if (!await adapter.exists(file)) return { status: "missing", value: {}, backupPath: "" };
    raw = await adapter.read(file);
    return { status: "ok", value: parseJsonRecord(raw, label), backupPath: "" };
  } catch (error) {
    let backupPath = "";
    if (raw) {
      const candidate = corruptBackupPath(file, now);
      try {
        await adapter.write(candidate, raw);
        backupPath = candidate;
      } catch {
        // The caller still blocks future writes even when the adapter cannot
        // preserve a second copy. The original file is never overwritten here.
      }
    }
    return { status: "unreadable", value: null, backupPath, error };
  }
}
