import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppointmentsService } from '../../services/appointments/appointments.service.js';
import { AppointmentsController } from '../../../presentation/controllers/appointments/appointments.controller.js';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, QueueEntry, Patient, Employee, UserRole]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
