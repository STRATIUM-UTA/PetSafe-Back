import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateVaccineDto {
  @IsNotEmpty({ message: 'El nombre de la vacuna es obligatorio.' })
  @IsString()
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name!: string;

  @IsNotEmpty({ message: 'El ID de la especie es obligatorio.' })
  @IsInt({ message: 'speciesId debe ser un entero.' })
  speciesId!: number;

  @IsOptional()
  @IsBoolean({ message: 'isRevaccination debe ser verdadero o falso.' })
  isRevaccination?: boolean;
}
