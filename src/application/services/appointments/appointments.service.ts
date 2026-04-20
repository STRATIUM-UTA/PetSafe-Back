import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { AppointmentReasonEnum } from '../../../domain/enums/index.js';
import { CreateAppointmentDto } from '../../../presentation/dto/appointments/create-appointment.dto.js';
import { ListAppointmentsQueryDto } from '../../../presentation/dto/appointments/list-appointments-query.dto.js';
import { AppointmentCalendarItemDto } from '../../../presentation/dto/appointments/appointment-calendar-item.dto.js';

// ── Helper: formatea HH:MM desde un string de time de postgres (HH:MM:SS) ──
function formatTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Postgres devuelve "HH:MM:SS", nos quedamos con "HH:MM"
  return raw.substring(0, 5);
}

// ── Helper: formatea YYYY-MM-DD desde un Date (scheduledDate viene como Date de TypeORM) ──
function formatDate(raw: string | Date): string {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Si ya es string YYYY-MM-DD, devolverlo tal cual (tomamos los primeros 10 chars)
  return String(raw).substring(0, 10);
}

function isTimeRangeValid(startTime: string | null | undefined, endTime: string | null | undefined): boolean {
  if (!startTime || !endTime) {
    return false;
  }

  return endTime > startTime;
}

