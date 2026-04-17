import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { QueueStatusEnum } from '../../../domain/enums/index.js';

export type QueueStatusFilter = QueueStatusEnum | 'TODOS';

export class ListQueueQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'date debe ser una fecha válida (YYYY-MM-DD).' })
  date?: string;

  @IsOptional()
  @IsString()
  searchTerm?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  veterinarianId?: number;

  @IsOptional()
  @IsEnum({ ...QueueStatusEnum, TODOS: 'TODOS' }, { message: 'status inválido.' })
  status?: QueueStatusFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
