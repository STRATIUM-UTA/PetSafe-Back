export class AgendaReportItemDto {
  date!: string;
  timeLabel!: string;
  patientName!: string;
  tutorName!: string;
  veterinarianName!: string;
  detail!: string;
  status!: string;
  sourceType!: string;
  appointmentId!: number | null;
  queueEntryId!: number | null;
  hasAppointment!: boolean;
  hasQueueEntry!: boolean;
}
