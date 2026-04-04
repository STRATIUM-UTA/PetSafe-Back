import { IsEnum, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum PatientVaccinationPlanChangeModeEnum {
  CHANGE_SCHEME = 'CHANGE_SCHEME',
  REFRESH_CURRENT = 'REFRESH_CURRENT',
}

export class UpdatePatientVaccinationSchemeDto {
  @IsEnum(PatientVaccinationPlanChangeModeEnum, {
    message: 'mode debe ser CHANGE_SCHEME o REFRESH_CURRENT.',
  })
  mode!: PatientVaccinationPlanChangeModeEnum;

  @ValidateIf((o) => o.mode === PatientVaccinationPlanChangeModeEnum.CHANGE_SCHEME)
  @IsInt({ message: 'vaccinationSchemeId debe ser un entero.' })
  vaccinationSchemeId?: number | null;

  @IsOptional()
  @IsString({ message: 'notes debe ser un texto.' })
  notes?: string | null;
}
