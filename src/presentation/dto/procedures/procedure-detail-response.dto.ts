export type ProcedureDetailResponse = {
  id: number;
  procedureType: string;
  performedDate: string;
  description: string | null;
  result: string | null;
  notes: string | null;
  catalog: { id: number; name: string } | null;
  patientId: number;
  patientName: string;
  encounterId: number;
};
