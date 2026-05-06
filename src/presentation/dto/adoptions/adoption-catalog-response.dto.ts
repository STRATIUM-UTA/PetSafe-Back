import { PatientImageResponseDto } from '../patients/patient-image.dto.js';

export type AdoptionCatalogResponse = {
  id: number;
  patientId: number;
  image: PatientImageResponseDto | null;
  petName: string;
  speciesName: string | null;
  breedName: string | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  story: string | null;
  requirements: string | null;
  tags: {
    id: number;
    name: string;
  }[];
};

export type PaginatedAdoptionCatalogResponse = {
  data: AdoptionCatalogResponse[];
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
