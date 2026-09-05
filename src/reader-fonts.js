export const FONT_FILE_ACCEPT = ".ttf,.otf,.woff,.woff2";
export const MAX_FONT_BYTES = 64 * 1024 * 1024;
const FONT_FOLDER = "_attachments/qiaomu-reader-fonts";
const stores = new WeakMap();

export function importedFontFamily(id) {
  return /^[a-f0-9]{64}$/.test(id || "") ? `QBR Imported ${id}` : "";
}

export function importedReaderFonts(settings) {
  return (Array.isArray(settings.importedFonts) ? settings.importedFonts : [])
    .filter((font) => font && importedFontFamily(font.id)
      && typeof font.name === "string" && font.name.trim()
      && font.path === `${FONT_FOLDER}/${font.id}.${font.format}`
      && /^(ttf|otf|woff|woff2)$/.test(font.format));
}

export function fontFileFormat(bytes) {
  const head = Array.from(new Uint8Array(bytes).slice(0, 4));
  if (head.join(",") === "0,1,0,0") return "ttf";
  const signature = String.fromCharCode(...head);
  return { true: "ttf", OTTO: "otf", wOFF: "woff", wOF2: "woff2" }[signature] || "";
}

export async function listSystemFonts(view) {
  if (typeof view?.queryLocalFonts !== "function") throw new Error("unsupported");
  // Called only from the user's button click, preserving transient activation.
  const fonts = await view.queryLocalFonts();
  const families = new Map();
  for (const font of fonts) {
    if (typeof font.family !== "string") continue;
    const name = font.family.trim();
    if (!name || /[";{}<>\\]/u.test(name) || Array.from(name).some((c) => c.charCodeAt(0) < 32)) continue;
    if (!families.has(name)) families.set(name, { name, family: `"${name}"` });
  }
  return [...families.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function digest(bytes, view) {
  const hash = await view.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export class ReaderFontStore {
  constructor(plugin) {
    this.plugin = plugin;
    this.documents = new Map();
    this.disposed = false;
  }

  async load(doc, font, bytes) {
    if (this.disposed) throw new Error("closed");
    let loads = this.documents.get(doc);
    if (!loads) { loads = new Map(); this.documents.set(doc, loads); }
    if (loads.has(font.id)) return loads.get(font.id);
    const promise = (async () => {
      const data = bytes || await this.plugin.app.vault.adapter.readBinary(font.path);
      if (data.byteLength > MAX_FONT_BYTES || await digest(data, doc.defaultView) !== font.id) throw new Error("integrity");
      const face = new doc.defaultView.FontFace(importedFontFamily(font.id), data);
      await face.load();
      if (this.disposed) throw new Error("closed");
      doc.fonts.add(face);
      return face;
    })();
    loads.set(font.id, promise);
    try { return await promise; }
    catch (error) { loads.delete(font.id); throw error; }
  }

  async importFile(doc, file) {
    if (!file || !/\.(ttf|otf|woff2?)$/i.test(file.name || "")) throw new Error("format");
    if (!file.size || file.size > MAX_FONT_BYTES) throw new Error("size");
    const bytes = await file.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_FONT_BYTES) throw new Error("size");
    const format = fontFileFormat(bytes);
    if (!format) throw new Error("format");
    const id = await digest(bytes, doc.defaultView);
    const font = { id, format, path: `${FONT_FOLDER}/${id}.${format}`, name: file.name.replace(/\.[^.]+$/, "").slice(0, 200) };
    // FontFace/OTS must accept the actual bytes before anything is persisted.
    await this.load(doc, font, bytes);
    const adapter = this.plugin.app.vault.adapter;
    for (const folder of ["_attachments", FONT_FOLDER]) {
      if (!await adapter.exists(folder)) {
        try { await adapter.mkdir(folder); }
        catch (error) { if (!await adapter.exists(folder)) throw error; }
      }
    }
    let intact = false;
    try { intact = await digest(await adapter.readBinary(font.path), doc.defaultView) === id; }
    catch { /* missing or unfinished sync; the selected file restores it */ }
    if (!intact) await adapter.writeBinary(font.path, bytes);
    const saved = await adapter.readBinary(font.path);
    if (await digest(saved, doc.defaultView) !== id) throw new Error("integrity");
    return importedReaderFonts(this.plugin.settings).find((item) => item.id === id) || font;
  }

  dispose() {
    this.disposed = true;
    for (const [doc, loads] of this.documents) {
      for (const load of loads.values()) void load.then((face) => doc.fonts.delete(face)).catch(() => {});
    }
    this.documents.clear();
  }
}

export function readerFontStore(plugin) {
  if (!stores.has(plugin)) stores.set(plugin, new ReaderFontStore(plugin));
  return stores.get(plugin);
}

export function disposeReaderFonts(plugin) {
  stores.get(plugin)?.dispose();
  stores.delete(plugin);
}
