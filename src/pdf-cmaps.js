import { EMBEDDED_PDF_CMAPS } from "./pdf-cmaps-data.js";

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class EmbeddedPdfBinaryDataFactory {
  async fetch({ kind, filename }) {
    if (kind !== "cMapUrl") {
      throw new Error(`Unsupported embedded PDF resource kind: ${kind}`);
    }
    const encoded = EMBEDDED_PDF_CMAPS[filename];
    if (!encoded) throw new Error(`Embedded PDF CMap is unavailable: ${filename}`);
    return decodeBase64(encoded);
  }
}

export const PDF_CMAP_OPTIONS = Object.freeze({
  cMapUrl: "qiaomu-cmaps:///",
  cMapPacked: true,
  useWorkerFetch: false,
  BinaryDataFactory: EmbeddedPdfBinaryDataFactory,
});
