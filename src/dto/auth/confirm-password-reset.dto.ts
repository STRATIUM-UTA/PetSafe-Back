import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido' })
  correo!: string;

  @IsNotEmpty({ message: 'El PIN es obligatorio' })
  @IsString({ message: 'El PIN debe ser texto' })
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos' })
  pin!: string;

  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @IsString({ message: 'La nueva contraseña debe ser texto' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  newPassword!: string;
}
