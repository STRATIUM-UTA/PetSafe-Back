import { TreatmentItemStatusEnum, TreatmentStatusEnum } from '../../../domain/enums/index.js';

export type PaginatedTreatmentsBasicResponse = {
  data: TreatmentBasicResponse[];
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

export type TreatmentBasicResponse = {
  id: number;
  status: TreatmentStatusEnum;
  startDate: string;
  endDate: string | null;
  generalInstructions: string | null;
  patientName: string;
  encounterId: number;
};

export type TreatmentDetailResponse = {
  id: number;
  status: TreatmentStatusEnum;
  startDate: string;
  endDate: string | null;
  generalInstructions: string | null;
  patientId: number;
  patientName: string;
  encounterId: number;
  items: TreatmentDetailItemResponse[];
};

export type UpdateTreatmentResponse = {
  id: number;
  endDate?: string | null;
  generalInstructions?: string | null;
};

export type TreatmentDetailItemResponse = {
  id: number;
  medication: string;
  dose: string;
  frequency: string;
  durationDays: number;
  administrationRoute: string;
  notes: string | null;
  status: TreatmentItemStatusEnum;
};

export type CreateTreatmentItemResponse = {
  id: number;
  medication: string;
  dose: string;
  frequency: string;
  durationDays: number;
  administrationRoute: string;
  notes: string | null;
  status: TreatmentItemStatusEnum;
};