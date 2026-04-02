import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QueueEntryTypeEnum } from '../../../domain/enums/index.js';

export class CreateQueueEntryDto {
  @Type(() => Number)
  @IsInt({ message: 'patientId debe ser entero.' })
  @Min(1)
  patientId!: number;

  /** veterinarianId es opcional: si no viene, se infiere del usuario autenticado */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'veterinarianId debe ser entero.' })
  @Min(1)
  veterinarianId?: number;

  @IsEnum(QueueEntryTypeEnum, { message: 'entryType inválido.' })
  entryType!: QueueEntryTypeEnum;

  /** appointmentId opcional: enlaza con cita si el paciente vino con cita */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  appointmentId?: number | null;

  /** scheduledTime HH:MM (solo si vino con cita) */
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'scheduledTime debe tener formato HH:MM.' })
  scheduledTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
