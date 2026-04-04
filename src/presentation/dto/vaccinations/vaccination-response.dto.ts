export class VaccinationSpeciesSummaryDto {
  id!: number;
  name!: string;
}

export class VaccineCatalogItemDto {
  id!: number;
  name!: string;
  species!: VaccinationSpeciesSummaryDto;
  isRevaccination!: boolean;
  isActive!: boolean;
}

export class PatientVaccineRecordResponseDto {
  id!: number;
  vaccineId!: number;
  vaccineName!: string;
  species!: VaccinationSpeciesSummaryDto | null;
  applicationDate!: string;
  administeredByEmployeeId!: number | null;
  administeredBy!: string | null;
  administeredAt!: string | null;
  isExternal!: boolean;
  batchNumber!: string | null;
  nextDoseDate!: string | null;
  notes!: string | null;
  encounterId!: number | null;
  planDoseId!: number | null;
  createdAt!: string;
}

export class VaccinationSchemeDoseResponseDto {
  id!: number;
  doseOrder!: number;
  vaccineId!: number;
  vaccineName!: string;
  ageStartWeeks!: number | null;
  ageEndWeeks!: number | null;
  intervalDays!: number | null;
  isRequired!: boolean;
  notes!: string | null;
}

export class VaccinationSchemeVersionResponseDto {
  id!: number;
  version!: number;
  status!: string;
  validFrom!: string;
  validTo!: string | null;
  changeReason!: string | null;
  revaccinationRule!: string | null;
  generalIntervalDays!: number | null;
  doses!: VaccinationSchemeDoseResponseDto[];
}

export class VaccinationSchemeResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  species!: VaccinationSpeciesSummaryDto;
  activeVersionId!: number | null;
  versions!: VaccinationSchemeVersionResponseDto[];
}

export class PatientVaccinationPlanDoseResponseDto {
  id!: number;
  schemeDoseId!: number;
  vaccineId!: number;
  vaccineName!: string;
  doseOrder!: number;
  status!: string;
  expectedDate!: string | null;
  appliedAt!: string | null;
  applicationRecordId!: number | null;
  ageStartWeeks!: number | null;
  ageEndWeeks!: number | null;
  intervalDays!: number | null;
  isRequired!: boolean;
  notes!: string | null;
}

export class PatientVaccinationPlanCoverageDto {
  totalRequired!: number;
  applied!: number;
  unknown!: number;
  notApplied!: number;
  blocked!: number;
  requiresReview!: number;
  coveragePercent!: number;
}

export class PatientVaccinationPlanResponseDto {
  id!: number;
  patientId!: number;
  status!: string;
  assignedAt!: string;
  notes!: string | null;
  scheme!: {
    id: number;
    name: string;
    species: VaccinationSpeciesSummaryDto;
  };
  version!: VaccinationSchemeVersionResponseDto;
  doses!: PatientVaccinationPlanDoseResponseDto[];
  applications!: PatientVaccineRecordResponseDto[];
  coverage!: PatientVaccinationPlanCoverageDto;
  alerts!: string[];
}
