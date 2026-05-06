import { IsEnum } from 'class-validator';

import { EncounterFollowUpActionEnum } from '../../../domain/enums/index.js';

export class UpsertFollowUpConfigDto {
  @IsEnum(EncounterFollowUpActionEnum, {
    message: 'La acción de seguimiento no es válida.',
  })
  action!: EncounterFollowUpActionEnum;
}
