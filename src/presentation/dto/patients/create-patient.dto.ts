import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
} from 'class-validator';
import {
  IsNotOlderThanYears,
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

export class CreatePatientDto {
  @IsNotEmpty({ message: 'El nombre de la mascota es obligatorio.' })
  @IsString({ message: 'El nombre debe ser un texto.' })
  name!: string;

  @IsNotEmpty({ message: 'La especie de la mascota es obligatoria.' })
  @IsInt({ message: 'La especie proporcionada no es válida.' })
  speciesId!: number;

  @IsNotEmpty({ message: 'El sexo del paciente es obligatorio.' })
  @IsString({ message: 'El sexo debe ser un texto válido (MACHO, HEMBRA, INTERSEXUAL).' })
  sex!: string;

  @IsOptional()
  @IsInt({ message: 'La raza proporcionada no es válida.' })
  breedId?: number;

  @IsOptional()
  @IsInt({ message: 'El color proporcionado no es válido.' })
  colorId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD).' })
  @IsNotFutureDate({ message: 'La fecha de nacimiento no puede ser futura.' })
  @IsNotBeforeDate('1900-01-01', {
    message: 'La fecha de nacimiento no puede ser demasiado antigua.',
  })
  @IsNotOlderThanYears(40, {
    message: 'La fecha de nacimiento de la mascota no puede indicar más de 40 años.',
  })
  birthDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El peso actual debe ser un valor numérico.' })
  currentWeight?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado de esterilización debe ser verdadero o falso.' })
  sterilized?: boolean;

  @IsOptional()
  @IsString({ message: 'El código del microchip debe ser un texto.' })
  microchipCode?: string;

  @IsOptional()
  @IsString({ message: 'Las marcas distintivas deben ser un texto.' })
  distinguishingMarks?: string;

  @IsOptional()
  @IsString({ message: 'Las alergias generales deben ser un texto.' })
  generalAllergies?: string;

  @IsOptional()
  @IsString({ message: 'El historial general general debe ser un texto.' })
  generalHistory?: string;

  @IsOptional()
  @IsInt({ message: 'El cliente asignado no es válido.' })
  clientId?: number;
}
