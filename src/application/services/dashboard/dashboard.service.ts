import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { AppointmentStatusEnum, EncounterStatusEnum, QueueStatusEnum } from '../../../domain/enums/index.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry) private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Encounter) private readonly encounterRepo: Repository<Encounter>,
  ) {}

  async getMetrics(): Promise<any> {
    const today = new Date().toISOString().substring(0, 10);

    const pendingAppointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.scheduled_date = :today', { today })
      .andWhere('a.status IN (:...statuses)', { 
        statuses: [AppointmentStatusEnum.PROGRAMADA, AppointmentStatusEnum.CONFIRMADA] 
      })
      .andWhere('a.deleted_at IS NULL')
      .getCount();

    const waitingInQueue = await this.queueRepo
      .createQueryBuilder('q')
      .where('q.date = :today', { today })
      .andWhere('q.status = :status', { status: QueueStatusEnum.EN_ESPERA })
      .andWhere('q.deleted_at IS NULL')
      .getCount();

    const activeEncounters = await this.encounterRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: EncounterStatusEnum.ACTIVA })
      .andWhere('e.deleted_at IS NULL')
      .getCount();

    const finishedEncountersToday = await this.encounterRepo
      .createQueryBuilder('e')
      .where('e.startTime >= :startOfDay', { startOfDay: `${today} 00:00:00` })
      .andWhere('e.status = :status', { status: EncounterStatusEnum.FINALIZADA })
      .andWhere('e.deleted_at IS NULL')
      .getCount();

    return {
      pendingAppointments,
      waitingInQueue,
      activeEncounters,
      finishedEncountersToday,
    };
  }
}
