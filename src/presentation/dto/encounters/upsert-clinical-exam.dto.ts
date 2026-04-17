import {
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MAX,
  ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MIN,
} from '../../../domain/constants/encounter-clinical-exam.constants.js';
import { MucosaStatusEnum, HydrationStatusEnum } from '../../../domain/enums/index.js';
import {
  normalizeHydrationStatusEnum,
  normalizeMucosaStatusEnum,
} from './encounter-clinical-enum-normalizer.util.js';

export class UpsertClinicalExamDto {
  @IsOptional()
  @IsNumber({}, { message: 'El peso debe ser un número válido (ej. 12.5).' })
  @Min(0.01, { message: 'El peso debe ser mayor a cero.' })
  weightKg?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La temperatura debe ser un número válido (ej. 38.5).' })
  @Min(ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MIN, {
    message: `La temperatura debe estar entre ${ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MIN} y ${ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MAX} °C.`,
  })
  @Max(ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MAX, {
    message: `La temperatura debe estar entre ${ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MIN} y ${ENCOUNTER_CLINICAL_EXAM_TEMPERATURE_MAX} °C.`,
  })
  temperatureC?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El pulso no puede ser negativo.' })
  pulse?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'La frecuencia cardíaca no puede ser negativa.' })
  heartRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'La frecuencia respiratoria no puede ser negativa.' })
  respiratoryRate?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeMucosaStatusEnum(value))
  @IsEnum(MucosaStatusEnum, { message: 'El estado de mucosas no es válido. Valores permitidos: ' + Object.values(MucosaStatusEnum).join(', ') })
  mucousMembranes?: MucosaStatusEnum;

  @IsOptional()
  @IsString({ message: 'El estado de ganglios debe ser texto.' })
  lymphNodes?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeHydrationStatusEnum(value))
  @IsEnum(HydrationStatusEnum, { message: 'El estado de hidratación no es válido. Valores permitidos: ' + Object.values(HydrationStatusEnum).join(', ') })
  hydration?: HydrationStatusEnum;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El TRC no puede ser negativo.' })
  crtSeconds?: number;

  @IsOptional()
  @IsString({ message: 'Las notas del examen deben ser texto.' })
  examNotes?: string;
}
