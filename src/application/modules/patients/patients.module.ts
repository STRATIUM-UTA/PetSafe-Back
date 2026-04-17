import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PatientsService } from '../../services/patients/patients.service.js';
import { PatientsController } from '../../../presentation/controllers/patients/patients.controller.js';
import { VaccinationModule } from '../vaccinations/vaccination.module.js';

import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Breed } from '../../../domain/entities/catalogs/breed.entity.js';
import { SurgeryCatalog } from '../../../domain/entities/catalogs/surgery-catalog.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { Surgery } from '../../../domain/entities/encounters/surgery.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';

@Module({
  imports: [
    VaccinationModule,
    TypeOrmModule.forFeature([
      Patient,
      PatientTutor,
      PatientCondition,
      Client,
      Species,
      Breed,
      Encounter,
      Procedure,
      Surgery,
      SurgeryCatalog,
      UserRole,
      MediaFile,
    ]),
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
