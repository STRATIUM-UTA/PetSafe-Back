import {
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateVaccineDto {
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name?: string;

  @IsOptional()
  @IsBoolean({ message: 'isRevaccination debe ser verdadero o falso.' })
  isRevaccination?: boolean;
}
