import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { cloneJson, createSerialTaskQueue, isPlainRecord, mergeReadingProgress, parseJsonRecord, readJsonRecordStore, writeVerifiedJsonRecord } from "../src/storage.js";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const primary = "reading-progress.json";
const recovery = ".obsidian/plugins/reader/reading-progress-recovery.json";
const previous = { book: { pct: 0.1, lastRead: 1, block: 12 } };
const latest = { book: { pct: 0.2, lastRead: 2, block: 24 } };

function fixture() {
  const files = new Map([[primary, JSON.stringify(previous)]]);
  const calls = [];
  const adapter = {
    async exists(file) { return files.has(file); },
    async read(file) { if (!files.has(file)) throw new Error("missing"); return files.get(file); },
    async write(file, raw) { calls.push(["write", file]); files.set(file, raw); },
    async process(file, fn) { calls.push(["process", file]); const raw = fn(await this.read(file)); files.set(file, raw); return raw; },
  };
  const methods = source.slice(source.indexOf("  async _loadProgressFromVault()"), source.indexOf("  async _loadJsonStore("));
  const Host = vm.runInNewContext(`(class {${methods}})`, {
    cloneJson, isPlainRecord, mergeReadingProgress, readJsonRecordStore, writeVerifiedJsonRecord,
    __ertr: (text) => text,
  });
  const host = new Host();
  Object.assign(host, {
    app: { vault: { adapter } }, progress: cloneJson(latest), _progressQueue: createSerialTaskQueue(), _blockedStores: new Set(),
    _progressFilePath: () => primary, _progressRecoveryFilePath: () => recovery,
    async _writeRescue() {},
    async _loadJsonStore(file) {
      try { return parseJsonRecord(await adapter.read(file)); }
      catch { this._blockedStores.add(file); return null; }
    },
  });
  return { files, calls, adapter, host };
}

test("progress writes verify a separate recovery snapshot before processing the primary", async () => {
  const { host, files, calls } = fixture();
  assert.equal(await host._saveProgressToVault(), true);
  assert.deepEqual(JSON.parse(files.get(primary)), latest);
  assert.deepEqual(JSON.parse(files.get(recovery)), { sourcePath: primary, progress: latest });
  assert.deepEqual(calls, [["write", recovery], ["process", primary]]);
});

test("a failed recovery write never touches the existing primary", async () => {
  const { host, files, adapter } = fixture();
  adapter.write = async () => { throw new Error("disk full"); };
  await assert.rejects(host._saveProgressToVault(), /disk full/);
  assert.deepEqual(JSON.parse(files.get(primary)), previous);
});

test("a truncated primary write is detected and latest positions survive in recovery", async () => {
  const { host, files, adapter } = fixture();
  adapter.process = async (file, fn) => { fn(files.get(file)); files.set(file, ""); };
  await assert.rejects(host._saveProgressToVault(), /verification failed/);
  assert.equal(files.get(primary), "");
  assert.deepEqual(JSON.parse(files.get(recovery)).progress, latest);
});

test("a blocked primary still saves new positions independently without overwriting the original", async () => {
  const { host, files } = fixture();
  files.set(primary, "");
  host._blockedStores.add(primary);
  assert.equal(await host._saveProgressToVault(), false);
  assert.equal(files.get(primary), "");
  assert.deepEqual(JSON.parse(files.get(recovery)).progress, latest);
});

test("sync corruption after loading blocks the primary instead of replacing unreadable data", async () => {
  const { host, files } = fixture();
  files.set(primary, "{truncated");
  await assert.rejects(host._saveProgressToVault(), { code: "ER_STORE_UNREADABLE" });
  assert.equal(files.get(primary), "{truncated");
  assert.equal(host._blockedStores.has(primary), true);
  assert.deepEqual(JSON.parse(files.get(recovery)).progress, latest);
});

test("restart can read a matching recovery snapshot but keeps the damaged source blocked", async () => {
  const { host, files } = fixture();
  files.set(primary, "");
  files.set(recovery, JSON.stringify({ sourcePath: primary, progress: latest }));
  host.progress = {};
  assert.deepEqual(await host._loadProgressFromVault(), latest);
  assert.equal(host._blockedStores.has(primary), true);
  assert.equal(files.get(primary), "");
  files.set(recovery, JSON.stringify({ sourcePath: "other-folder/reading-progress.json", progress: latest }));
  assert.equal(await host._loadProgressFromVault(), null);
});

test("recovery merges by lastRead and preserves newer paragraph anchors", () => {
  const old = { ...previous, other: { pct: 0.8, lastRead: 5, block: 99 } };
  assert.deepEqual(mergeReadingProgress(old, { ...latest, other: { pct: 0, lastRead: 3 } }), {
    ...latest, other: old.other,
  });
});

test("invalid snapshot values are rejected before any writes", async () => {
  const { adapter, calls } = fixture();
  await assert.rejects(writeVerifiedJsonRecord(adapter, primary, []), /JSON object/);
  assert.deepEqual(calls, []);
});

test("retry preserves newer in-memory positions and reports persistence failure", async () => {
  const method = source.slice(source.indexOf("  async retryUnreadableStore("), source.indexOf("  // Safety net: keep a dated copy"));
  const Host = vm.runInNewContext(`(class {${method}})`, { mergeReadingProgress, __ertr: (text) => text, console: { error() {} } });
  const host = new Host();
  Object.assign(host, {
    progress: latest, _progressFilePath: () => primary, _highlightsFilePath: () => "highlights.json",
    _loadJsonStore: async () => previous,
    _saveProgressToVault: async () => { throw new Error("disk full"); },
  });
  assert.equal(await host.retryUnreadableStore(primary), false);
  assert.deepEqual(host.progress, latest);
  host._saveProgressToVault = async () => true;
  assert.equal(await host.retryUnreadableStore(primary), true);
});
