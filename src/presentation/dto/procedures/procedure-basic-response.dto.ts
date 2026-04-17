export type ProcedureBasicResponse = {
  id: number;
  procedureType: string;
  performedDate: string;
  patientName: string;
  encounterId: number;
};

export type PaginatedProceduresBasicResponse = {
  data: ProcedureBasicResponse[];
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
