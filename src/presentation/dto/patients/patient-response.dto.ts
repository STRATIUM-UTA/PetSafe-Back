import { PatientImageResponseDto } from './patient-image.dto.js';

export class PaginatedPatientsResponseDto {
  data!: PatientResponseDto[];
  meta!: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class PatientResponseDto {
  id!: number;
  code!: string;
  qrToken!: string | null;
  name!: string;
  sex!: string;
  birthDate?: Date | null;
  currentWeight?: number | null;
  sterilized!: boolean;
  microchipCode?: string | null;
  distinguishingMarks?: string | null;
  generalAllergies?: string | null;
  generalHistory?: string | null;
  species?: { id: number; name: string; zootecnicalGroupId?: number | null } | null;
  breed?: { id: number; name: string; speciesId?: number | null } | null;
  color?: { id: number; name: string } | null;
  image!: PatientImageResponseDto | null;
  tutors!: PatientTutorResponseDto[];
  conditions!: PatientConditionResponseDto[];
}

export class PatientConditionResponseDto {
  id!: number;
  type!: string;
  name!: string;
  description?: string | null;
  active!: boolean;
}

export class PatientTutorResponseDto {
  clientId!: number;
  personId!: number;
  firstName!: string;
  lastName!: string;
  fullName!: string;
  documentId!: string;
  phone!: string | null;
  relationship!: string | null;
  isPrimary!: boolean;
}
