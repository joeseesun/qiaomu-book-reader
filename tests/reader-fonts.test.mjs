import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { MAX_FONT_BYTES, ReaderFontStore, fontFileFormat, importedReaderFonts, listSystemFonts } from '../src/reader-fonts.js';
import { resolveReaderFont } from '../src/reader-appearance.js';

const data = (signature = [0, 1, 0, 0]) => new Uint8Array([...signature, 1, 2, 3, 4]).buffer;
const upload = (bytes = data(), name = '阅读字体.ttf') => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes });
function fixture() {
  const files = new Map(), folders = new Set();
  let writes = 0, parses = 0;
  const adapter = {
    exists: async (path) => folders.has(path) || files.has(path),
    mkdir: async (path) => { folders.add(path); },
    readBinary: async (path) => { if (!files.has(path)) throw new Error('missing'); return files.get(path); },
    writeBinary: async (path, bytes) => { writes++; files.set(path, bytes.slice(0)); },
  };
  class FontFace {
    constructor(family, bytes) { this.family = family; this.bytes = bytes; }
    async load() { parses++; if (new Uint8Array(this.bytes)[4] === 0xff) throw new Error('invalid font'); return this; }
  }
  const doc = () => ({ defaultView: { FontFace, crypto: webcrypto }, fonts: new Set() });
  const plugin = { settings: { importedFonts: [] }, app: { vault: { adapter } } };
  return { plugin, files, adapter, doc, stats: () => ({ writes, parses }) };
}

test('system font list uses actual enumeration, deduplicates families and quotes CSS names', async () => {
  const fonts = await listSystemFonts({ queryLocalFonts: async () => [
    { family: '思源宋体', style: 'Regular' }, { family: '思源宋体', style: 'Bold' }, { family: 'Arial' },
    { family: 'Font With Spaces' }, { family: 'bad";color:red' }, { family: '' }, {},
  ] });
  assert.equal(fonts.length, 3);
  assert.equal(fonts.find((font) => font.name === '思源宋体').family, '"思源宋体"');
  assert.equal(fonts.find((font) => font.name === 'Font With Spaces').family, '"Font With Spaces"');
  await assert.rejects(listSystemFonts({}), /unsupported/);
  await assert.rejects(listSystemFonts({ queryLocalFonts: async () => { throw new Error('denied'); } }), /denied/);
});

test('font imports identify binary formats, reject collections, wrong types, empty and oversized input', async () => {
  assert.equal(fontFileFormat(data()), 'ttf');
  for (const [signature, expected] of [['OTTO','otf'],['wOFF','woff'],['wOF2','woff2'],['ttcf','']]) {
    assert.equal(fontFileFormat(data([...signature].map((s) => s.charCodeAt(0)))), expected);
  }
  const f = fixture(), store = new ReaderFontStore(f.plugin), doc = f.doc();
  await assert.rejects(store.importFile(doc, upload(data(), 'font.exe')), /format/);
  await assert.rejects(store.importFile(doc, upload(new ArrayBuffer(0))), /size/);
  await assert.rejects(store.importFile(doc, { name:'font.ttf', size:MAX_FONT_BYTES + 1 }), /size/);
  await assert.rejects(store.importFile(doc, upload(data([1,2,3,4]))), /format/);
  assert.equal(f.stats().writes, 0);
});

test('font decoder failure never writes a font file or changes settings', async () => {
  const f = fixture(), store = new ReaderFontStore(f.plugin);
  const bytes = new Uint8Array(data()); bytes[4] = 0xff;
  await assert.rejects(store.importFile(f.doc(), upload(bytes.buffer)), /invalid font/);
  assert.equal(f.stats().writes, 0);
  assert.deepEqual(f.plugin.settings.importedFonts, []);
});

test('import validates bytes, uses a safe content-derived path and reuses duplicate files', async () => {
  const f = fixture(), store = new ReaderFontStore(f.plugin), doc = f.doc();
  const first = await store.importFile(doc, upload(data(), '../字体.ttf'));
  assert.match(first.path, /^_attachments\/qiaomu-reader-fonts\/[a-f0-9]{64}\.ttf$/);
  assert.equal(doc.fonts.size, 1);
  f.plugin.settings.importedFonts = [first];
  const second = await store.importFile(doc, upload(data(), 'renamed.ttf'));
  assert.equal(second, first);
  assert.deepEqual(f.stats(), { writes:1, parses:1 });
});

test('imported font metadata survives restart and loads before use in a separate document', async () => {
  const f = fixture(), store = new ReaderFontStore(f.plugin), firstDoc = f.doc();
  const font = await store.importFile(firstDoc, upload());
  const settings = JSON.parse(JSON.stringify({ fontFamily:'custom', customFontId:font.id, importedFonts:[font] }));
  f.plugin.settings = settings;
  const nextStore = new ReaderFontStore(f.plugin), nextDoc = f.doc();
  await nextStore.load(nextDoc, importedReaderFonts(settings)[0]);
  assert.equal(nextDoc.fonts.size, 1);
  assert.match(resolveReaderFont(settings, { georgia:'Georgia' }), /QBR Imported/);
  assert.deepEqual(f.stats(), { writes:1, parses:2 });
  store.dispose(); nextStore.dispose();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(firstDoc.fonts.size, 0);
  assert.equal(nextDoc.fonts.size, 0);
});

test('missing files and corrupt sync data fail without poisoning cache; reimport repairs the font', async () => {
  const f = fixture(), store = new ReaderFontStore(f.plugin), font = await store.importFile(f.doc(), upload());
  f.files.delete(font.path);
  const doc = f.doc();
  await assert.rejects(store.load(doc, font), /missing/);
  f.files.set(font.path, data([9,9,9,9]));
  await assert.rejects(store.load(doc, font), /integrity/);
  await store.importFile(doc, upload());
  await store.load(doc, font);
  assert.equal(doc.fonts.size, 1);
  assert.equal(f.stats().writes, 2);
});

test('font write/readback failures are surfaced without adding saved font records', async () => {
  const f = fixture(), store = new ReaderFontStore(f.plugin);
  f.adapter.writeBinary = async () => { throw new Error('disk full'); };
  await assert.rejects(store.importFile(f.doc(), upload()), /disk full/);
  assert.deepEqual(f.plugin.settings.importedFonts, []);
  f.adapter.writeBinary = async (path) => { f.files.set(path, data([9,9,9,9])); };
  await assert.rejects(store.importFile(f.doc(), upload()), /integrity/);
});

test('untrusted saved font records cannot redirect reads outside the import folder', () => {
  const id = 'a'.repeat(64), good = { id, name:'test', format:'ttf', path:`_attachments/qiaomu-reader-fonts/${id}.ttf` };
  assert.equal(importedReaderFonts({ importedFonts:[good] }).length, 1);
  for (const broken of [{...good,path:'../../private.key'}, {...good,id:'bad'}, {...good,format:'exe'}, {...good,path:'https://example.com/font.ttf'}]) {
    assert.deepEqual(importedReaderFonts({ importedFonts:[broken] }), []);
  }
});
