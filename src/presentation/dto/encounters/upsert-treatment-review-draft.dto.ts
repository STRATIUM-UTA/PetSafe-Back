import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { TreatmentEvolutionEventTypeEnum } from '../../../domain/enums/index.js';

export class UpsertTreatmentReviewDraftDto {
  @Type(() => Number)
  @IsInt({ message: 'El tratamiento origen debe ser un identificador válido.' })
  @Min(1, { message: 'El tratamiento origen debe ser mayor a 0.' })
  sourceTreatmentId!: number;

  @IsEnum(TreatmentEvolutionEventTypeEnum, {
    message: 'La acción de evolución terapéutica no es válida.',
  })
  action!: TreatmentEvolutionEventTypeEnum;

  @IsOptional()
  @IsString({ message: 'Las notas de seguimiento deben ser texto.' })
  notes?: string;
}
