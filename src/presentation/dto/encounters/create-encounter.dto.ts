import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import {
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

export class CreateEncounterDto {
  @IsOptional()
  @IsInt({ message: 'El paciente no es válido.' })
  patientId!: number;

  @IsOptional()
  @IsInt({ message: 'El veterinario seleccionado no es válido.' })
  vetId!: number;

  @IsOptional()
  @IsDateString({}, { message: 'La hora de inicio debe estar en formato válido (ej. 2026-03-29T15:00:00).' })
  @IsNotFutureDate({ message: 'La hora de inicio no puede ser futura.' })
  @IsNotBeforeDate('2000-01-01', {
    message: 'La hora de inicio no puede ser demasiado antigua.',
  })
  startTime!: string;

  @IsOptional()
  @IsInt({ message: 'La cita referenciada no es válida.' })
  appointmentId?: number;

  @IsOptional()
  @IsInt({ message: 'La entrada en cola referenciada no es válida.' })
  queueEntryId?: number;

  @IsOptional()
  @IsString({ message: 'Las notas generales deben ser texto.' })
  generalNotes?: string;
}
