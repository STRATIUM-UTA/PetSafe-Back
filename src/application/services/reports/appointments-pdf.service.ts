import { Injectable } from '@nestjs/common';
import {
  checkPageBreak,
  createDoc,
  drawFooter,
  drawHeader,
  drawSectionTitle,
  drawTableHeader,
  drawTableRow,
  fmtDate,
  fmtTime,
} from './report-pdf.utils.js';

export interface AppointmentPdfRow {
  date: string | Date;
  timeLabel: string;
  patientName: string;
  tutorName: string;
  veterinarianName: string;
  detail: string;
  status: string;
  sourceType: string;
  hasAppointment: boolean;
  hasQueueEntry: boolean;
}

export interface AppointmentsPdfPayload {
  from: string;
  to: string;
  appointments: AppointmentPdfRow[];
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PROGRAMADA: 'Programada',
    CONFIRMADA: 'Confirmada',
    EN_PROCESO: 'En proceso',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
    NO_ASISTIO: 'No asistio',
    EN_ESPERA: 'En espera',
    EN_ATENCION: 'En atencion',
  };
  return map[status] ?? status;
}

@Injectable()
export class AppointmentsPdfService {
  async render(data: AppointmentsPdfPayload): Promise<Buffer> {
    const doc = createDoc('landscape');
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    drawHeader(doc, 'Agenda Operativa', `Periodo: ${fmtDate(data.from)} - ${fmtDate(data.to)}`);
    drawSectionTitle(doc, 'Detalle de agenda');
    const columns = [
      { label: 'Fecha', width: 72 },
      { label: 'Horario', width: 92 },
      { label: 'Paciente', width: 86 },
      { label: 'Tutor', width: 110 },
      { label: 'Veterinario', width: 110 },
      { label: 'Detalle', width: 180 },
      { label: 'Estado', width: 60 },
    ];
    drawTableHeader(doc, columns);

    data.appointments.forEach((appointment, index) => {
      const rowValues = [
        { value: fmtDate(appointment.date), width: 72 },
        { value: appointment.timeLabel || `${fmtTime(null)} - ${fmtTime(null)}`, width: 92 },
        { value: appointment.patientName, width: 86 },
        { value: appointment.tutorName, width: 110 },
        { value: appointment.veterinarianName, width: 110 },
        { value: appointment.detail, width: 180 },
        { value: statusLabel(appointment.status), width: 60 },
      ];
      const estimatedHeight =
        Math.max(
          ...rowValues.map((col) =>
            doc.heightOfString(col.value, {
              width: col.width - 8,
              align: 'left',
            }),
          ),
        ) + 10;

      if (checkPageBreak(doc, estimatedHeight + 8)) {
        drawTableHeader(doc, columns);
      }

      drawTableRow(
        doc,
        rowValues,
        index % 2 === 0,
      );
    });

    if (data.appointments.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .text('No se encontraron registros de agenda en el periodo seleccionado.', { align: 'center' });
    }

    drawFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
