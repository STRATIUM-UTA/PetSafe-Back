import {
  PatientConditionResponseDto,
  PatientTutorResponseDto,
} from './patient-response.dto.js';
import { PatientImageResponseDto } from './patient-image.dto.js';
import { ClinicalCaseSummaryDto } from '../clinical-cases/clinical-case-response.dto.js';

export type PatientSurgeryResponseDto = {
  id: number;
  encounterId: number | null;
  catalogId: number | null;
  surgeryType: string;
  scheduledDate: string | null;
  performedDate: string | null;
  surgeryStatus: string;
  isExternal: boolean;
  description: string | null;
  postoperativeInstructions: string | null;
};

export type PatientBasicByClientResponse = {
  id: number;
  name: string;
  birthDate: Date | null;
  species: {
    id: number;
    name: string;
  } | null;
  breed: {
    id: number;
    name: string;
  } | null;
  color: {
    id: number;
    name: string;
  } | null;
  image: PatientImageResponseDto | null;
};

export type PaginatedPatientsBasicForAdminResponse = {
  data: PatientAdminBasicResponse[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type PatientAdminBasicResponse = {
  id: number;
  name: string;
  species: {
    id: number;
    name: string;
  } | null;
  breed: {
    id: number;
    name: string;
  } | null;
  tutorName: string | null;
  tutorContact: string | null;
  birthDate: Date | null;
  ageYears: number | null;
  sex: string;
  currentWeight: number | null;
  image: PatientImageResponseDto | null;
};

export type PatientAdminBasicDetailResponse = {
  id: number;
  name: string;
  qrToken: string | null;
  species: {
    id: number;
    name: string;
  } | null;
  breed: {
    id: number;
    name: string;
  } | null;
  sex: string;
  currentWeight: number | null;
  birthDate: Date | null;
  ageYears: number | null;
  color: {
    id: number;
    name: string;
  } | null;
  sterilized: boolean;
  generalAllergies: string | null;
  generalHistory: string | null;
  image: PatientImageResponseDto | null;
  tutors: PatientTutorResponseDto[];
  clinicalObservations: PatientConditionResponseDto[];
  surgeries: PatientSurgeryResponseDto[];
  activeTreatments: PatientActiveTreatmentResponse[];
  treatments: PatientTreatmentHistoryResponse[];
  procedures: PatientProcedureHistoryResponse[];
  clinicalCases: ClinicalCaseSummaryDto[];
  recentActivity: PatientRecentActivityResponse;
};

export type PatientRecentConsultationActivityResponse = {
  id: number;
  patientConsultationNumber: number;
  clinicalCaseId: number | null;
  startTime: string;
  status: string;
  clinicianName: string | null;
  consultationReason: string | null;
};

export type PatientRecentProcedureActivityResponse = {
  id: number;
  encounterId: number;
  patientConsultationNumber: number;
  procedureType: string;
  performedDate: string;
  clinicianName: string | null;
};

export type PatientProcedureHistoryResponse = {
  id: number;
  encounterId: number;
  patientConsultationNumber: number;
  procedureType: string;
  performedDate: string;
  clinicianName: string | null;
  description: string | null;
  result: string | null;
  notes: string | null;
};

export type PatientActiveTreatmentResponse = {
  id: number;
  encounterId: number;
  clinicalCaseId: number | null;
  clinicalCaseProblem: string | null;
  status: string;
  summary: string;
  startDate: string;
  endDate: string | null;
  generalInstructions: string | null;
};

export type PatientTreatmentHistoryResponse = {
  id: number;
  encounterId: number;
  patientConsultationNumber: number;
  clinicalCaseId: number | null;
  clinicalCaseProblem: string | null;
  status: string;
  summary: string;
  startDate: string;
  endDate: string | null;
  generalInstructions: string | null;
};

export type PatientRecentSurgeryActivityResponse = {
  id: number;
  encounterId: number | null;
  surgeryType: string;
  activityDate: string;
  surgeryStatus: string;
  clinicianName: string | null;
  isExternal: boolean;
};

export type PatientRecentActivityResponse = {
  windowStart: string;
  windowEnd: string;
  consultations: PatientRecentConsultationActivityResponse[];
  procedures: PatientRecentProcedureActivityResponse[];
  surgeries: PatientRecentSurgeryActivityResponse[];
  recentActivity: null;
};
