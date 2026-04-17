import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { VaccinationSchemeVersionStatusEnum } from '../../../domain/enums/index.js';

export class UpdateVaccinationSchemeVersionStatusDto {
  @IsEnum(VaccinationSchemeVersionStatusEnum, { message: 'status no es válido.' })
  status!: VaccinationSchemeVersionStatusEnum;

  @IsOptional()
  @IsDateString({}, { message: 'validFrom debe ser una fecha válida (YYYY-MM-DD).' })
  validFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'validTo debe ser una fecha válida (YYYY-MM-DD).' })
  validTo?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}
