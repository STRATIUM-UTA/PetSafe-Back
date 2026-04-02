import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';

// ── Paleta de colores corporativa ──────────────────────────────────────────
const BRAND_TEAL = '#0d9488';
const BRAND_TEAL_LIGHT = '#f0fdfa';
const DARK = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const WHITE = '#ffffff';
const HEADING_BG = '#134e4a';

// ── Helpers de fecha ───────────────────────────────────────────────────────
function fmtDate(raw: string | Date | null | undefined, includeTime = false): string {
  if (!raw) return '—';
  const d = raw instanceof Date ? raw : new Date(String(raw).replace('T', ' ').substring(0, 19));
  if (isNaN(d.getTime())) return String(raw).substring(0, 10);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (!includeTime) return `${day}/${month}/${year}`;

  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

function fmtTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  return String(raw).substring(0, 5);
}

// ── Builder de PDF reutilizable ─────────────────────────────────────────────
function createDoc(): typeof PDFDocument extends new (...args: any[]) => infer R ? R : never {
  return new (PDFDocument as any)({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 44, right: 44 },
  });
}

function drawHeader(doc: any, title: string, subtitle: string): void {
  // Banda superior de color
  doc.rect(0, 0, doc.page.width, 68).fill(HEADING_BG);

  // Logo / nombre sistema
  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('PetSafe', 44, 16);

  doc
    .fillColor('#5eead4')
    .font('Helvetica')
    .fontSize(9)
    .text('Sistema de Gestión Veterinaria', 44, 38);

  // Título del reporte (derecha)
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

  // Línea separadora
  doc.moveDown(0.5);
  const y = 78;
  doc.moveTo(44, y).lineTo(doc.page.width - 44, y).strokeColor(BRAND_TEAL).lineWidth(1.5).stroke();
  doc.y = y + 10;
}

