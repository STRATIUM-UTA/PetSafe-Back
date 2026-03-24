import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { PatientSexEnum } from '../../common/enums/index.js';

export class CreatePacienteDto {
  @IsNotEmpty({ message: 'El nombre de la mascota es obligatorio' })
  @IsString({ message: 'El nombre de la mascota debe ser texto' })
  nombre!: string;

  @IsNotEmpty({ message: 'La especie es obligatoria' })
  @IsUUID('4', { message: 'El ID de especie debe ser un UUID válido' })
  especieId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
  clienteId?: string;

  @IsNotEmpty({ message: 'El sexo es obligatorio' })
  @IsEnum(PatientSexEnum, { message: 'El sexo debe ser: MACHO, HEMBRA o INTERSEXUAL' })
  sexo!: PatientSexEnum;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de raza debe ser un UUID válido' })
  razaId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de color debe ser un UUID válido' })
  colorId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)' })
  fechaNacimiento?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El peso debe ser un número' })
  pesoActual?: number;

  @IsOptional()
  @IsBoolean({ message: 'El campo esterilizado debe ser verdadero o falso' })
  esterilizado?: boolean;

  @IsOptional()
  @IsString({ message: 'El código de microchip debe ser texto' })
  microchipCodigo?: string;

  @IsOptional()
  @IsString({ message: 'Las señas particulares deben ser texto' })
  senasParticulares?: string;

  @IsOptional()
  @IsString({ message: 'Las alergias generales deben ser texto' })
  alergiasGenerales?: string;

  @IsOptional()
  @IsString({ message: 'Los antecedentes generales deben ser texto' })
  antecedentesGenerales?: string;
}
