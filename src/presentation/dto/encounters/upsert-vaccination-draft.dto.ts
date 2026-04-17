import { IsInt, IsOptional } from 'class-validator';

import { CreateVaccinationEventDto } from './create-vaccination-event.dto.js';

export class UpsertVaccinationDraftDto extends CreateVaccinationEventDto {
  @IsOptional()
  @IsInt({ message: 'La dosis del plan vacunal no es válida.' })
  planDoseId?: number;
}
