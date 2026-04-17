import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmEmailChangeDto {
  @IsEmail({}, { message: 'Por favor, ingrese un correo electronico valido.' })
  newEmail!: string;

  @IsString({ message: 'El codigo debe ser texto.' })
  @IsNotEmpty({ message: 'El codigo es obligatorio.' })
  @Length(6, 6, { message: 'El codigo debe tener 6 digitos.' })
  code!: string;
}
