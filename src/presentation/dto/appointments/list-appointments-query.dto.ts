import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListAppointmentsQueryDto {
  @IsNotEmpty({ message: 'El parámetro from es obligatorio.' })
  @IsDateString({}, { message: 'El parámetro from debe ser una fecha válida (YYYY-MM-DD).' })
  from!: string;

  @IsNotEmpty({ message: 'El parámetro to es obligatorio.' })
  @IsDateString({}, { message: 'El parámetro to debe ser una fecha válida (YYYY-MM-DD).' })
  to!: string;

  @IsOptional()
  @IsString()
  view?: string;
}
