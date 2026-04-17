import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GenderEnum } from '../../../domain/enums/index.js';
import { IsCedula } from '../../validators/is-cedula.validator.js';
import { normalizeDocumentId } from '../../../infra/utils/document-id.util.js';
import {
  IsNotBeforeDate,
  IsNotFutureDate,
  IsNotOlderThanYears,
} from '../../validators/date-range.validator.js';

const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñ' -]+$/;
const PHONE_PATTERN = /^\d{10}$/;

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: 'Los nombres deben ser texto.' })
  @IsNotEmpty({ message: 'Los nombres no pueden quedar vacios.' })
  @MinLength(3, { message: 'Los nombres deben tener al menos 3 caracteres.' })
  @MaxLength(20, { message: 'Los nombres no pueden superar 20 caracteres.' })
  @Matches(NAME_PATTERN, {
    message: 'Los nombres solo pueden contener letras, espacios, apostrofes o guiones.',
  })
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: 'Los apellidos deben ser texto.' })
  @IsNotEmpty({ message: 'Los apellidos no pueden quedar vacios.' })
  @MinLength(3, { message: 'Los apellidos deben tener al menos 3 caracteres.' })
  @MaxLength(20, { message: 'Los apellidos no pueden superar 20 caracteres.' })
  @Matches(NAME_PATTERN, {
    message: 'Los apellidos solo pueden contener letras, espacios, apostrofes o guiones.',
  })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Por favor, ingrese un correo electronico valido.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La cedula debe ser texto.' })
  @Transform(({ value }) => normalizeDocumentId(value) ?? value)
  @IsCedula({ message: 'La cedula debe ser ecuatoriana y valida.' })
  documentId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El telefono debe ser texto.' })
  @Matches(PHONE_PATTERN, { message: 'El telefono debe contener exactamente 10 digitos.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La direccion debe ser texto.' })
  address?: string;

  @IsOptional()
  @IsEnum(GenderEnum, { message: 'El genero debe ser valido (F, M u OTRO).' })
  gender?: GenderEnum;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha valida (YYYY-MM-DD).' })
  @IsNotFutureDate({ message: 'La fecha de nacimiento no puede ser futura.' })
  @IsNotBeforeDate('1900-01-01', {
    message: 'La fecha de nacimiento no puede ser demasiado antigua.',
  })
  @IsNotOlderThanYears(120, {
    message: 'La fecha de nacimiento no puede indicar mas de 120 anos.',
  })
  birthDate?: string;
}
