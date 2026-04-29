import {
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertPlanDto {
  @IsOptional()
  @IsString({ message: 'El plan clínico debe ser texto.' })
  clinicalPlan?: string;

  @IsOptional()
  @IsString({ message: 'Las notas del plan deben ser texto.' })
  planNotes?: string;
}
