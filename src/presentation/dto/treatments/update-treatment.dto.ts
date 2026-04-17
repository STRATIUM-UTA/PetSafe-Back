import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateTreatmentDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe estar en formato válido (ej. 2026-04-10).' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'Las instrucciones generales deben ser texto.' })
  generalInstructions?: string;
}
