import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateAppointmentRequestDto {
  @IsOptional()
  @IsInt({ message: 'El ID de la mascota debe ser un número.' })
  patientId?: number;

  @IsNotEmpty({ message: 'El motivo de la cita es obligatorio.' })
  @IsString()
  @MinLength(10, { message: 'Describe el motivo con al menos 10 caracteres.' })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha preferida debe tener formato YYYY-MM-DD.' })
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora preferida debe tener formato HH:MM.' })
  preferredTime?: string;
}
