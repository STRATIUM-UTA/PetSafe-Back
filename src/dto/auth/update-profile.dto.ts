import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { GenderEnum } from '../../common/enums/index.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Los nombres deben ser texto' })
  nombres?: string;

  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  apellidos?: string;

  @IsOptional()
  @IsString({ message: 'La cédula debe ser texto' })
  cedula?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  direccion?: string;

  @IsOptional()
  @IsEnum(GenderEnum, { message: 'El género debe ser: F, M u OTRO' })
  genero?: GenderEnum;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser válida (YYYY-MM-DD)' })
  fechaNacimiento?: string;
}
