import type {
  AnamnesisResponseDto,
  ClinicalExamResponseDto,
  ClinicalImpressionResponseDto,
  ConsultationReasonResponseDto,
  DewormingEventResponseDto,
  EnvironmentalDataResponseDto,
  PlanResponseDto,
  ProcedureResponseDto,
  SurgeryResponseDto,
  TreatmentResponseDto,
  VaccinationEventResponseDto,
} from '../encounters/encounter-response.dto.js';
import type { PatientAdminBasicDetailResponse } from './patient-basic-response.dto.js';

export type ClinicalHistoryEncounterItem = {
  id: number;
  startTime: string;
  endTime: string | null;
  status: string;
  generalNotes: string | null;
  vetName: string | null;
  consultationReason: ConsultationReasonResponseDto | null;
  anamnesis: AnamnesisResponseDto | null;
  clinicalExam: ClinicalExamResponseDto | null;
  environmentalData: EnvironmentalDataResponseDto | null;
  clinicalImpression: ClinicalImpressionResponseDto | null;
  plan: PlanResponseDto | null;
  vaccinationEvents: VaccinationEventResponseDto[];
  dewormingEvents: DewormingEventResponseDto[];
  treatments: TreatmentResponseDto[];
  surgeries: SurgeryResponseDto[];
  procedures: ProcedureResponseDto[];
};

export type ClinicalHistoryVaccinationDose = {
  doseOrder: number;
  vaccineName: string | null;
  status: string;
  expectedDate: string | null;
  appliedAt: string | null;
};

export type ClinicalHistoryVaccinationPlan = {
  status: string;
  schemeName: string;
  schemeVersion: number;
  notes: string | null;
  doses: ClinicalHistoryVaccinationDose[];
};

export type PatientClinicalHistoryResponse = {
  patient: PatientAdminBasicDetailResponse;
  encounters: ClinicalHistoryEncounterItem[];
  vaccinationPlan: ClinicalHistoryVaccinationPlan | null;
};
