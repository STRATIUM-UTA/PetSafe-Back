import { IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVaccinationSchemeVersionDto } from './create-vaccination-scheme-version.dto.js';

export class CreateVaccinationSchemeDto {
  @IsString()
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt({ message: 'speciesId debe ser un entero.' })
  speciesId!: number;

  @ValidateNested()
  @Type(() => CreateVaccinationSchemeVersionDto)
  initialVersion!: CreateVaccinationSchemeVersionDto;
}
