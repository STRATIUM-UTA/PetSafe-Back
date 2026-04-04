import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const BRAND_TEAL = '#0d9488';
const BRAND_TEAL_LIGHT = '#f0fdfa';
const DARK = '#1e293b';
const MUTED = '#64748b';
const WHITE = '#ffffff';
const HEADING_BG = '#134e4a';
const NO_DATA = 'No se han encontrado datos.';

export interface ClinicalHistoryTutorPdfItem {
  firstName: string;
  lastName: string;
  documentId: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
}

export interface ClinicalHistoryVaccinePdfItem {
  vaccineName: string;
  applicationDate: Date | string | null;
  administeredBy: string;
  administeredAt: string;
  origin: string;
  nextDoseDate: Date | string | null;
}

export interface ClinicalHistoryTreatmentItemPdfItem {
  medication: string;
  dose: string;
  frequency: string;
  durationDays: string;
  notes: string;
  status: string;
}

export interface ClinicalHistoryTreatmentPdfItem {
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  generalInstructions: string;
  items: ClinicalHistoryTreatmentItemPdfItem[];
}

export interface ClinicalHistorySurgeryPdfItem {
  surgeryType: string;
  scheduledDate: Date | string | null;
  performedDate: Date | string | null;
  status: string;
  description: string;
  postoperativeInstructions: string;
}

export interface ClinicalHistoryPatientPdfData {
  name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  birthDate: Date | string | null;
  currentWeight: string;
  isSterilized: string;
  microchipCode: string;
}

export interface ClinicalHistoryPdfData {
  patient: ClinicalHistoryPatientPdfData;
  tutors: ClinicalHistoryTutorPdfItem[];
  vaccines: ClinicalHistoryVaccinePdfItem[];
  treatments: ClinicalHistoryTreatmentPdfItem[];
  surgeries: ClinicalHistorySurgeryPdfItem[];
}

function createDoc(): typeof PDFDocument extends new (...args: any[]) => infer R ? R : never {
  return new (PDFDocument as any)({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 44, right: 44 },
  });
}

function withFallback(value: string | null | undefined): string {
  if (typeof value !== 'string') return NO_DATA;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : NO_DATA;
}

