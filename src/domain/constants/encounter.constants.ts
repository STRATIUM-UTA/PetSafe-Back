import { EncounterStatusEnum } from '../enums/index.js';

export const ENCOUNTER_REACTIVATION_GRACE_MINUTES = 5;

export const EDITABLE_ENCOUNTER_STATUSES: readonly EncounterStatusEnum[] = [
  EncounterStatusEnum.ACTIVA,
  EncounterStatusEnum.REACTIVADA,
];
