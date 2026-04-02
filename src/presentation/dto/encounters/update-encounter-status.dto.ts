import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import {
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

export class CloseEncounterDto {
  @IsNotEmpty({ message: 'Debes indicar la hora en que terminó la atención.' })
  @IsDateString({}, { message: 'La hora de fin debe estar en formato válido (ej. 2026-03-29T17:00:00).' })
  @IsNotFutureDate({ message: 'La hora de fin no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La hora de fin no puede ser demasiado antigua.',
  })
  endTime!: string;

  @IsOptional()
  @IsString({ message: 'Las notas generales deben ser texto.' })
  generalNotes?: string;
}
