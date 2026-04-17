import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VaccinationSchemeVersionStatusEnum } from '../../../domain/enums/index.js';

export class CreateVaccinationSchemeVersionDoseDto {
  @IsInt({ message: 'vaccineId debe ser un entero.' })
  vaccineId!: number;

  @IsInt({ message: 'doseOrder debe ser un entero.' })
  @Min(1, { message: 'doseOrder debe ser al menos 1.' })
  doseOrder!: number;

  @IsOptional()
  @IsInt({ message: 'ageStartWeeks debe ser un entero.' })
  @Min(0, { message: 'ageStartWeeks no puede ser negativo.' })
  ageStartWeeks?: number;

  @IsOptional()
  @IsInt({ message: 'ageEndWeeks debe ser un entero.' })
  @Min(0, { message: 'ageEndWeeks no puede ser negativo.' })
  ageEndWeeks?: number;

  @IsOptional()
  @IsInt({ message: 'intervalDays debe ser un entero.' })
  @Min(0, { message: 'intervalDays no puede ser negativo.' })
  intervalDays?: number;

  @IsOptional()
  @IsBoolean({ message: 'isRequired debe ser verdadero o falso.' })
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateVaccinationSchemeVersionDto {
  @IsInt({ message: 'version debe ser un entero.' })
  @Min(1, { message: 'version debe ser al menos 1.' })
  version!: number;

  @IsOptional()
  @IsEnum(VaccinationSchemeVersionStatusEnum, { message: 'status no es válido.' })
  status?: VaccinationSchemeVersionStatusEnum;

  @IsDateString({}, { message: 'validFrom debe ser una fecha válida (YYYY-MM-DD).' })
  validFrom!: string;

  @IsOptional()
  @IsDateString({}, { message: 'validTo debe ser una fecha válida (YYYY-MM-DD).' })
  validTo?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'revaccinationRule no puede superar 120 caracteres.' })
  revaccinationRule?: string;

  @IsOptional()
  @IsInt({ message: 'generalIntervalDays debe ser un entero.' })
  @Min(0, { message: 'generalIntervalDays no puede ser negativo.' })
  generalIntervalDays?: number;

  @IsArray({ message: 'doses debe ser un arreglo.' })
  @ArrayMinSize(1, { message: 'Debe existir al menos una dosis en la versión.' })
  @ValidateNested({ each: true })
  @Type(() => CreateVaccinationSchemeVersionDoseDto)
  doses!: CreateVaccinationSchemeVersionDoseDto[];
}
