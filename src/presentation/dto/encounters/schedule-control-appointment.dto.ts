import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ScheduleControlAppointmentDto {
  @IsNotEmpty({ message: 'La fecha del turno de control es obligatoria.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduledDate debe tener formato YYYY-MM-DD.',
  })
  scheduledDate!: string;

  @IsNotEmpty({ message: 'La hora de inicio del control es obligatoria.' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'scheduledTime debe tener formato HH:MM.',
  })
  scheduledTime!: string;

  @IsNotEmpty({ message: 'La hora de fin del control es obligatoria.' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime debe tener formato HH:MM.',
  })
  endTime!: string;

  @IsOptional()
  @IsString({ message: 'Las notas del turno deben ser texto.' })
  @MaxLength(2000, { message: 'Las notas del turno no pueden superar los 2000 caracteres.' })
  notes?: string | null;
}
