import { AdoptionStatusEnum } from '../../../domain/enums/index.js';

export type AdoptionBasicResponse = {
  id: number;
  patientId: number;
  patientName: string;
  speciesName: string | null;
  breedName: string | null;
  currentWeight: number | null;
  birthDate: Date | null;
  ageYears: number | null;
  adopterClientId: number | null;
  status: AdoptionStatusEnum;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  tags: {
    id: number;
    name: string;
  }[];
};

export type PaginatedAdoptionBasicResponse = {
  data: AdoptionBasicResponse[];
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
