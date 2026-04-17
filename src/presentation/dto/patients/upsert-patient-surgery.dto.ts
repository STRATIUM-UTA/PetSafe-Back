import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SurgeryStatusEnum } from '../../../domain/enums/index.js';
import {
  IsSameOrAfterProperty,
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

function parseJsonArrayField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export class UpsertPatientSurgeryDto {
  @IsOptional()
  @IsInt({ message: 'El identificador de la cirugía no es válido.' })
  id?: number;

  @IsOptional()
  @IsInt({ message: 'El ID de la cirugía del catálogo debe ser un entero.' })
  catalogId?: number;

  @IsOptional()
  @IsString({ message: 'El tipo de cirugía debe ser texto.' })
  surgeryType?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha programada debe ser una fecha válida.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha programada no puede ser demasiado antigua.',
  })
  scheduledDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de realización debe ser una fecha válida.' })
  @IsNotFutureDate({ message: 'La fecha de realización no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de realización no puede ser demasiado antigua.',
  })
  @IsSameOrAfterProperty('scheduledDate', {
    message: 'La fecha de realización no puede ser anterior a la fecha programada.',
  })
  performedDate?: string;

  @IsOptional()
  @IsEnum(SurgeryStatusEnum, {
    message:
      'El estado de la cirugía no es válido. Valores: '
      + Object.values(SurgeryStatusEnum).join(', '),
  })
  surgeryStatus?: SurgeryStatusEnum;

  @IsOptional()
  @IsString({ message: 'La descripción de la cirugía debe ser texto.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Las instrucciones postoperatorias deben ser texto.' })
  postoperativeInstructions?: string;
}

export class UpsertPatientSurgeryCollectionDto {
  @IsOptional()
  @Transform(({ value }) => parseJsonArrayField(value))
  @IsArray({ message: 'Las cirugías deben enviarse como una lista.' })
  @ValidateNested({ each: true })
  @Type(() => UpsertPatientSurgeryDto)
  surgeries?: UpsertPatientSurgeryDto[];
}
