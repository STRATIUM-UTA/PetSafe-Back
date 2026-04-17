import {
  PatientConditionResponseDto,
  PatientSurgeryResponseDto,
  PatientTutorResponseDto,
} from './patient-response.dto.js';
import { PatientImageResponseDto } from './patient-image.dto.js';

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
  procedures: PatientProcedureHistoryResponse[];
  recentActivity: PatientRecentActivityResponse;
};

export type PatientRecentConsultationActivityResponse = {
  id: number;
  patientConsultationNumber: number;
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
};
