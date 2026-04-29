import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaccinationModule } from '../vaccinations/vaccination.module.js';
import { ClinicalCasesModule } from '../clinical-cases/clinical-cases.module.js';

import { EncountersService } from '../../services/encounters/encounters.service.js';
import { EncounterCoreService } from '../../services/encounters/encounter-core.service.js';
import { EncounterSharedService } from '../../services/encounters/encounter-shared.service.js';
import { EncounterRecordsService } from '../../services/encounters/encounter-records.service.js';
import { EncounterActionsService } from '../../services/encounters/encounter-actions.service.js';
import { EncounterActionDraftService } from '../../services/encounters/encounter-action-draft.service.js';
import { EncounterTreatmentService } from '../../services/encounters/encounter-treatment.service.js';
import { EncountersController } from '../../../presentation/controllers/encounters/encounters.controller.js';

import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EncounterConsultationReason } from '../../../domain/entities/encounters/encounter-consultation-reason.entity.js';
import { EncounterAnamnesis } from '../../../domain/entities/encounters/encounter-anamnesis.entity.js';
import { EncounterClinicalExam } from '../../../domain/entities/encounters/encounter-clinical-exam.entity.js';
import { EncounterEnvironmentalData } from '../../../domain/entities/encounters/encounter-environmental-data.entity.js';
import { EncounterClinicalImpression } from '../../../domain/entities/encounters/encounter-clinical-impression.entity.js';
import { EncounterPlan } from '../../../domain/entities/encounters/encounter-plan.entity.js';
import { EncounterFollowUpConfig } from '../../../domain/entities/encounters/encounter-follow-up-config.entity.js';
import { VaccinationEvent } from '../../../domain/entities/encounters/vaccination-event.entity.js';
import { DewormingEvent } from '../../../domain/entities/encounters/deworming-event.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Surgery } from '../../../domain/entities/encounters/surgery.entity.js';
import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { EncounterVaccinationDraft } from '../../../domain/entities/encounters/encounter-vaccination-draft.entity.js';
import { EncounterTreatmentDraft } from '../../../domain/entities/encounters/encounter-treatment-draft.entity.js';
import { EncounterTreatmentDraftItem } from '../../../domain/entities/encounters/encounter-treatment-draft-item.entity.js';
import { EncounterTreatmentReviewDraft } from '../../../domain/entities/encounters/encounter-treatment-review-draft.entity.js';
import { EncounterProcedureDraft } from '../../../domain/entities/encounters/encounter-procedure-draft.entity.js';
import { ClinicalCase } from '../../../domain/entities/encounters/clinical-case.entity.js';
import { ClinicalCaseFollowUp } from '../../../domain/entities/encounters/clinical-case-follow-up.entity.js';
import { TreatmentEvolutionEvent } from '../../../domain/entities/encounters/treatment-evolution-event.entity.js';
import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { Antiparasitic } from '../../../domain/entities/catalogs/antiparasitic.entity.js';
import { ProcedureCatalog } from '../../../domain/entities/catalogs/procedure-catalog.entity.js';
import { SurgeryCatalog } from '../../../domain/entities/catalogs/surgery-catalog.entity.js';
import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { PatientVaccinationPlanDose } from '../../../domain/entities/vaccinations/patient-vaccination-plan-dose.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';

@Module({
  imports: [
    VaccinationModule,
    ClinicalCasesModule,
    TypeOrmModule.forFeature([
      Encounter,
      EncounterConsultationReason,
      EncounterAnamnesis,
      EncounterClinicalExam,
      EncounterEnvironmentalData,
      EncounterClinicalImpression,
      EncounterPlan,
      EncounterFollowUpConfig,
      VaccinationEvent,
      DewormingEvent,
      Treatment,
      TreatmentItem,
      Surgery,
      Procedure,
      EncounterVaccinationDraft,
      EncounterTreatmentDraft,
      EncounterTreatmentDraftItem,
      EncounterTreatmentReviewDraft,
      EncounterProcedureDraft,
      ClinicalCase,
      ClinicalCaseFollowUp,
      TreatmentEvolutionEvent,
      Vaccine,
      Antiparasitic,
      ProcedureCatalog,
      SurgeryCatalog,
      Appointment,
      QueueEntry,
      Patient,
      PatientVaccineRecord,
      PatientVaccinationPlanDose,
      UserRole,
      Employee,
      User,
      MediaFile,
    ]),
  ],
  controllers: [EncountersController],
  providers: [
    EncountersService,
    EncounterCoreService,
    EncounterSharedService,
    EncounterRecordsService,
    EncounterActionsService,
    EncounterActionDraftService,
    EncounterTreatmentService,
  ],
  exports: [EncountersService],
})
export class EncountersModule {}
