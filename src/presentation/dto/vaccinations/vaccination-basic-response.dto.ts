export type PaginatedVaccinationsBasicResponse = {
  data: VaccinationBasicResponse[];
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

export type VaccinationBasicResponse = {
  id: number;
  vaccineName: string;
  applicationDate: string;
  nextDoseDate: string | null;
  isExternal: boolean;
  notes: string | null;
  patientId: number;
  patientName: string;
  encounterId: number | null;
};