function fmtDate(raw: string | Date | null | undefined, includeTime = false): string {
  if (!raw) return NO_DATA;

  const d =
    raw instanceof Date ? raw : new Date(String(raw).replace('T', ' ').substring(0, 19));
  if (isNaN(d.getTime())) return withFallback(String(raw));

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (!includeTime) return `${day}/${month}/${year}`;

  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

function drawHeader(doc: any, title: string, subtitle: string): void {
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

function drawFooter(doc: any): void {
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

function ensureDocSpace(doc: any, neededSpace = 28): void {
  if (doc.y + neededSpace <= doc.page.height - 56) return;

  doc.addPage();
  doc.y = 50;
  drawFooter(doc);
}

function drawSectionTitle(doc: any, text: string): void {
  ensureDocSpace(doc, 24);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(44, y, doc.page.width - 88, 18).fill(BRAND_TEAL_LIGHT);
  doc.fillColor(BRAND_TEAL).font('Helvetica-Bold').fontSize(9.5).text(text, 50, y + 4);
  doc.y = y + 22;
}

function drawField(doc: any, label: string, value: string): void {
  ensureDocSpace(doc, 20);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8.5).text(`${label}: `, 44, doc.y, {
    continued: true,
  });
  doc.font('Helvetica').text(withFallback(value), { width: doc.page.width - 88 });
}

function drawParagraph(doc: any, label: string, value: string): void {
  ensureDocSpace(doc, 34);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8.5).text(`${label}:`, 44, doc.y);
  doc
    .fillColor(DARK)
    .font('Helvetica')
    .fontSize(8.5)
    .text(withFallback(value), 56, doc.y + 2, { width: doc.page.width - 112 });
  doc.moveDown(0.3);
}

function drawEmptyState(doc: any): void {
  drawField(doc, 'Detalle', NO_DATA);
}

@Injectable()
export class ClinicalHistoryPdfService {
  async render(data: ClinicalHistoryPdfData): Promise<Buffer> {
    const doc = createDoc();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    drawHeader(
      doc,
      'Historial clinico del paciente',
      `Paciente: ${withFallback(data.patient.name)}`,
    );

    drawSectionTitle(doc, 'Paciente');
    drawField(doc, 'Nombre', data.patient.name);
    drawField(doc, 'Especie', data.patient.species);
    drawField(doc, 'Raza', data.patient.breed);
    drawField(doc, 'Color', data.patient.color);
    drawField(doc, 'Sexo', data.patient.sex);
    drawField(doc, 'Fecha de nacimiento', fmtDate(data.patient.birthDate));
    drawField(doc, 'Peso actual', data.patient.currentWeight);
    drawField(doc, 'Esterilizado', data.patient.isSterilized);
    drawField(doc, 'Codigo microchip', data.patient.microchipCode);

    drawSectionTitle(doc, 'Tutores');
    if (data.tutors.length === 0) {
      drawEmptyState(doc);
    } else {
      data.tutors.forEach((tutor, index) => {
        ensureDocSpace(doc, 18);
        doc
          .fillColor(BRAND_TEAL)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Tutor ${index + 1}${tutor.isPrimary ? ' - Principal' : ''}`, 44, doc.y);
        drawField(doc, 'Nombre', tutor.firstName);
        drawField(doc, 'Apellido', tutor.lastName);
        drawField(doc, 'Documento', tutor.documentId);
        drawField(doc, 'Telefono', tutor.phone);
        drawField(doc, 'Correo', tutor.email);
        drawField(doc, 'Relacion', tutor.relationship);
        doc.moveDown(0.4);
      });
    }

    drawSectionTitle(doc, 'Vacunas');
    if (data.vaccines.length === 0) {
      drawEmptyState(doc);
    } else {
      data.vaccines.forEach((vaccine, index) => {
        ensureDocSpace(doc, 18);
        doc
          .fillColor(BRAND_TEAL)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Vacuna ${index + 1}`, 44, doc.y);
        drawField(doc, 'Vacuna', vaccine.vaccineName);
        drawField(doc, 'Fecha de aplicacion', fmtDate(vaccine.applicationDate));
        drawField(doc, 'Administrado por', vaccine.administeredBy);
        drawField(doc, 'Administrado en', vaccine.administeredAt);
        drawField(doc, 'Origen', vaccine.origin);
        drawField(doc, 'Siguiente dosis', fmtDate(vaccine.nextDoseDate));
        doc.moveDown(0.4);
      });
    }

    drawSectionTitle(doc, 'Tratamientos');
    if (data.treatments.length === 0) {
      drawEmptyState(doc);
    } else {
      data.treatments.forEach((treatment, index) => {
        ensureDocSpace(doc, 18);
        doc
          .fillColor(BRAND_TEAL)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Tratamiento ${index + 1}`, 44, doc.y);
        drawField(doc, 'Estado', treatment.status);
        drawField(doc, 'Fecha inicio', fmtDate(treatment.startDate));
        drawField(doc, 'Fecha fin', fmtDate(treatment.endDate));
        drawParagraph(doc, 'Instrucciones generales', treatment.generalInstructions);

        if (treatment.items.length === 0) {
          drawField(doc, 'Items', NO_DATA);
        } else {
          treatment.items.forEach((item, itemIndex) => {
            ensureDocSpace(doc, 18);
            doc
              .fillColor(DARK)
              .font('Helvetica-Bold')
              .fontSize(9)
              .text(`Item ${itemIndex + 1}`, 56, doc.y);
            drawField(doc, 'Medicacion', item.medication);
            drawField(doc, 'Dosis', item.dose);
            drawField(doc, 'Frecuencia', item.frequency);
            drawField(doc, 'Duracion en dias', item.durationDays);
            drawField(doc, 'Estado', item.status);
            drawParagraph(doc, 'Notas', item.notes);
          });
        }
        doc.moveDown(0.4);
      });
    }

    drawSectionTitle(doc, 'Cirugias');
    if (data.surgeries.length === 0) {
      drawEmptyState(doc);
    } else {
      data.surgeries.forEach((surgery, index) => {
        ensureDocSpace(doc, 18);
        doc
          .fillColor(BRAND_TEAL)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Cirugia ${index + 1}`, 44, doc.y);
        drawField(doc, 'Tipo', surgery.surgeryType);
        drawField(doc, 'Programada', fmtDate(surgery.scheduledDate, true));
        drawField(doc, 'Realizada', fmtDate(surgery.performedDate, true));
        drawField(doc, 'Estado', surgery.status);
        drawParagraph(doc, 'Descripcion', surgery.description);
        drawParagraph(doc, 'Post operatorio', surgery.postoperativeInstructions);
        doc.moveDown(0.4);
      });
    }

    drawFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
