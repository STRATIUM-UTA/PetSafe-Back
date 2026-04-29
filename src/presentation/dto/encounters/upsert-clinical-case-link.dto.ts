import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import { EncounterClinicalCaseLinkModeEnum } from '../../../domain/enums/index.js';

export class UpsertClinicalCaseLinkDto {
  @IsEnum(EncounterClinicalCaseLinkModeEnum, {
    message: 'El modo de vínculo del caso clínico no es válido.',
  })
  mode!: EncounterClinicalCaseLinkModeEnum;

  @ValidateIf((o: UpsertClinicalCaseLinkDto) => o.mode === EncounterClinicalCaseLinkModeEnum.EXISTING)
  @Type(() => Number)
  @IsInt({ message: 'El clinicalCaseId debe ser un número entero.' })
  @Min(1, { message: 'El clinicalCaseId debe ser mayor a 0.' })
  clinicalCaseId?: number;

  @ValidateIf((o: UpsertClinicalCaseLinkDto) => o.mode === EncounterClinicalCaseLinkModeEnum.NEW)
  @IsNotEmpty({ message: 'Debes resumir el problema clínico para abrir un caso nuevo.' })
  @IsString({ message: 'El resumen del problema clínico debe ser texto.' })
  @MaxLength(240, { message: 'El resumen del problema clínico no puede superar los 240 caracteres.' })
  problemSummary?: string;
}
