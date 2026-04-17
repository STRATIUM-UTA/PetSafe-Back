import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaccinationService } from '../../services/vaccinations/vaccination.service.js';
import { VaccinationPlanService } from '../../services/vaccinations/vaccination-plan.service.js';
import { VaccinationController } from '../../../presentation/controllers/vaccinations/vaccination.controller.js';

import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { VaccinationScheme } from '../../../domain/entities/vaccinations/vaccination-scheme.entity.js';
import { VaccinationSchemeVersion } from '../../../domain/entities/vaccinations/vaccination-scheme-version.entity.js';
import { VaccinationSchemeVersionDose } from '../../../domain/entities/vaccinations/vaccination-scheme-version-dose.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { PatientVaccinationPlanDose } from '../../../domain/entities/vaccinations/patient-vaccination-plan-dose.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vaccine,
      PatientVaccineRecord,
      Patient,
      Species,
      Encounter,
      UserRole,
      Employee,
      VaccinationScheme,
      VaccinationSchemeVersion,
      VaccinationSchemeVersionDose,
      PatientVaccinationPlan,
      PatientVaccinationPlanDose,
    ]),
  ],
  controllers: [VaccinationController],
  providers: [VaccinationService, VaccinationPlanService],
  exports: [VaccinationService, VaccinationPlanService],
})
export class VaccinationModule {}
