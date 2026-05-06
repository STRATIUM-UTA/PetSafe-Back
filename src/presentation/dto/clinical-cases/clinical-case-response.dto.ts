import {
  ClinicalCaseFollowUpStatusEnum,
  ClinicalCaseStatusEnum,
  TreatmentEvolutionEventTypeEnum,
  TreatmentStatusEnum,
} from '../../../domain/enums/index.js';

export class ClinicalCaseActiveTreatmentDto {
  id!: number;
  encounterId!: number;
  status!: TreatmentStatusEnum;
  summary!: string;
  startDate!: string;
  endDate!: string | null;
}

export class ClinicalCaseLastEvolutionDto {
  id!: number;
  encounterId!: number;
  treatmentId!: number;
  treatmentSummary!: string;
  eventType!: TreatmentEvolutionEventTypeEnum;
  notes!: string | null;
  replacementTreatmentId!: number | null;
  replacementTreatmentSummary!: string | null;
  createdAt!: string;
}

export class ClinicalCaseNextFollowUpDto {
  id!: number;
  sourceEncounterId!: number;
  targetEncounterId!: number | null;
  suggestedDate!: string;
  status!: ClinicalCaseFollowUpStatusEnum;
  appointmentId!: number | null;
  appointmentScheduledDate!: string | null;
  appointmentScheduledTime!: string | null;
  appointmentEndTime!: string | null;
  appointmentStatus!: string | null;
}

export class ClinicalCaseConsultationSummaryDto {
  id!: number;
  patientConsultationNumber!: number;
  startTime!: string;
  status!: string;
  consultationReason!: string | null;
  clinicianName!: string | null;
}

export class ClinicalCaseSummaryDto {
  id!: number;
  patientId!: number;
  originEncounterId!: number;
  status!: ClinicalCaseStatusEnum;
  problemSummary!: string;
  openedAt!: string;
  closedAt!: string | null;
  canceledAt!: string | null;
  latestImpression!: string | null;
  nextFollowUp!: ClinicalCaseNextFollowUpDto | null;
  lastEvolution!: ClinicalCaseLastEvolutionDto | null;
  activeTreatments!: ClinicalCaseActiveTreatmentDto[];
  consultationsCount!: number;
}

export class ClinicalCaseFollowUpDetailDto extends ClinicalCaseNextFollowUpDto {}

export class ClinicalCaseDetailDto extends ClinicalCaseSummaryDto {
  consultations!: ClinicalCaseConsultationSummaryDto[];
  followUps!: ClinicalCaseFollowUpDetailDto[];
}
