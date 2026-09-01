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
