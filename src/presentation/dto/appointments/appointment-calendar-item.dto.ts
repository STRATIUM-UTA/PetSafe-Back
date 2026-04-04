/** Lo que devuelve GET /appointments y POST /appointments.
 *  El front espera exactamente estos campos para armar el calendario.
 */
export class AppointmentCalendarItemDto {
  id!: number;
  patientId!: number;
  vetId!: number;
  patientName!: string | null;
  ownerName!: string | null;
  scheduledDate!: string;   // YYYY-MM-DD
  startsAt!: string;        // HH:MM
  endsAt!: string | null;   // HH:MM  (persistido en appointments.end_time)
  reason!: string | null;
  notes!: string | null;
  status!: string;
  hasQueueEntry!: boolean;
  queueEntryId!: number | null;
  queueStatus!: string | null;
  isActive!: boolean;
}
