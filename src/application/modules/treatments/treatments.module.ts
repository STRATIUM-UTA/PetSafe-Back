import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TreatmentsService } from '../../services/treatments/treatments.service.js';
import { TreatmentsController } from '../../../presentation/controllers/treatments/treatments.controller.js';

import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Treatment, TreatmentItem, Encounter, Patient, UserRole])],
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  exports: [TreatmentsService],
})
export class TreatmentsModule { }
