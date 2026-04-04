import { IsInt, IsOptional } from 'class-validator';

export class InitializePatientVaccinationPlanDto {
  @IsOptional()
  @IsInt({ message: 'El esquema vacunal proporcionado no es válido.' })
  vaccinationSchemeId?: number;
}
