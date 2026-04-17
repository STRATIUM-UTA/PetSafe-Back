import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentReasonEnum } from '../../../domain/enums/index.js';

export class CreateAppointmentDto {
  @Type(() => Number)
  @IsInt({ message: 'El patientId debe ser un número entero.' })
  @Min(1, { message: 'El patientId debe ser mayor a 0.' })
  patientId!: number;

  @IsNotEmpty({ message: 'La fecha de la cita es obligatoria.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduledDate debe tener formato YYYY-MM-DD.',
  })
  scheduledDate!: string;

  @IsNotEmpty({ message: 'La hora de la cita es obligatoria.' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'scheduledTime debe tener formato HH:MM.',
  })
  scheduledTime!: string;

  @IsNotEmpty({ message: 'La hora fin de la cita es obligatoria.' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime debe tener formato HH:MM.',
  })
  endTime!: string;

  @IsNotEmpty({ message: 'El motivo de la cita es obligatorio.' })
  @IsEnum(AppointmentReasonEnum, { message: 'reason debe ser un motivo de cita valido.' })
  reason!: AppointmentReasonEnum;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string | null;
}
