import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardService } from '../../services/dashboard/dashboard.service.js';
import { DashboardController } from '../../../presentation/controllers/dashboard/dashboard.controller.js';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, QueueEntry, Encounter]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
