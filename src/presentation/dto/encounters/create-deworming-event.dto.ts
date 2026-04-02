import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsString,
} from 'class-validator';
import {
  IsAfterProperty,
  IsNotBeforeDate,
  IsNotFutureDate,
  IsTodayOrLater,
} from '../../validators/date-range.validator.js';

export class CreateDewormingEventDto {
  @IsNotEmpty({ message: 'Debes seleccionar un antiparasitario del catálogo.' })
  @IsInt({ message: 'El antiparasitario seleccionado no es válido.' })
  productId!: number;

  @IsNotEmpty({ message: 'La fecha de aplicación del antiparasitario es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de aplicación debe estar en formato válido (ej. 2026-03-29).' })
  @IsNotFutureDate({ message: 'La fecha de aplicación no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de aplicación no puede ser demasiado antigua.',
  })
  applicationDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de próxima aplicación debe estar en formato válido.' })
  @IsTodayOrLater({ message: 'La fecha de próxima aplicación debe ser hoy o futura.' })
  @IsAfterProperty('applicationDate', {
    message: 'La fecha de próxima aplicación debe ser posterior a la fecha de aplicación.',
  })
  suggestedNextDate?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  notes?: string;
}
