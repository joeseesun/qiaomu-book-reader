const HAN = /[\u3400-\u9fff]/;
const CYRILLIC = /[А-Яа-яЁё]/;

export function isChineseSourceText(value) {
  const text = String(value || "");
  return HAN.test(text) && !CYRILLIC.test(text);
}

export function translateUiText(language, source, english, chinese) {
  const text = String(source ?? "");
  if (language === "zh") return chinese?.[text] ?? text;
  if (language === "en") return english?.[text] ?? text;
  // The inherited interface uses Russian strings as its original source. New
  // Chinese-first features use Chinese source keys instead. Until a reviewed
  // Russian translation exists, English is a deliberate readable fallback;
  // showing raw Chinese inside an otherwise Russian screen is not.
  if (language === "ru" && isChineseSourceText(text)) {
    return english?.[text] ?? text;
  }
  return text;
}