type QueueEntrySummary = {
  id: number;
  status: string;
};

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  // ── Resuelve el employeeId a partir del userId autenticado ──
  private async resolveVetId(userId: number): Promise<number> {
    const employee = await this.employeeRepo
      .createQueryBuilder('e')
      .innerJoin('e.person', 'p')
      .innerJoin(User, 'u', '"u"."person_id" = "p"."id"')
      .where('u.id = :userId', { userId })
      .andWhere('"e"."deleted_at" IS NULL')
      .select('e.id')
      .getOne();

    if (!employee) {
      throw new UnprocessableEntityException(
        'El usuario autenticado no tiene un perfil de empleado/veterinario asociado.',
      );
    }
    return employee.id;
  }

  private async getQueueEntriesByAppointmentIds(
    appointmentIds: number[],
  ): Promise<Map<number, QueueEntrySummary>> {
    if (appointmentIds.length === 0) {
      return new Map();
    }

    const queueEntries = await this.queueRepo.find({
      where: {
        appointmentId: In(appointmentIds),
        deletedAt: IsNull(),
      },
      order: {
        id: 'DESC',
      },
    });

    const queueByAppointmentId = new Map<number, QueueEntrySummary>();
    for (const entry of queueEntries) {
      if (!entry.appointmentId || queueByAppointmentId.has(entry.appointmentId)) {
        continue;
      }

      queueByAppointmentId.set(entry.appointmentId, {
        id: entry.id,
        status: entry.status,
      });
    }

    return queueByAppointmentId;
  }

  // ── Mapea una Appointment a lo que espera el front ──
  private toCalendarItem(
    appt: Appointment,
    queueEntry?: QueueEntrySummary,
  ): AppointmentCalendarItemDto {
    const startsAt = formatTime(appt.scheduledTime);
    const endsAt = formatTime(appt.endTime);
    const primaryTutor = appt.patient?.tutors?.find((tutor) => !tutor.deletedAt && tutor.isPrimary);
    const tutorPerson = primaryTutor?.client?.person;
    const dto = new AppointmentCalendarItemDto();
    dto.id = appt.id;
    dto.patientId = appt.patientId;
    dto.vetId = appt.vetId;
    dto.patientName = appt.patient?.name ?? null;
    dto.ownerName = tutorPerson
      ? `${tutorPerson.firstName} ${tutorPerson.lastName}`.trim()
      : null;
    dto.scheduledDate = formatDate(appt.scheduledDate);
    dto.startsAt = startsAt ?? null;
    dto.endsAt = endsAt;
    dto.reason = appt.reason ?? null;
    dto.notes = appt.notes ?? null;
    dto.status = appt.status;
    dto.hasQueueEntry = Boolean(queueEntry);
    dto.queueEntryId = queueEntry?.id ?? null;
    dto.queueStatus = queueEntry?.status ?? null;
    dto.isActive = appt.isActive;
    return dto;
  }

  private buildAppointmentEndDate(appt: Appointment): Date | null {
    const scheduledDate = formatDate(appt.scheduledDate);
    const endTime = formatTime(appt.endTime) ?? formatTime(appt.scheduledTime);

    if (!endTime) {
      return null;
    }

    const endDate = new Date(`${scheduledDate}T${endTime}:00`);
    return Number.isNaN(endDate.getTime()) ? null : endDate;
  }

  private async ensureNoScheduleOverlap(
    vetId: number,
    dto: CreateAppointmentDto,
  ): Promise<void> {
    if (!dto.scheduledTime || !dto.endTime) {
      return;
    }

    const overlappingAppointment = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('a.id')
      .where('"a"."vet_id" = :vetId', { vetId })
      .andWhere('"a"."scheduled_date" = :scheduledDate', { scheduledDate: dto.scheduledDate })
      .andWhere('"a"."deleted_at" IS NULL')
      .andWhere(`"a"."status" IN (:...activeStatuses)`, {
        activeStatuses: ['PROGRAMADA', 'CONFIRMADA', 'EN_PROCESO'],
      })
      .andWhere('"a"."scheduled_time" < :endTime', { endTime: dto.endTime })
      .andWhere('"a"."end_time" > :scheduledTime', { scheduledTime: dto.scheduledTime })
      .getOne();

    if (overlappingAppointment) {
      throw new ConflictException(
        'El veterinario ya tiene una cita que se cruza con el rango horario seleccionado.',
      );
    }
  }

  // ── GET /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD ──
  async listByRange(
    query: ListAppointmentsQueryDto,
    userId: number,
  ): Promise<AppointmentCalendarItemDto[]> {
    const vetId = await this.resolveVetId(userId);

    const appointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect(
        'patient.tutors',
        'tutor',
        '"tutor"."is_primary" = true AND "tutor"."deleted_at" IS NULL',
      )
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .innerJoinAndSelect('a.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .where('"a"."vet_id" = :vetId', { vetId })
      .andWhere('"a"."scheduled_date" >= :from', { from: query.from })
      .andWhere('"a"."scheduled_date" <= :to', { to: query.to })
      .andWhere('"a"."deleted_at" IS NULL')
      .orderBy('"a"."scheduled_date"', 'ASC')
      .addOrderBy('"a"."scheduled_time"', 'ASC')
      .addOrderBy('"a"."end_time"', 'ASC')
      .getMany();

    const queueByAppointmentId = await this.getQueueEntriesByAppointmentIds(
      appointments.map((appointment) => appointment.id),
    );

    return appointments.map((appointment) =>
      this.toCalendarItem(appointment, queueByAppointmentId.get(appointment.id)),
    );
  }

  // ── POST /appointments ──
  async create(
    dto: CreateAppointmentDto,
    userId: number,
  ): Promise<AppointmentCalendarItemDto> {
    // 1) Resolver veterinario del usuario autenticado
    const vetId = await this.resolveVetId(userId);

    // 2) Validar que el paciente existe
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId },
    });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    const hasScheduledTime = Boolean(dto.scheduledTime?.trim());
    const hasEndTime = Boolean(dto.endTime?.trim());

    if (hasScheduledTime !== hasEndTime) {
      throw new BadRequestException(
        'Debes indicar ambas horas de la cita o dejar ambas vacías.',
      );
    }

    if (dto.reason !== AppointmentReasonEnum.CONTROL && (!hasScheduledTime || !hasEndTime)) {
      throw new BadRequestException(
        'Las citas con horario definido deben incluir hora de inicio y de fin.',
      );
    }

    // 3) Validar rango horario
    if (hasScheduledTime && hasEndTime && !isTimeRangeValid(dto.scheduledTime, dto.endTime)) {
      throw new BadRequestException('La hora fin debe ser mayor que la hora inicio.');
    }

    await this.ensureNoScheduleOverlap(vetId, dto);

    // 4) Crear la cita
    const appointment = this.appointmentRepo.create({
      patientId: dto.patientId,
      vetId,
      scheduledDate: dto.scheduledDate,
      scheduledTime: hasScheduledTime ? dto.scheduledTime!.trim() : null,
      endTime: hasEndTime ? dto.endTime!.trim() : null,
      reason: dto.reason,
      notes: dto.notes?.trim() || null,
      createdByUserId: userId,
    });

    let saved: Appointment;
    try {
      saved = await this.appointmentRepo.save(appointment);
    } catch (err) {
      // El índice único uq_appointments_vet_slot_live lanzará un error 23505
      if (err instanceof QueryFailedError) {
        const pgErr = err as QueryFailedError & { code?: string };
        if (pgErr.code === '23505') {
          throw new ConflictException(
            'El veterinario ya tiene una cita que se cruza con el rango horario seleccionado.',
          );
        }
      }
      throw err;
    }

    // 5) Recargar con relaciones para poder mapear al formato del calendario
    const full = await this.appointmentRepo.findOne({
      where: { id: saved.id },
      relations: [
        'patient',
        'patient.tutors',
        'patient.tutors.client',
        'patient.tutors.client.person',
        'veterinarian',
        'veterinarian.person',
      ],
    });

    if (!full) {
      throw new NotFoundException('No se pudo recuperar la cita recién creada.');
    }

    const queueByAppointmentId = await this.getQueueEntriesByAppointmentIds([full.id]);
    return this.toCalendarItem(full, queueByAppointmentId.get(full.id));
  }

  // ── PATCH /appointments/:id/confirm ──
  async confirm(id: number): Promise<AppointmentCalendarItemDto> {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt || appt.deletedAt) {
      throw new NotFoundException('Cita no encontrada.');
    }
    if (appt.status !== 'PROGRAMADA' as any) {
      throw new BadRequestException('Solo se puede confirmar una cita en estado PROGRAMADA.');
    }
    await this.appointmentRepo.update(id, { status: 'CONFIRMADA' as any });
    return this.findOneDto(id);
  }

  // ── PATCH /appointments/:id/cancel ──
  async cancel(id: number): Promise<AppointmentCalendarItemDto> {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt || appt.deletedAt) {
      throw new NotFoundException('Cita no encontrada.');
    }
    if (['FINALIZADA', 'CANCELADA', 'EN_PROCESO'].includes(appt.status as any)) {
      throw new BadRequestException('No se puede cancelar la cita en su estado actual.');
    }

    const linkedQueueEntry = await this.queueRepo.findOne({
      where: { appointmentId: id, deletedAt: IsNull() },
    });
    if (linkedQueueEntry?.status === 'EN_ATENCION') {
      throw new BadRequestException(
        'No se puede cancelar la cita porque el paciente ya está siendo atendido.',
      );
    }

    await this.appointmentRepo.update(id, { status: 'CANCELADA' as any });
    if (linkedQueueEntry?.status === 'EN_ESPERA') {
      await this.queueRepo.update(linkedQueueEntry.id, { status: 'CANCELADA' as any });
    }
    return this.findOneDto(id);
  }

  // ── PATCH /appointments/:id/no-show ──
  async markNoShow(id: number): Promise<AppointmentCalendarItemDto> {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt || appt.deletedAt) {
      throw new NotFoundException('Cita no encontrada.');
    }
    if (!['PROGRAMADA', 'CONFIRMADA'].includes(appt.status as any)) {
      throw new BadRequestException(
        'Solo se puede marcar como no asistió una cita programada o confirmada.',
      );
    }

    const appointmentEnd = this.buildAppointmentEndDate(appt);
    if (!appointmentEnd || appointmentEnd > new Date()) {
      throw new BadRequestException(
        'Solo se puede marcar como no asistió cuando la cita ya terminó.',
      );
    }

    const hasQueueEntry = await this.queueRepo.exists({
      where: { appointmentId: id, deletedAt: IsNull() },
    });
    if (hasQueueEntry) {
      throw new BadRequestException(
        'La cita ya tiene un registro en la cola de atención y no puede marcarse como no asistió.',
      );
    }

    await this.appointmentRepo.update(id, { status: 'NO_ASISTIO' as any });
    return this.findOneDto(id);
  }

  private async findOneDto(id: number): Promise<AppointmentCalendarItemDto> {
    const full = await this.appointmentRepo.findOne({
      where: { id },
      relations: [
        'patient',
        'patient.tutors',
        'patient.tutors.client',
        'patient.tutors.client.person',
        'veterinarian',
        'veterinarian.person',
      ],
    });
    if (!full) throw new NotFoundException('Cita no encontrada.');
    const queueByAppointmentId = await this.getQueueEntriesByAppointmentIds([full.id]);
    return this.toCalendarItem(full, queueByAppointmentId.get(full.id));
  }
}
