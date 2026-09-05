import { importedFontFamily, importedReaderFonts } from "./reader-fonts.js";

// Accept font names/stacks, never arbitrary CSS. Canonical quoting also keeps
// this value safe when used inside the reader's generated stylesheet.
export function normalizeCustomFontFamily(value) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source) return "";
  if (source.length > 500 || /[;{}<>\\]/u.test(source) || Array.from(source).some((char) => char.charCodeAt(0) < 32)) return null;
  const names = [];
  const token = /\s*(?:"([^"\n]+)"|'([^'\n]+)'|([\p{L}\p{N}_ .-]+))\s*(,|$)/uy;
  let offset = 0;
  while (offset < source.length) {
    token.lastIndex = offset;
    const match = token.exec(source);
    if (!match) return null;
    const name = (match[1] ?? match[2] ?? match[3]).trim();
    if (!name || name.includes('"')) return null;
    const generic = match[3] && /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong)$/i.test(name);
    names.push(generic ? name.toLowerCase() : `"${name}"`);
    offset = token.lastIndex;
    if (match[4] && offset === source.length) return null;
  }
  return names.join(", ");
}

export function resolveReaderFont(settings, fonts) {
  if (settings.fontFamily === "custom") {
    if (settings.customFontId) {
      const font = importedReaderFonts(settings).find((item) => item.id === settings.customFontId);
      return font ? `"${importedFontFamily(font.id)}", serif` : fonts.georgia;
    }
    return normalizeCustomFontFamily(settings.customFontFamily) || fonts.georgia;
  }
  return fonts[settings.fontFamily] || fonts.georgia;
}

// Reparent the existing controls so their listeners and keyboard behaviour are
// retained. Only the arrows leave the auto-hiding toolbar in always-on mode.
export function syncPageButtons(view) {
  const elements = view._pageButtons;
  if (!elements) return;
  const { root, toolbar, previous, next } = elements;
  const always = view.plugin.settings.pageButtonsVisibility === "always";
  root.classList.toggle("er-page-buttons-always", always);
  previous.classList.toggle("er-page-edge-prev", always);
  next.classList.toggle("er-page-edge-next", always);
  for (const button of [previous, next]) button.classList.toggle("er-page-edge", always);
  if (always) {
    if (previous.parentElement !== root) root.append(previous, next);
  } else if (previous.parentElement !== toolbar) {
    toolbar.prepend(previous);
    toolbar.append(next);
  }
}
