import { IsEnum } from 'class-validator';

import { ClinicalCaseStatusEnum } from '../../../domain/enums/index.js';

export class UpdateClinicalCaseStatusDto {
  @IsEnum(ClinicalCaseStatusEnum, { message: 'El estado del caso clínico no es válido.' })
  status!: ClinicalCaseStatusEnum;
}
