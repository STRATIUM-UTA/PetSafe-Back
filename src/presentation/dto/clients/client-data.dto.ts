import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GenderEnum } from '../../../domain/enums/index.js';
import { IsCedula } from '../../validators/is-cedula.validator.js';
import { normalizeDocumentId } from '../../../infra/utils/document-id.util.js';
import {
  IsNotOlderThanYears,
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

export class ClientDataDto {
  @IsNotEmpty({ message: 'Los nombres son obligatorios.' })
  @IsString({ message: 'Los nombres deben ser texto.' })
  firstName!: string;

  @IsNotEmpty({ message: 'Los apellidos son obligatorios.' })
  @IsString({ message: 'Los apellidos deben ser texto.' })
  lastName!: string;

  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  @IsString({ message: 'La cédula debe ser texto.' })
  @Transform(({ value }) => normalizeDocumentId(value) ?? value)
  @IsCedula({ message: 'La cédula debe ser ecuatoriana y válida.' })
  documentId!: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto.' })
  address?: string;

  @IsOptional()
  @IsEnum(GenderEnum, { message: 'El género debe ser válido (F, M u OTRO).' })
  gender?: GenderEnum;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD).' },
  )
  @IsNotFutureDate({ message: 'La fecha de nacimiento no puede ser futura.' })
  @IsNotBeforeDate('1900-01-01', {
    message: 'La fecha de nacimiento no puede ser demasiado antigua.',
  })
  @IsNotOlderThanYears(120, {
    message: 'La fecha de nacimiento no puede indicar más de 120 años.',
  })
  birthDate?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  notes?: string;
}
