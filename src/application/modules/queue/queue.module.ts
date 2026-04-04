import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueueService } from '../../services/queue/queue.service.js';
import { QueueController } from '../../../presentation/controllers/queue/queue.controller.js';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';

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
      MediaFile,
    ]),
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
