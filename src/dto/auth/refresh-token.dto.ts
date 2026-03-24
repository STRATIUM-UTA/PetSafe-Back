import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  @IsString({ message: 'El refresh token debe ser texto' })
  refreshToken!: string;
}
