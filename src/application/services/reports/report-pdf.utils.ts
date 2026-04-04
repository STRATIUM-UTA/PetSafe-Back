import PDFDocument from 'pdfkit';

export const BRAND_TEAL = '#0d9488';
export const BRAND_TEAL_LIGHT = '#f0fdfa';
export const DARK = '#1e293b';
export const MUTED = '#64748b';
export const BORDER = '#e2e8f0';
export const WHITE = '#ffffff';
export const HEADING_BG = '#134e4a';

export function fmtDate(
  raw: string | Date | null | undefined,
  includeTime = false,
): string {
  if (!raw) return 'N/A';

  const d =
    raw instanceof Date ? raw : new Date(String(raw).replace('T', ' ').substring(0, 19));
  if (isNaN(d.getTime())) return String(raw).substring(0, 10);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (!includeTime) return `${day}/${month}/${year}`;

  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

export function fmtTime(raw: string | null | undefined): string {
  if (!raw) return 'N/A';
  return String(raw).substring(0, 5);
}

export function createDoc(
  layout: 'portrait' | 'landscape' = 'portrait',
): typeof PDFDocument extends new (...args: any[]) => infer R ? R : never {
  return new (PDFDocument as any)({
    size: 'A4',
    layout,
    margins: { top: 40, bottom: 40, left: 44, right: 44 },
  });
}

export function drawHeader(doc: any, title: string, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 68).fill(HEADING_BG);

  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18).text('PetSafe', 44, 16);
  doc
    .fillColor('#5eead4')
    .font('Helvetica')
    .fontSize(9)
    .text('Sistema de Gestion Veterinaria', 44, 38);

  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(title, 0, 18, { align: 'right', width: doc.page.width - 44 });

  doc
    .fillColor('#5eead4')
    .font('Helvetica')
    .fontSize(9)
    .text(subtitle, 0, 38, { align: 'right', width: doc.page.width - 44 });

  const y = 78;
  doc.moveTo(44, y).lineTo(doc.page.width - 44, y).strokeColor(BRAND_TEAL).lineWidth(1.5).stroke();
  doc.y = y + 10;
}

export function drawFooter(doc: any): void {
  const currentY = doc.y;
  const now = fmtDate(new Date(), true);
  const footerY = doc.page.height - doc.page.margins.bottom - 12;
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(`Generado: ${now} | PetSafe - Sistema de Gestion Veterinaria`, 44, footerY, {
      align: 'center',
      width: doc.page.width - 88,
      lineBreak: false,
    });
  doc.y = currentY;
}

export function drawSectionTitle(doc: any, text: string): void {
  doc.moveDown(0.6);
  doc.rect(44, doc.y, doc.page.width - 88, 18).fill(BRAND_TEAL_LIGHT);
  doc.fillColor(BRAND_TEAL).font('Helvetica-Bold').fontSize(9.5).text(text, 50, doc.y - 14);
  doc.moveDown(0.4);
}

export function drawKpiRow(
  doc: any,
  kpis: Array<{ label: string; value: string | number }>,
): void {
  const boxW = (doc.page.width - 88) / kpis.length;
  const startY = doc.y;

  kpis.forEach((kpi, i) => {
    const x = 44 + i * boxW;
    doc.rect(x, startY, boxW - 4, 42).fill(BRAND_TEAL_LIGHT);
    doc
      .fillColor(BRAND_TEAL)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(String(kpi.value), x + 4, startY + 4, { width: boxW - 8, align: 'center' });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(kpi.label, x + 4, startY + 26, { width: boxW - 8, align: 'center' });
  });

  doc.y = startY + 52;
}

export function drawTableHeader(
  doc: any,
  cols: Array<{ label: string; width: number }>,
): void {
  const startX = 44;
  const rowH = 18;
  let x = startX;
  const y = doc.y;

  doc.rect(startX, y, doc.page.width - 88, rowH).fill(HEADING_BG);

  cols.forEach((col) => {
    doc
      .fillColor(WHITE)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(col.label, x + 4, y + 4, { width: col.width - 8, ellipsis: true });
    x += col.width;
  });

  doc.y = y + rowH;
}

export function drawTableRow(
  doc: any,
  cols: Array<{ value: string; width: number }>,
  isEven: boolean,
): void {
  const startX = 44;
  let x = startX;
  const y = doc.y;
  const paddingX = 4;
  const paddingY = 3;
  const minRowH = 18;
  const contentHeights = cols.map((col) =>
    doc.heightOfString(col.value, {
      width: col.width - paddingX * 2,
      align: 'left',
    }),
  );
  const rowH = Math.max(
    minRowH,
    Math.ceil(Math.max(...contentHeights, 0) + paddingY * 2),
  );

  if (isEven) {
    doc.rect(startX, y, doc.page.width - 88, rowH).fill('#f8fafc');
  }

  cols.forEach((col) => {
    doc
      .fillColor(DARK)
      .font('Helvetica')
      .fontSize(7.5)
      .text(col.value, x + paddingX, y + paddingY, {
        width: col.width - paddingX * 2,
        align: 'left',
      });
    x += col.width;
  });

  doc
    .moveTo(startX, y + rowH)
    .lineTo(doc.page.width - 44, y + rowH)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

  doc.y = y + rowH;
}

export function checkPageBreak(doc: any, neededHeight = 24): boolean {
  if (doc.y + neededHeight <= doc.page.height - 80) return false;

  doc.addPage();
  doc.y = 50;
  drawFooter(doc);
  return true;
}
