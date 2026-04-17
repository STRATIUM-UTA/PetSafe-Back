import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
} from 'class-validator';
import { SurgeryStatusEnum } from '../../../domain/enums/index.js';
import {
  IsSameOrAfterProperty,
  IsNotBeforeDate,
  IsNotFutureDate,
  IsTodayOrLater,
} from '../../validators/date-range.validator.js';

export class CreateSurgeryDto {
  @IsOptional()
  @IsInt({ message: 'El ID de la cirugía del catálogo debe ser un entero.' })
  catalogId?: number;

  @IsOptional()
  @IsString({ message: 'El tipo de cirugía debe ser texto.' })
  surgeryType?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha programada debe estar en formato válido (ej. 2026-04-15T10:00:00).' })
  @IsTodayOrLater({ message: 'La fecha programada debe ser hoy o futura.' })
  scheduledDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de realización debe estar en formato válido.' })
  @IsNotFutureDate({ message: 'La fecha de realización no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de realización no puede ser demasiado antigua.',
  })
  @IsSameOrAfterProperty('scheduledDate', {
    message: 'La fecha de realización no puede ser anterior a la fecha programada.',
  })
  performedDate?: string;

  @IsOptional()
  @IsEnum(SurgeryStatusEnum, { message: 'El estado de la cirugía no es válido. Valores: ' + Object.values(SurgeryStatusEnum).join(', ') })
  surgeryStatus?: SurgeryStatusEnum;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Las instrucciones postoperatorias deben ser texto.' })
  postoperativeInstructions?: string;
}
