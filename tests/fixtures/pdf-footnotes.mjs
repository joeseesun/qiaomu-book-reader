// Minimal, original PDF with a raised inline reference and a bottom footnote.
export function footnotePdfBytes() {
  const stream = 'BT /F1 16 Tf 48 730 Td (PDF footnote regression) Tj ET\n'
    + 'BT /F1 12 Tf 48 680 Td (Text before) Tj /F1 7 Tf 65 5 Td (31) Tj /F1 12 Tf 10 -5 Td ( continues on the same line.) Tj ET\n'
    + 'BT /F1 12 Tf 48 656 Td (The next paragraph keeps its own baseline.) Tj ET\n'
    + '48 100 m 260 100 l S\nBT /F1 8 Tf 48 80 Td (31. This footnote stays at the bottom of the original page.) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let data = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(data.length); data += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = data.length;
  data += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  data += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(data);
}
