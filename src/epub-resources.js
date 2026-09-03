const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function resolveEpubResourcePath(sectionUrl, resourceRef) {
  const ref = String(resourceRef || "").trim();
  if (!ref || ref.startsWith("#") || ref.startsWith("//") || EXTERNAL_SCHEME.test(ref)) return "";

  const section = String(sectionUrl || "").split(/[?#]/, 1)[0];
  const basePath = section.startsWith("/") ? section : `/${section}`;
  try {
    return new URL(ref, `https://epub.local${basePath}`).pathname;
  } catch {
    return "";
  }
}

function imageReference(element) {
  const tag = String(element?.tagName || "").toLowerCase().split(":").pop();
  if (tag === "img") return { attribute: "src", value: element.getAttribute?.("src") || "" };
  if (tag !== "image") return null;

  const href = element.getAttribute?.("href");
  if (href) return { attribute: "href", value: href };
  const xlinkHref = element.getAttribute?.("xlink:href");
  return xlinkHref ? { attribute: "xlink:href", value: xlinkHref } : null;
}

export async function rewriteEpubImageResources(root, sectionUrl, archive) {
  const result = { rewritten: 0, failed: 0 };
  const elements = Array.from(root?.querySelectorAll?.("img, image") || []);
  for (const element of elements) {
    const reference = imageReference(element);
    if (!reference || reference.value.startsWith("data:")) continue;
    const archivePath = resolveEpubResourcePath(sectionUrl, reference.value);
    if (!archivePath) continue;
    try {
      const dataUrl = await archive?.getBase64?.(archivePath);
      if (!dataUrl) {
        result.failed += 1;
        continue;
      }
      element.setAttribute(reference.attribute, dataUrl);
      result.rewritten += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
