import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AppointmentRequestStatusEnum } from '../../../domain/enums/index.js';

export class UpdateAppointmentRequestStatusDto {
  @IsEnum(AppointmentRequestStatusEnum, { message: 'Estado no válido.' })
  status!: AppointmentRequestStatusEnum;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  staffNotes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'scheduledDate debe tener formato YYYY-MM-DD.' })
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'scheduledTime debe tener formato HH:MM o HH:MM:SS.' })
  scheduledTime?: string;
}
