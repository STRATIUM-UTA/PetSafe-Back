import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { GenderEnum } from '../../../domain/enums/index.js';
import { IsCedula } from '../../validators/is-cedula.validator.js';
import { normalizeDocumentId } from '../../../infra/utils/document-id.util.js';
import {
  IsNotOlderThanYears,
  IsNotBeforeDate,
  IsNotFutureDate,
} from '../../validators/date-range.validator.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Los nombres deben ser texto.' })
  @IsNotEmpty({ message: 'Los nombres no pueden estar vacíos.' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto.' })
  @IsNotEmpty({ message: 'Los apellidos no pueden estar vacíos.' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Por favor, ingrese un correo electrónico válido.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La cédula debe ser texto.' })
  @Transform(({ value }) => normalizeDocumentId(value) ?? value)
  @IsCedula({ message: 'La cédula debe ser ecuatoriana y válida.' })
  documentId?: string;

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
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD).' })
  @IsNotFutureDate({ message: 'La fecha de nacimiento no puede ser futura.' })
  @IsNotBeforeDate('1900-01-01', {
    message: 'La fecha de nacimiento no puede ser demasiado antigua.',
  })
  @IsNotOlderThanYears(120, {
    message: 'La fecha de nacimiento no puede indicar más de 120 años.',
  })
  birthDate?: string;
}
