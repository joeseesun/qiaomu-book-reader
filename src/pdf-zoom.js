export const PDF_ZOOM_DEFAULT = 1;
export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 3;
export const PDF_ZOOM_STEP = 0.25;

export function clampPdfZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return PDF_ZOOM_DEFAULT;
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, zoom));
}

export function stepPdfZoom(value, direction) {
  const delta = direction < 0 ? -PDF_ZOOM_STEP : PDF_ZOOM_STEP;
  return clampPdfZoom(Math.round((clampPdfZoom(value) + delta) * 100) / 100);
}

export function pdfZoomPercent(value) {
  return `${Math.round(clampPdfZoom(value) * 100)}%`;
}

export function pdfZoomFromWheel(value, deltaY) {
  const delta = Number(deltaY);
  if (!Number.isFinite(delta) || delta === 0) return clampPdfZoom(value);
  return clampPdfZoom(clampPdfZoom(value) * Math.exp(-delta * 0.002));
}

export function pdfZoomShortcut(event) {
  if (!event || (!event.metaKey && !event.ctrlKey) || event.altKey) return null;
  if (event.key === "0") return "reset";
  if (event.key === "+" || event.key === "=") return "in";
  if (event.key === "-" || event.key === "_") return "out";
  return null;
}
