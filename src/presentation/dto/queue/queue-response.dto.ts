/** Paciente resumido para la cola */
import { PatientImageResponseDto } from '../patients/patient-image.dto.js';

export class QueuePatientDto {
  id!: number;
  name!: string;
  species!: string;
  breed!: string;
  tutorName!: string;
  tutorPhone!: string | null;
  image!: PatientImageResponseDto | null;
}

/** Veterinario resumido para la cola */
export class QueueVeterinarianDto {
  id!: number;
  name!: string;
  code!: string | null;
}

/** Resumen mínimo de la consulta ligada a la entrada operativa */
export class QueueEncounterSummaryDto {
  id!: number;
  status!: string;
  canReactivate!: boolean;
  reactivationGraceEndsAt!: string | null;
}

/** Una entrada en la cola de atención */
export class QueueEntryRecordDto {
  id!: number;
  date!: string;
  appointmentId!: number | null;
  patient!: QueuePatientDto;
  veterinarian!: QueueVeterinarianDto;
  entryType!: string;
  arrivalTime!: string;           // HH:MM
  scheduledTime!: string | null;  // HH:MM
  queueStatus!: string;
  notes!: string | null;
  encounter!: QueueEncounterSummaryDto | null;
  waitMinutes!: number;
  createdAt!: string;
  updatedAt!: string;
}

/** Resumen de la cola del día */
export class QueueSummaryDto {
  totalEntries!: number;
  waitingEntries!: number;
  inAttentionEntries!: number;
  finishedEntries!: number;
  emergencyEntries!: number;
  averageWaitMinutes!: number;
  currentAttentionEntry!: QueueEntryRecordDto | null;
  nextUpEntry!: QueueEntryRecordDto | null;
}

/** PaginationMeta */
export class QueuePaginationMetaDto {
  totalItems!: number;
  itemCount!: number;
  itemsPerPage!: number;
  totalPages!: number;
  currentPage!: number;
  hasNextPage!: boolean;
  hasPrevPage!: boolean;
}

/** Respuesta de GET /queue */
export class QueueListResponseDto {
  data!: QueueEntryRecordDto[];
  meta!: QueuePaginationMetaDto;
  summary!: QueueSummaryDto;
}
