import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsNotEmpty({ message: 'El token FCM es obligatorio.' })
  @IsString()
  @MaxLength(512)
  fcmToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;
}
