import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAdoptionTagSearchQueryDto {
  @IsOptional()
  @IsString({ message: 'El criterio de busqueda debe ser texto.' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero.' })
  @Min(1, { message: 'El limite debe ser mayor a 0.' })
  @Max(20, { message: 'El limite no puede exceder 20.' })
  limit?: number;
}
