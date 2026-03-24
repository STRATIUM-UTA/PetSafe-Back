import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @IsNotEmpty({ message: 'El refresh token es obligatorio para cerrar la sesión' })
  @IsString({ message: 'El refresh token debe ser texto' })
  refreshToken!: string;
}
