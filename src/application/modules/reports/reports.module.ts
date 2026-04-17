import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsService } from '../../services/reports/reports.service.js';
import { AppointmentsPdfService } from '../../services/reports/appointments-pdf.service.js';
import { ClinicalHistoryPdfService } from '../../services/reports/clinical-history-pdf.service.js';
import { ClinicalHistoryFullPdfService } from '../../services/reports/clinical-history-full-pdf.service.js';
import { ReportsController } from '../../../presentation/controllers/reports/reports.controller.js';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      QueueEntry,
      Encounter,
      Patient,
      PatientCondition,
      PatientTutor,
      PatientVaccineRecord,
      Employee,
      Client,
      User,
      UserRole,
      PatientVaccinationPlan,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, AppointmentsPdfService, ClinicalHistoryPdfService, ClinicalHistoryFullPdfService],
})
export class ReportsModule {}
