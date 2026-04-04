import { PatientImageResponseDto } from '../patients/patient-image.dto.js';

export type AdoptionBasicDetailResponse = {
  id: number;
  patientId: number;
  story: string | null;
  requirements: string | null;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  tags: {
    id: number;
    name: string;
  }[];
  patient: {
    id: number;
    name: string;
    image: PatientImageResponseDto | null;
  };
};
