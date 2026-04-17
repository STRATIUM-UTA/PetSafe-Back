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

export class CreateVaccinationEventDto {
  @IsNotEmpty({ message: 'Debes seleccionar una vacuna del catálogo.' })
  @IsInt({ message: 'La vacuna seleccionada no es válida.' })
  vaccineId!: number;

  @IsNotEmpty({ message: 'La fecha de aplicación de la vacuna es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de aplicación debe estar en formato válido (ej. 2026-03-29).' })
  @IsNotFutureDate({ message: 'La fecha de aplicación no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La fecha de aplicación no puede ser demasiado antigua.',
  })
  applicationDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de próxima dosis debe estar en formato válido (ej. 2027-03-29).' })
  @IsTodayOrLater({ message: 'La fecha de próxima dosis debe ser hoy o futura.' })
  @IsAfterProperty('applicationDate', {
    message: 'La fecha de próxima dosis debe ser posterior a la fecha de aplicación.',
  })
  suggestedNextDate?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  notes?: string;
}
