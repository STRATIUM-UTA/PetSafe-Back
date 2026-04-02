import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdoptionStatusEnum } from '../../../domain/enums/index.js';

export class UpdateAdoptionDto {
  @IsOptional()
  @IsEnum(AdoptionStatusEnum)
  status?: AdoptionStatusEnum;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adopterClientId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  story?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
