import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentRequest } from '../../../domain/entities/appointments/appointment-request.entity.js';
import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { AppointmentRequestsService } from '../../services/appointment-requests/appointment-requests.service.js';
import { AppointmentRequestsController } from '../../../presentation/controllers/appointment-requests/appointment-requests.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppointmentRequest, Appointment, Employee, User]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [AppointmentRequestsController],
  providers: [AppointmentRequestsService],
  exports: [AppointmentRequestsService],
})
export class AppointmentRequestsModule {}
