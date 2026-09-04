import sourceHanSerifGzip from "../fonts/SourceHanSerifCN-Regular.otf.gz";
import sourceHanSansGzip from "../fonts/SourceHanSansCN-Regular.otf.gz";
import lxgwWenKaiGzip from "../fonts/LXGWWenKaiGBScreen-Regular.ttf.gz";
import lxgwZhenKaiGzip from "../fonts/LXGWZhenKaiGB-Regular.ttf.gz";
import zhuqueFangsongGzip from "../fonts/ZhuqueFangsong-Regular.ttf.gz";

export const BUNDLED_FONT_FAMILIES = Object.freeze({
  sourceHanSerif: "QBR Source Han Serif CN",
  sourceHanSans: "QBR Source Han Sans CN",
  lxgw: "QBR LXGW WenKai GB Screen",
  zhenkai: "QBR LXGW ZhenKai GB",
  zhuque: "QBR Zhuque Fangsong",
});

const BUNDLED_FONTS = Object.freeze({
  sourceHanSerif: {
    family: BUNDLED_FONT_FAMILIES.sourceHanSerif,
    gzip: sourceHanSerifGzip,
  },
  sourceHanSans: {
    family: BUNDLED_FONT_FAMILIES.sourceHanSans,
    gzip: sourceHanSansGzip,
  },
  lxgw: {
    family: BUNDLED_FONT_FAMILIES.lxgw,
    gzip: lxgwWenKaiGzip,
  },
  zhenkai: {
    family: BUNDLED_FONT_FAMILIES.zhenkai,
    gzip: lxgwZhenKaiGzip,
  },
  zhuque: {
    family: BUNDLED_FONT_FAMILIES.zhuque,
    gzip: zhuqueFangsongGzip,
  },
});

const loadsByDocument = new WeakMap();

function decodeDataUrl(dataUrl, view) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).includes(";base64")) {
    throw new Error("bundled font is not a base64 data URL");
  }
  const decode = view?.atob?.bind(view);
  if (typeof decode !== "function") throw new Error("base64 decoder is unavailable");
  const raw = decode(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function inflateGzip(dataUrl, view) {
  const Decompression = view?.DecompressionStream;
  const BlobCtor = view?.Blob;
  const ResponseCtor = view?.Response;
  if (!Decompression || !BlobCtor || !ResponseCtor) {
    throw new Error("gzip decompression is unavailable in this Obsidian runtime");
  }
  const compressed = decodeDataUrl(dataUrl, view);
  const stream = new BlobCtor([compressed]).stream().pipeThrough(new Decompression("gzip"));
  return new ResponseCtor(stream).arrayBuffer();
}

export function ensureBundledReaderFont(doc, fontId) {
  const definition = BUNDLED_FONTS[fontId];
  if (!definition || !doc?.fonts) return Promise.resolve(false);

  let loads = loadsByDocument.get(doc);
  if (!loads) {
    loads = new Map();
    loadsByDocument.set(doc, loads);
  }
  if (loads.has(fontId)) return loads.get(fontId);

  const load = (async () => {
    const view = doc.defaultView;
    const FontFaceCtor = view?.FontFace;
    if (!FontFaceCtor) throw new Error("FontFace API is unavailable");
    const bytes = await inflateGzip(definition.gzip, view);
    const face = new FontFaceCtor(definition.family, bytes, {
      style: "normal",
      weight: "400",
      display: "swap",
    });
    await face.load();
    doc.fonts.add(face);
    return true;
  })().catch((error) => {
    console.error(`Qiaomu Book Reader: could not load bundled font ${fontId}`, error);
    return false;
  });

  loads.set(fontId, load);
  return load;
}
