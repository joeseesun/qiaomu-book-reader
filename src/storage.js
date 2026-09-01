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
