import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TreatmentItemStatusEnum } from '../../../domain/enums/index.js';
import {
  IsNotBeforeDate,
  IsSameOrAfterProperty,
} from '../../validators/date-range.validator.js';

export class CreateTreatmentItemDto {
  @IsNotEmpty({ message: 'El nombre del medicamento es obligatorio.' })
  @IsString({ message: 'El medicamento debe ser texto.' })
  medication!: string;

  @IsNotEmpty({ message: 'La dosis es obligatoria (ej. 250mg).' })
  @IsString({ message: 'La dosis debe ser texto.' })
  dose!: string;

  @IsNotEmpty({ message: 'La frecuencia de administración es obligatoria (ej. cada 12 horas).' })
  @IsString({ message: 'La frecuencia debe ser texto.' })
  frequency!: string;

  @IsNotEmpty({ message: 'La duración del tratamiento en días es obligatoria.' })
  @IsInt({ message: 'La duración debe ser un número entero de días.' })
  @Min(1, { message: 'La duración debe ser de al menos 1 día.' })
  durationDays!: number;

  @IsNotEmpty({ message: 'La vía de administración es obligatoria (ej. Oral, Subcutánea).' })
  @IsString({ message: 'La vía de administración debe ser texto.' })
  administrationRoute!: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  notes?: string;

  @IsOptional()
  @IsEnum(TreatmentItemStatusEnum, { message: 'El estado del ítem no es válido.' })
  status?: TreatmentItemStatusEnum;
}

export class CreateTreatmentDto {
  @IsNotEmpty({ message: 'La fecha de inicio del tratamiento es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de inicio debe estar en formato válido (ej. 2026-03-29).' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de inicio no puede ser demasiado antigua.',
  })
  startDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe estar en formato válido (ej. 2026-04-05).' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de fin no puede ser demasiado antigua.',
  })
  @IsSameOrAfterProperty('startDate', {
    message: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
  })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'Las instrucciones generales deben ser texto.' })
  generalInstructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tratamiento reemplazado debe ser un identificador válido.' })
  @Min(1, { message: 'El tratamiento reemplazado debe ser mayor a 0.' })
  replacesTreatmentId?: number | null;

  @IsOptional()
  @IsArray({ message: 'Los ítems del tratamiento deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreateTreatmentItemDto)
  items?: CreateTreatmentItemDto[];
}