function drawFooter(doc: any): void {
  const now = fmtDate(new Date(), true);
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Generado: ${now}  ·  PetSafe — Sistema de Gestión Veterinaria`,
      44,
      doc.page.height - 30,
      { align: 'center', width: doc.page.width - 88 },
    );
}

function drawSectionTitle(doc: any, text: string): void {
  doc.moveDown(0.6);
  doc
    .rect(44, doc.y, doc.page.width - 88, 18)
    .fill(BRAND_TEAL_LIGHT);
  doc
    .fillColor(BRAND_TEAL)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(text, 50, doc.y - 14);
  doc.moveDown(0.4);
}

function drawKpiRow(doc: any, kpis: { label: string; value: string | number }[]): void {
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

function drawTableHeader(doc: any, cols: { label: string; width: number }[]): void {
  const startX = 44;
  const rowH = 18;
  let x = startX;
  const y = doc.y;

  // Fondo cabecera
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

function drawTableRow(
  doc: any,
  cols: { value: string; width: number }[],
  isEven: boolean,
): void {
  const startX = 44;
  const rowH = 16;
  let x = startX;
  const y = doc.y;

  if (isEven) {
    doc.rect(startX, y, doc.page.width - 88, rowH).fill('#f8fafc');
  }

  cols.forEach((col) => {
    doc
      .fillColor(DARK)
      .font('Helvetica')
      .fontSize(7.5)
      .text(col.value, x + 4, y + 3, { width: col.width - 8, ellipsis: true });
    x += col.width;
  });

  // Línea separadora
  doc
    .moveTo(startX, y + rowH)
    .lineTo(doc.page.width - 44, y + rowH)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

  doc.y = y + rowH;
}

function checkPageBreak(doc: any, neededSpace = 20): void {
  if (doc.y > doc.page.height - 80) {
    doc.addPage();
    doc.y = 50;
    drawFooter(doc);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PROGRAMADA: 'Programada',
    CONFIRMADA: 'Confirmada',
    EN_PROCESO: 'En proceso',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
    NO_ASISTIO: 'No asistió',
    EN_ESPERA: 'En espera',
    EN_ATENCION: 'En atención',
  };
  return map[status] ?? status;
}

function entryTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CON_CITA: 'Con cita',
    SIN_CITA: 'Sin cita',
    EMERGENCIA: 'Emergencia',
  };
  return map[type] ?? type;
}

// ── Servicio ───────────────────────────────────────────────────────────────
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // REPORTE 1: Agenda de Citas por rango de fechas
  // ────────────────────────────────────────────────────────────────────────
  async generateAppointmentsPdf(from: string, to: string): Promise<Buffer> {
    const appointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.patient', 'patient')
      .innerJoinAndSelect('a.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .leftJoinAndSelect('patient.tutors', 'tutor', 'tutor.is_primary = true AND tutor.deleted_at IS NULL')
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .where('a.scheduled_date >= :from', { from })
      .andWhere('a.scheduled_date <= :to', { to })
      .andWhere('a.deleted_at IS NULL')
      .orderBy('a.scheduled_date', 'ASC')
      .addOrderBy('a.scheduled_time', 'ASC')
      .getMany();

    const doc = createDoc();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // KPIs rápidos
    const total = appointments.length;
    const programadas = appointments.filter((a) => a.status === 'PROGRAMADA').length;
    const finalizadas = appointments.filter((a) => a.status === 'FINALIZADA').length;
    const canceladas = appointments.filter((a) => a.status === 'CANCELADA').length;

    // ── Encabezado ──
    drawHeader(
      doc,
      'Agenda de Citas',
      `Período: ${fmtDate(from)} — ${fmtDate(to)}`,
    );

    // ── KPIs ──
    drawSectionTitle(doc, 'Resumen del período');
    drawKpiRow(doc, [
      { label: 'Total citas', value: total },
      { label: 'Programadas', value: programadas },
      { label: 'Finalizadas', value: finalizadas },
      { label: 'Canceladas', value: canceladas },
    ]);

    // ── Tabla ──
    drawSectionTitle(doc, 'Detalle de citas');

    const COLS = [
      { label: 'Fecha', width: 65 },
      { label: 'Horario', width: 72 },
      { label: 'Paciente', width: 90 },
      { label: 'Tutor', width: 90 },
      { label: 'Veterinario', width: 90 },
      { label: 'Motivo', width: 70 },
      { label: 'Estado', width: 56 },
    ];

    drawTableHeader(doc, COLS);

    appointments.forEach((a, idx) => {
      checkPageBreak(doc);
      const tutorPerson = a.patient?.tutors?.[0]?.client?.person;
      const vetPerson = a.veterinarian?.person;
      drawTableRow(
        doc,
        [
          { value: fmtDate(a.scheduledDate), width: 65 },
          { value: `${fmtTime(a.scheduledTime)} - ${fmtTime(a.endTime)}`, width: 72 },
          { value: a.patient?.name ?? '—', width: 90 },
          { value: tutorPerson ? `${tutorPerson.firstName} ${tutorPerson.lastName}`.trim() : '—', width: 90 },
          { value: vetPerson ? `${vetPerson.firstName} ${vetPerson.lastName}`.trim() : '—', width: 90 },
          { value: a.reason ?? '—', width: 70 },
          { value: statusLabel(a.status), width: 56 },
        ],
        idx % 2 === 0,
      );
    });

    if (appointments.length === 0) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('No se encontraron citas en el período seleccionado.', { align: 'center' });
    }

    drawFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // REPORTE 2: Cola de Atención del Día
  // ────────────────────────────────────────────────────────────────────────
  async generateQueuePdf(date: string): Promise<Buffer> {
    const entries = await this.queueRepo
      .createQueryBuilder('q')
      .innerJoinAndSelect('q.patient', 'patient')
      .leftJoinAndSelect('patient.species', 'species')
      .leftJoinAndSelect('patient.breed', 'breed')
      .leftJoinAndSelect('patient.tutors', 'tutor', 'tutor.is_primary = true AND tutor.deleted_at IS NULL')
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .innerJoinAndSelect('q.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .where('q.date = :date', { date })
      .andWhere('q.deleted_at IS NULL')
      .orderBy('q.arrival_time', 'ASC')
      .getMany();

    const doc = createDoc();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // KPIs
    const total = entries.length;
    const conCita = entries.filter((e) => e.entryType === 'CON_CITA').length;
    const sinCita = entries.filter((e) => e.entryType === 'SIN_CITA').length;
    const emergencias = entries.filter((e) => e.entryType === 'EMERGENCIA').length;
    const atendidos = entries.filter((e) => e.status === 'FINALIZADA').length;

    drawHeader(doc, 'Cola de Atención', `Fecha: ${fmtDate(date)}`);

    drawSectionTitle(doc, 'Resumen del día');
    drawKpiRow(doc, [
      { label: 'Total ingresos', value: total },
      { label: 'Con cita', value: conCita },
      { label: 'Sin cita', value: sinCita },
      { label: 'Emergencias', value: emergencias },
      { label: 'Atendidos', value: atendidos },
    ]);

    drawSectionTitle(doc, 'Detalle de ingresos');

    const COLS = [
      { label: 'Llegada', width: 52 },
      { label: 'Paciente', width: 85 },
      { label: 'Especie / Raza', width: 90 },
      { label: 'Tutor', width: 95 },
      { label: 'Veterinario', width: 95 },
      { label: 'Tipo', width: 55 },
      { label: 'Estado', width: 76 },
    ];

    drawTableHeader(doc, COLS);

    entries.forEach((e, idx) => {
      checkPageBreak(doc);
      const tutorPerson = e.patient?.tutors?.[0]?.client?.person;
      const vetPerson = e.veterinarian?.person;
      const speciesBreed = [
        e.patient?.species?.name,
        e.patient?.breed?.name,
      ].filter(Boolean).join(' / ') || '—';

      drawTableRow(
        doc,
        [
          { value: fmtTime(e.arrivalTime as unknown as string), width: 52 },
          { value: e.patient?.name ?? '—', width: 85 },
          { value: speciesBreed, width: 90 },
          { value: tutorPerson ? `${tutorPerson.firstName} ${tutorPerson.lastName}`.trim() : '—', width: 95 },
          { value: vetPerson ? `${vetPerson.firstName} ${vetPerson.lastName}`.trim() : '—', width: 95 },
          { value: entryTypeLabel(e.entryType), width: 55 },
          { value: statusLabel(e.status), width: 76 },
        ],
        idx % 2 === 0,
      );
    });

    if (entries.length === 0) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('No hay registros de cola para la fecha seleccionada.', { align: 'center' });
    }

    drawFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // REPORTE 3: Resumen Estadístico (por rango)
  // ────────────────────────────────────────────────────────────────────────
  async generateSummaryPdf(from: string, to: string): Promise<Buffer> {
    // Citas
    const appointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.scheduled_date >= :from', { from })
      .andWhere('a.scheduled_date <= :to', { to })
      .andWhere('a.deleted_at IS NULL')
      .select([
        'a.status as status',
        'COUNT(*)::int as count',
      ])
      .groupBy('a.status')
      .getRawMany<{ status: string; count: number }>();

    // Cola
    const queue = await this.queueRepo
      .createQueryBuilder('q')
      .where('q.date >= :from', { from })
      .andWhere('q.date <= :to', { to })
      .andWhere('q.deleted_at IS NULL')
      .select([
        'q.entry_type as entry_type',
        'q.status as status',
        'COUNT(*)::int as count',
      ])
      .groupBy('q.entry_type, q.status')
      .getRawMany<{ entry_type: string; status: string; count: number }>();

    // Citas por día (para barras de texto)
    const apptByDay = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.scheduled_date >= :from', { from })
      .andWhere('a.scheduled_date <= :to', { to })
      .andWhere('a.deleted_at IS NULL')
      .select([
        'a.scheduled_date::text as day',
        'COUNT(*)::int as count',
      ])
      .groupBy('a.scheduled_date')
      .orderBy('a.scheduled_date')
      .getRawMany<{ day: string; count: number }>();

    const doc = createDoc();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    drawHeader(doc, 'Resumen Estadístico', `Período: ${fmtDate(from)} — ${fmtDate(to)}`);

    // ── Sección citas ──
    drawSectionTitle(doc, 'Citas — distribución por estado');

    const totalAppts = appointments.reduce((s, r) => s + Number(r.count), 0);
    const apptKpis = [
      'PROGRAMADA', 'CONFIRMADA', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO',
    ].map((s) => ({
      label: statusLabel(s),
      value: appointments.find((r) => r.status === s)?.count ?? 0,
    }));

    drawKpiRow(doc, [{ label: 'Total citas', value: totalAppts }, ...apptKpis]);

    // Barras de distribución por estado
    drawSectionTitle(doc, 'Progreso por estado de cita');
    const maxCount = Math.max(...apptKpis.map((k) => Number(k.value)), 1);
    const barMaxW = doc.page.width - 180;

    apptKpis.forEach((kpi) => {
      const y = doc.y;
      doc
        .fillColor(DARK)
        .font('Helvetica')
        .fontSize(8)
        .text(kpi.label, 44, y, { width: 90 });

      const barW = (Number(kpi.value) / maxCount) * barMaxW;
      doc.rect(140, y + 1, barW, 9).fill(BRAND_TEAL);

      doc
        .fillColor(MUTED)
        .fontSize(8)
        .text(String(kpi.value), 148 + barW, y, { width: 50 });

      doc.y = y + 14;
    });

    // ── Sección cola ──
    drawSectionTitle(doc, 'Cola de atención — ingresos por tipo');
    const queueByType = ['CON_CITA', 'SIN_CITA', 'EMERGENCIA'].map((t) => ({
      label: entryTypeLabel(t),
      value: queue.filter((r) => r.entry_type === t).reduce((s, r) => s + Number(r.count), 0),
    }));
    const totalQueue = queueByType.reduce((s, k) => s + Number(k.value), 0);
    drawKpiRow(doc, [{ label: 'Total ingresos', value: totalQueue }, ...queueByType]);

    // ── Citas por día ──
    if (apptByDay.length > 0) {
      drawSectionTitle(doc, 'Citas por día');

      const DCOLS = [
        { label: 'Fecha', width: 100 },
        { label: 'Cantidad', width: 100 },
        { label: 'Distribución visual', width: 348 },
      ];
      drawTableHeader(doc, DCOLS);

      const maxDay = Math.max(...apptByDay.map((r) => Number(r.count)), 1);
      apptByDay.forEach((row, idx) => {
        checkPageBreak(doc);
        const y = doc.y;
        const isEven = idx % 2 === 0;

        if (isEven) doc.rect(44, y, doc.page.width - 88, 16).fill('#f8fafc');

        // Fecha
        doc.fillColor(DARK).font('Helvetica').fontSize(7.5)
          .text(fmtDate(row.day), 48, y + 3, { width: 96, ellipsis: true });

        // Cantidad
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(7.5)
          .text(String(row.count), 148, y + 3, { width: 96, align: 'center' });

        // Barra mini
        const bw = (Number(row.count) / maxDay) * 300;
        doc.rect(248, y + 4, bw, 8).fill(BRAND_TEAL);

        doc
          .moveTo(44, y + 16).lineTo(doc.page.width - 44, y + 16)
          .strokeColor(BORDER).lineWidth(0.5).stroke();

        doc.y = y + 16;
      });
    }

    drawFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
