import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsService } from '../../services/reports/reports.service.js';
import { ReportsController } from '../../../presentation/controllers/reports/reports.controller.js';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      QueueEntry,
      Patient,
      PatientTutor,
      Employee,
      Client,
      UserRole,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
