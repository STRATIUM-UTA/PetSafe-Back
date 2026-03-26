import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto.js';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  active?: boolean;
}
