import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PatientVaccinationPlanDoseStatusEnum } from '../../../domain/enums/index.js';

export class UpdatePatientVaccinationPlanDoseDto {
  @IsEnum(PatientVaccinationPlanDoseStatusEnum, { message: 'status no es válido.' })
  status!: PatientVaccinationPlanDoseStatusEnum;

  @IsOptional()
  @IsString()
  notes?: string;
}
