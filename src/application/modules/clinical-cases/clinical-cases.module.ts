import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicalCase } from '../../../domain/entities/encounters/clinical-case.entity.js';
import { ClinicalCaseFollowUp } from '../../../domain/entities/encounters/clinical-case-follow-up.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EncounterTreatmentReviewDraft } from '../../../domain/entities/encounters/encounter-treatment-review-draft.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { TreatmentEvolutionEvent } from '../../../domain/entities/encounters/treatment-evolution-event.entity.js';
import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { ClinicalCasesController } from '../../../presentation/controllers/clinical-cases/clinical-cases.controller.js';
import { ClinicalCasesService } from '../../services/clinical-cases/clinical-cases.service.js';
import { EncounterSharedService } from '../../services/encounters/encounter-shared.service.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicalCase,
      ClinicalCaseFollowUp,
      Encounter,
      EncounterTreatmentReviewDraft,
      Treatment,
      TreatmentItem,
      TreatmentEvolutionEvent,
      Appointment,
      QueueEntry,
      Patient,
      Employee,
      User,
      UserRole,
    ]),
  ],
  controllers: [ClinicalCasesController],
  providers: [ClinicalCasesService, EncounterSharedService],
  exports: [ClinicalCasesService],
})
export class ClinicalCasesModule {}
