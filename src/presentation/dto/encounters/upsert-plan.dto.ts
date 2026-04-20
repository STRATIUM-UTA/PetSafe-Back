import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsTodayOrLater } from '../../validators/date-range.validator.js';
import {
  ClinicalCaseOutcomeEnum,
  ClinicalCasePlanLinkModeEnum,
} from '../../../domain/enums/index.js';

export class UpsertPlanDto {
  @IsOptional()
  @IsString({ message: 'El plan clínico debe ser texto.' })
  clinicalPlan?: string;

  @IsOptional()
  @IsBoolean({ message: 'Indica si se requiere seguimiento: true o false.' })
  requiresFollowUp?: boolean;

  @ValidateIf((o: UpsertPlanDto) => o.requiresFollowUp === true)
  @IsNotEmpty({ message: 'Si marcas que se requiere seguimiento, debes indicar la fecha sugerida.' })
  @IsDateString({}, { message: 'La fecha de seguimiento debe estar en formato válido (ej. 2027-03-29).' })
  @IsTodayOrLater({ message: 'La fecha de seguimiento debe ser hoy o futura.' })
  suggestedFollowUpDate?: string;

  @IsOptional()
  @IsEnum(ClinicalCasePlanLinkModeEnum, {
    message: 'El modo de vinculación del caso no es válido.',
  })
  caseLinkMode?: ClinicalCasePlanLinkModeEnum;

  @ValidateIf((o: UpsertPlanDto) => o.caseLinkMode === ClinicalCasePlanLinkModeEnum.EXISTING)
  @Type(() => Number)
  @IsInt({ message: 'El clinicalCaseId debe ser un número entero.' })
  @Min(1, { message: 'El clinicalCaseId debe ser mayor a 0.' })
  clinicalCaseId?: number;

  @ValidateIf((o: UpsertPlanDto) => o.caseLinkMode === ClinicalCasePlanLinkModeEnum.NEW)
  @IsNotEmpty({ message: 'Debes resumir el problema clínico para abrir un caso nuevo.' })
  @IsString({ message: 'El problema clínico debe ser texto.' })
  problemSummary?: string;

  @IsOptional()
  @IsEnum(ClinicalCaseOutcomeEnum, { message: 'El resultado del caso no es válido.' })
  caseOutcome?: ClinicalCaseOutcomeEnum;

  @IsOptional()
  @IsString({ message: 'Las notas del plan deben ser texto.' })
  planNotes?: string;
}
