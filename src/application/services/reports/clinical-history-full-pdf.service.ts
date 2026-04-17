import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const BRAND = '#134e4a';
const BRAND_ALT = '#0f766e';
const BRAND_SOFT = '#f3f4f6';
const BORDER = '#cbd5e1';
const TEXT = '#111827';
const MUTED = '#6b7280';
const WHITE = '#ffffff';
const NO_DATA = 'Sin registro';
const EMPTY_SECTION_TEXT = 'No hay datos registrados para esta seccion.';

function textValue(value: string | null | undefined): string {
  if (typeof value !== 'string') return NO_DATA;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : NO_DATA;
}

function maybeText(value: string | null | undefined): string | null {
  const normalized = textValue(value);
  return normalized === NO_DATA ? null : normalized;
}

function formatDate(raw: string | Date | null | undefined, withTime = false): string {
  if (!raw) return NO_DATA;

  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return textValue(String(raw));

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (!withTime) {
    return `${day}/${month}/${year}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatBool(value: boolean | null | undefined): string {
  if (value === true) return 'Si';
  if (value === false) return 'No';
  return NO_DATA;
}

function formatEncounterStatus(status: string): string {
  const labels: Record<string, string> = {
    ACTIVA: 'Activa',
    FINALIZADA: 'Finalizada',
    ANULADA: 'Anulada',
  };

  return labels[status] ?? textValue(status);
}

function createDoc(): any {
  return new (PDFDocument as any)({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 42, right: 42 },
  });
}

function sectionWidth(doc: any, left = doc.page.margins.left): number {
  return doc.page.width - left - doc.page.margins.right;
}

function ensureSpace(doc: any, height: number, patientName: string): void {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
  drawPageHeader(doc, patientName, true);
}

function drawPageHeader(doc: any, patientName: string, continuation = false): void {
  doc.rect(0, 0, doc.page.width, 70).fill(BRAND);
  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('PetSafe', doc.page.margins.left, 26, {
      lineBreak: false,
    });
  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('Historia clinica', 0, 27, {
      align: 'center',
      width: doc.page.width,
      lineBreak: false,
    });

  doc.fillColor(TEXT);
  doc.y = 90;
}

function drawPrimarySectionTitle(doc: any, title: string, patientName: string): void {
  ensureSpace(doc, 30, patientName);
  const y = doc.y;
  doc.rect(doc.page.margins.left, y, sectionWidth(doc), 20).fill(BRAND_SOFT);
  doc
    .fillColor(TEXT)
    .font('Helvetica-Bold')
    .fontSize(10.3)
    .text(title, doc.page.margins.left + 8, y + 4, { lineBreak: false });
  doc.fillColor(TEXT);
  doc.y = y + 38;
}

function drawVisitHeader(doc: any, title: string, meta: string, patientName: string): void {
  ensureSpace(doc, 28, patientName);
  const y = doc.y;
  doc
    .fillColor(TEXT)
    .font('Helvetica-Bold')
    .fontSize(10.1)
    .text(title, doc.page.margins.left, y, { lineBreak: false });
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8.1)
    .text(meta, doc.page.margins.left, y + 14, {
      width: sectionWidth(doc),
    });
  doc.fillColor(TEXT);
  doc.y = y + 34;
}

function drawVisitSectionTitle(doc: any, title: string, patientName: string, left: number): void {
  ensureSpace(doc, 22, patientName);
  const y = doc.y;
  doc.rect(left, y + 1, 4, 12).fill(BRAND_ALT);
  doc
    .fillColor(TEXT)
    .font('Helvetica-Bold')
    .fontSize(9.1)
    .text(title, left + 10, y, { lineBreak: false });
  doc.fillColor(TEXT);
  doc.y = y + 28;
}

function measureCellHeight(doc: any, text: string, width: number): number {
  doc.font('Helvetica').fontSize(9.4);
  return doc.heightOfString(text, { width }) + 15;
}

function drawGrid(
  doc: any,
  items: Array<{ label: string; value: string | null | undefined }>,
  patientName: string,
  left = doc.page.margins.left,
  columns = 2,
): void {
  const entries = items.filter((item) => item.value !== null && item.value !== undefined);
  if (entries.length === 0) {
    return;
  }

  const gap = 16;
  const width = sectionWidth(doc, left);
  const columnWidth = (width - gap * (columns - 1)) / columns;

  for (let index = 0; index < entries.length; index += columns) {
    const row = entries.slice(index, index + columns);
    const rowHeight = Math.max(
      ...row.map((item) => measureCellHeight(doc, textValue(item.value), columnWidth)),
      24,
    );

    ensureSpace(doc, rowHeight, patientName);
    const rowY = doc.y;

    row.forEach((item, columnIndex) => {
      const x = left + columnIndex * (columnWidth + gap);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.1)
        .text(item.label, x, rowY, {
          width: columnWidth,
          lineBreak: false,
        });
      doc
        .fillColor(TEXT)
        .font('Helvetica')
        .fontSize(9.4)
        .text(textValue(item.value), x, rowY + 11, {
          width: columnWidth,
        });
    });

    doc.y = rowY + rowHeight;
  }

  doc.moveDown(0.8);
}

function drawParagraph(
  doc: any,
  label: string,
  value: string | null | undefined,
  patientName: string,
  left = doc.page.margins.left,
): void {
  const printableValue = maybeText(value);
  if (!printableValue) {
    return;
  }

  ensureSpace(doc, 36, patientName);
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(7.3)
    .text(label, left, doc.y);
  doc
    .fillColor(TEXT)
    .font('Helvetica')
    .fontSize(9.2)
    .text(printableValue, left, doc.y + 3, {
      width: sectionWidth(doc, left),
    });
  doc.moveDown(0.95);
}

function drawBulletList(
  doc: any,
  items: string[],
  patientName: string,
  left = doc.page.margins.left,
): void {
  const entries = items.filter((item) => item.trim().length > 0);
  if (entries.length === 0) {
    return;
  }

  entries.forEach((item) => {
    ensureSpace(doc, 16, patientName);
    doc
      .fillColor(TEXT)
      .font('Helvetica')
      .fontSize(8.8)
      .text(`• ${item}`, left, doc.y, {
        width: sectionWidth(doc, left),
      });
  });
  doc.moveDown(0.5);
}

function drawEmptySection(doc: any, patientName: string, left = doc.page.margins.left): void {
  ensureSpace(doc, 18, patientName);
  doc
    .fillColor(MUTED)
    .font('Helvetica-Oblique')
    .fontSize(8.6)
    .text(EMPTY_SECTION_TEXT, left, doc.y, {
      width: sectionWidth(doc, left),
    });
  doc.fillColor(TEXT);
  doc.moveDown(0.85);
}

export interface FullPdfPatient {
  id: number;
  name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  ageYears: number | null;
  birthDate: Date | string | null;
  currentWeight: string;
  isSterilized: boolean;
  microchipCode: string;
  generalAllergies: string;
  generalHistory: string;
}

export interface FullPdfTutor {
  fullName: string;
  documentId: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
}

export interface FullPdfCondition {
  name: string;
  type: string;
  active: boolean;
}

export interface FullPdfVaccinationDose {
  doseOrder: number;
  vaccineName: string;
  status: string;
  expectedDate: string | null;
  appliedAt: string | null;
}

export interface FullPdfVaccinationPlan {
  schemeName: string;
  schemeVersion: number;
  status: string;
  doses: FullPdfVaccinationDose[];
}

export interface FullPdfTreatmentItem {
  medication: string;
  dose: string;
  frequency: string;
  durationDays: string;
  route: string;
}

export interface FullPdfTreatment {
  status: string;
  startDate: string | null;
  endDate: string | null;
  instructions: string;
  items: FullPdfTreatmentItem[];
}

export interface FullPdfVaccinationEvent {
  vaccineName: string;
  applicationDate: string | null;
  nextDate: string | null;
  notes: string;
}

export interface FullPdfDewormingEvent {
  productName: string;
  applicationDate: string | null;
  nextDate: string | null;
  notes: string;
}

export interface FullPdfSurgery {
  type: string;
  performedDate: string | null;
  status: string;
  description: string;
  postOp: string;
}

export interface FullPdfProcedure {
  type: string;
  performedDate: string | null;
  description: string;
  result: string;
}

export interface FullPdfEncounter {
  id: number;
  startTime: Date | string;
  endTime: Date | string | null;
  vetName: string;
  status: string;
  generalNotes: string;
  consultationReason: {
    reason: string;
    currentIllnessHistory: string;
    previousDiagnoses: string;
    previousTreatments: string;
  } | null;
  clinicalExam: {
    temperatureC: string;
    heartRate: string;
    pulse: string;
    respiratoryRate: string;
    weightKg: string;
    mucousMembranes: string;
    lymphNodes: string;
    hydration: string;
    crtSeconds: string;
    notes: string;
  } | null;
  anamnesis: {
    problemStart: string;
    previousSurgeries: string;
    howProblemStarted: string;
    vaccinesUpToDate: string;
    dewormingUpToDate: string;
    hasPetAtHome: string;
    medication: string;
    appetite: string;
    waterIntake: string;
    feces: string;
    vomit: string;
    bowelMovements: string;
    urine: string;
    respiratoryProblems: string;
    difficultyWalking: string;
    notes: string;
  } | null;
  environmentalData: {
    environment: string;
    nutrition: string;
    lifestyle: string;
    feedingType: string;
  } | null;
  clinicalImpression: {
    presumptiveDiagnosis: string;
    differentialDiagnosis: string;
    prognosis: string;
    clinicalNotes: string;
  } | null;
  plan: {
    clinicalPlan: string;
    followUpDate: string | null;
    planNotes: string;
  } | null;
  treatments: FullPdfTreatment[];
  vaccinations: FullPdfVaccinationEvent[];
  dewormings: FullPdfDewormingEvent[];
  surgeries: FullPdfSurgery[];
  procedures: FullPdfProcedure[];
}

export interface ClinicalHistoryFullPdfData {
  patient: FullPdfPatient;
  tutors: FullPdfTutor[];
  conditions: FullPdfCondition[];
  vaccinationPlan: FullPdfVaccinationPlan | null;
  encounters: FullPdfEncounter[];
}

@Injectable()
export class ClinicalHistoryFullPdfService {
  async render(data: ClinicalHistoryFullPdfData): Promise<Buffer> {
    const doc = createDoc();
    const chunks: Buffer[] = [];
    const patientName = textValue(data.patient.name);
    const visitLeft = doc.page.margins.left + 14;

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    drawPageHeader(doc, patientName);

    drawPrimarySectionTitle(doc, 'Paciente', patientName);
    drawGrid(
      doc,
      [
        { label: 'Nombre', value: data.patient.name },
        { label: 'Especie', value: data.patient.species },
        { label: 'Raza', value: data.patient.breed },
        { label: 'Sexo', value: data.patient.sex },
        { label: 'Color', value: data.patient.color },
        {
          label: 'Edad',
          value: data.patient.ageYears === null ? NO_DATA : `${data.patient.ageYears} anios`,
        },
        { label: 'Nacimiento', value: formatDate(data.patient.birthDate) },
        { label: 'Peso actual', value: data.patient.currentWeight },
        { label: 'Esterilizado', value: formatBool(data.patient.isSterilized) },
        { label: 'Microchip', value: data.patient.microchipCode },
      ],
      patientName,
    );
    drawParagraph(doc, 'Alergias', data.patient.generalAllergies, patientName);
    drawParagraph(doc, 'Historial general', data.patient.generalHistory, patientName);
    drawBulletList(
      doc,
      data.conditions
        .filter((condition) => condition.active)
        .map((condition) => `${condition.name} (${condition.type})`),
      patientName,
    );

    drawPrimarySectionTitle(doc, 'Tutores', patientName);
    if (data.tutors.length === 0) {
      drawEmptySection(doc, patientName);
    } else {
      data.tutors.forEach((tutor, index) => {
        drawGrid(
          doc,
          [
            {
              label: `Tutor ${index + 1}`,
              value: `${tutor.fullName}${tutor.isPrimary ? ' (principal)' : ''}`,
            },
            { label: 'Relacion', value: tutor.relationship },
            { label: 'Documento', value: tutor.documentId },
            { label: 'Telefono', value: tutor.phone },
            { label: 'Correo', value: tutor.email },
          ],
          patientName,
        );
      });
    }

    drawPrimarySectionTitle(doc, 'Historial clinico', patientName);
    if (data.encounters.length === 0) {
      drawParagraph(doc, 'Visitas', 'Este paciente no tiene visitas clinicas registradas.', patientName);
    }

    data.encounters.forEach((encounter, index) => {
      drawVisitHeader(
        doc,
        `Visita #${index + 1}`,
        `${formatDate(encounter.startTime, true)} | ${textValue(encounter.vetName)} | ${formatEncounterStatus(encounter.status)}`,
        patientName,
      );

      drawVisitSectionTitle(doc, 'Motivo de consulta', patientName, visitLeft);
      if (encounter.consultationReason) {
        drawParagraph(doc, 'Motivo', encounter.consultationReason.reason, patientName, visitLeft);
        drawParagraph(
          doc,
          'Historia de la enfermedad actual',
          encounter.consultationReason.currentIllnessHistory,
          patientName,
          visitLeft,
        );
        drawParagraph(
          doc,
          'Diagnosticos previos',
          encounter.consultationReason.previousDiagnoses,
          patientName,
          visitLeft,
        );
        drawParagraph(
          doc,
          'Tratamientos previos',
          encounter.consultationReason.previousTreatments,
          patientName,
          visitLeft,
        );
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Anamnesis', patientName, visitLeft);
      if (encounter.anamnesis) {
        drawGrid(
          doc,
          [
            { label: 'Inicio del problema', value: encounter.anamnesis.problemStart },
            { label: 'Como inicio', value: encounter.anamnesis.howProblemStarted },
            { label: 'Cirugias previas', value: encounter.anamnesis.previousSurgeries },
            { label: 'Medicacion', value: encounter.anamnesis.medication },
            { label: 'Vacunas al dia', value: encounter.anamnesis.vaccinesUpToDate },
            { label: 'Desparasitacion al dia', value: encounter.anamnesis.dewormingUpToDate },
            { label: 'Tiene mascota en casa', value: encounter.anamnesis.hasPetAtHome },
            { label: 'Apetito', value: encounter.anamnesis.appetite },
            { label: 'Consumo de agua', value: encounter.anamnesis.waterIntake },
            { label: 'Deposiciones por dia', value: encounter.anamnesis.bowelMovements },
            { label: 'Heces', value: encounter.anamnesis.feces },
            { label: 'Vomito', value: encounter.anamnesis.vomit },
            { label: 'Orina', value: encounter.anamnesis.urine },
            { label: 'Problemas respiratorios', value: encounter.anamnesis.respiratoryProblems },
            { label: 'Dificultad al caminar', value: encounter.anamnesis.difficultyWalking },
          ],
          patientName,
          visitLeft,
        );
        drawParagraph(doc, 'Notas', encounter.anamnesis.notes, patientName, visitLeft);
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Examen clinico', patientName, visitLeft);
      if (encounter.clinicalExam) {
        drawGrid(
          doc,
          [
            {
              label: 'Temperatura',
              value: maybeText(encounter.clinicalExam.temperatureC)
                ? `${encounter.clinicalExam.temperatureC} C`
                : NO_DATA,
            },
            {
              label: 'Frecuencia cardiaca',
              value: maybeText(encounter.clinicalExam.heartRate)
                ? `${encounter.clinicalExam.heartRate} lpm`
                : NO_DATA,
            },
            {
              label: 'Pulso',
              value: maybeText(encounter.clinicalExam.pulse)
                ? `${encounter.clinicalExam.pulse} lpm`
                : NO_DATA,
            },
            {
              label: 'Frecuencia respiratoria',
              value: maybeText(encounter.clinicalExam.respiratoryRate)
                ? `${encounter.clinicalExam.respiratoryRate} rpm`
                : NO_DATA,
            },
            {
              label: 'Peso',
              value: maybeText(encounter.clinicalExam.weightKg)
                ? `${encounter.clinicalExam.weightKg} kg`
                : NO_DATA,
            },
            {
              label: 'TLLC',
              value: maybeText(encounter.clinicalExam.crtSeconds)
                ? `${encounter.clinicalExam.crtSeconds} s`
                : NO_DATA,
            },
            { label: 'Membranas mucosas', value: encounter.clinicalExam.mucousMembranes },
            { label: 'Ganglios linfaticos', value: encounter.clinicalExam.lymphNodes },
            { label: 'Hidratacion', value: encounter.clinicalExam.hydration },
          ],
          patientName,
          visitLeft,
        );
        drawParagraph(doc, 'Notas', encounter.clinicalExam.notes, patientName, visitLeft);
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Impresion clinica', patientName, visitLeft);
      if (encounter.clinicalImpression) {
        drawParagraph(
          doc,
          'Diagnostico presuntivo',
          encounter.clinicalImpression.presumptiveDiagnosis,
          patientName,
          visitLeft,
        );
        drawParagraph(
          doc,
          'Diagnostico diferencial',
          encounter.clinicalImpression.differentialDiagnosis,
          patientName,
          visitLeft,
        );
        drawParagraph(
          doc,
          'Pronostico',
          encounter.clinicalImpression.prognosis,
          patientName,
          visitLeft,
        );
        drawParagraph(
          doc,
          'Notas clinicas',
          encounter.clinicalImpression.clinicalNotes,
          patientName,
          visitLeft,
        );
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Plan', patientName, visitLeft);
      if (encounter.plan) {
        drawParagraph(doc, 'Plan clinico', encounter.plan.clinicalPlan, patientName, visitLeft);
        drawGrid(
          doc,
          [{ label: 'Fecha de seguimiento', value: formatDate(encounter.plan.followUpDate) }],
          patientName,
          visitLeft,
          1,
        );
        drawParagraph(doc, 'Notas del plan', encounter.plan.planNotes, patientName, visitLeft);
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Tratamientos', patientName, visitLeft);
      if (encounter.treatments.length > 0) {
        encounter.treatments.forEach((treatment, treatmentIndex) => {
          drawGrid(
            doc,
            [
              { label: `Tratamiento ${treatmentIndex + 1}`, value: treatment.status },
              { label: 'Inicio', value: formatDate(treatment.startDate) },
              { label: 'Fin', value: formatDate(treatment.endDate) },
            ],
            patientName,
            visitLeft,
          );
          drawParagraph(doc, 'Instrucciones', treatment.instructions, patientName, visitLeft);
          drawBulletList(
            doc,
            treatment.items.map(
              (item) =>
                `${textValue(item.medication)} | Dosis: ${textValue(item.dose)} | Frecuencia: ${textValue(item.frequency)} | Duracion: ${textValue(item.durationDays)} | Via: ${textValue(item.route)}`,
            ),
            patientName,
            visitLeft,
          );
        });
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      drawVisitSectionTitle(doc, 'Cirugias', patientName, visitLeft);
      if (encounter.surgeries.length > 0) {
        encounter.surgeries.forEach((surgery, surgeryIndex) => {
          drawGrid(
            doc,
            [
              { label: `Cirugia ${surgeryIndex + 1}`, value: surgery.type },
              { label: 'Estado', value: surgery.status },
              { label: 'Fecha realizada', value: formatDate(surgery.performedDate) },
            ],
            patientName,
            visitLeft,
          );
          drawParagraph(doc, 'Descripcion', surgery.description, patientName, visitLeft);
          drawParagraph(doc, 'Cuidados postoperatorios', surgery.postOp, patientName, visitLeft);
        });
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      if (encounter.procedures.length > 0) {
        drawVisitSectionTitle(doc, 'Procedimientos', patientName, visitLeft);
        encounter.procedures.forEach((procedure, procedureIndex) => {
          drawGrid(
            doc,
            [
              { label: `Procedimiento ${procedureIndex + 1}`, value: procedure.type },
              { label: 'Fecha', value: formatDate(procedure.performedDate) },
            ],
            patientName,
            visitLeft,
          );
          drawParagraph(doc, 'Descripcion', procedure.description, patientName, visitLeft);
          drawParagraph(doc, 'Resultado', procedure.result, patientName, visitLeft);
        });
      }

      if (encounter.vaccinations.length > 0) {
        drawVisitSectionTitle(doc, 'Vacunaciones', patientName, visitLeft);
        drawBulletList(
          doc,
          encounter.vaccinations.map(
            (item) =>
              `${textValue(item.vaccineName)} | Aplicada: ${formatDate(item.applicationDate)} | Proxima: ${formatDate(item.nextDate)} | ${textValue(item.notes)}`,
          ),
          patientName,
          visitLeft,
        );
      }

      if (encounter.dewormings.length > 0) {
        drawVisitSectionTitle(doc, 'Desparasitaciones', patientName, visitLeft);
        drawBulletList(
          doc,
          encounter.dewormings.map(
            (item) =>
              `${textValue(item.productName)} | Aplicada: ${formatDate(item.applicationDate)} | Proxima: ${formatDate(item.nextDate)} | ${textValue(item.notes)}`,
          ),
          patientName,
          visitLeft,
        );
      }

      if (encounter.environmentalData) {
        drawVisitSectionTitle(doc, 'Datos ambientales', patientName, visitLeft);
        drawGrid(
          doc,
          [
            { label: 'Entorno', value: encounter.environmentalData.environment },
            { label: 'Nutricion', value: encounter.environmentalData.nutrition },
            { label: 'Estilo de vida', value: encounter.environmentalData.lifestyle },
            { label: 'Tipo de alimentacion', value: encounter.environmentalData.feedingType },
          ],
          patientName,
          visitLeft,
        );
      }

      drawVisitSectionTitle(doc, 'Notas', patientName, visitLeft);
      if (maybeText(encounter.generalNotes)) {
        drawParagraph(doc, 'Notas generales', encounter.generalNotes, patientName, visitLeft);
      } else {
        drawEmptySection(doc, patientName, visitLeft);
      }

      doc.moveDown(0.9);
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
