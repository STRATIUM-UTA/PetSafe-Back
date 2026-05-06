import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentRequest } from '../../../domain/entities/appointments/appointment-request.entity.js';
import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { AppointmentReasonEnum, AppointmentRequestStatusEnum, AppointmentStatusEnum } from '../../../domain/enums/index.js';
import { CreateAppointmentRequestDto } from '../../../presentation/dto/appointment-requests/create-appointment-request.dto.js';
import { UpdateAppointmentRequestStatusDto } from '../../../presentation/dto/appointment-requests/update-appointment-request-status.dto.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { FcmPushService } from '../notifications/fcm-push.service.js';
import { DeviceTokenService } from '../notifications/device-token.service.js';
import { UserNotificationService } from '../notifications/user-notification.service.js';

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

@Injectable()
export class AppointmentRequestsService {
  constructor(
    @InjectRepository(AppointmentRequest)
    private readonly repo: Repository<AppointmentRequest>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly gateway: NotificationsGateway,
    private readonly fcm: FcmPushService,
    private readonly deviceTokens: DeviceTokenService,
    private readonly userNotifications: UserNotificationService,
  ) {}

  async create(
    dto: CreateAppointmentRequestDto,
    clientUserId: number,
  ): Promise<AppointmentRequest> {
    const existing = await this.repo.findOne({
      where: { clientUserId, status: AppointmentRequestStatusEnum.PENDIENTE },
    });
    if (existing) {
      throw new ConflictException('Ya tienes una solicitud de cita pendiente. Espera a que sea procesada.');
    }

    const request = this.repo.create({
      clientUserId,
      patientId: dto.patientId ?? null,
      reason: dto.reason,
      preferredDate: dto.preferredDate ?? null,
      preferredTime: dto.preferredTime ?? null,
      status: AppointmentRequestStatusEnum.PENDIENTE,
    });

    const saved = await this.repo.save(request);

    const loaded = await this.repo.findOne({
      where: { id: saved.id },
      relations: ['clientUser', 'clientUser.person', 'patient'],
    });

    const person = loaded?.clientUser?.person;
    const clientName = person
      ? `${person.firstName} ${person.lastName}`.trim()
      : 'Cliente';
    const patientName = loaded?.patient?.name ?? null;

    this.gateway.emitNewAppointmentRequest({
      id: saved.id,
      clientName,
      patientName,
      reason: saved.reason,
      preferredDate: saved.preferredDate,
      preferredTime: saved.preferredTime,
      createdAt: saved.createdAt,
    });

    return loaded ?? saved;
  }

  async findAll(): Promise<AppointmentRequest[]> {
    return this.repo.find({
      relations: ['clientUser', 'clientUser.person', 'patient'],
      order: { createdAt: 'DESC' },
    });
  }

  async checkAvailability(
    date: string,
    time: string,
    reviewerUserId: number,
  ): Promise<{ available: boolean; message?: string }> {
    if (!date || !time) return { available: true };
    const reviewer = await this.userRepo.findOne({ where: { id: reviewerUserId } });
    if (!reviewer) return { available: true };
    const employee = await this.employeeRepo.findOne({ where: { personId: reviewer.personId } });
    if (!employee) return { available: true };

    const normalizedTime = time.substring(0, 5);
    const endTime = addMinutes(normalizedTime, 30);

    const conflict = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('a.id')
      .where('"a"."vet_id" = :vetId', { vetId: employee.id })
      .andWhere('"a"."scheduled_date" = :date', { date })
      .andWhere('"a"."deleted_at" IS NULL')
      .andWhere('"a"."status" IN (:...statuses)', { statuses: ['PROGRAMADA', 'CONFIRMADA', 'EN_PROCESO'] })
      .andWhere('"a"."scheduled_time" < :end', { end: endTime })
      .andWhere('"a"."end_time" > :start', { start: normalizedTime })
      .getOne();

    if (conflict) {
      return { available: false, message: `Conflicto: ya existe una cita el ${date} a las ${normalizedTime}.` };
    }
    return { available: true };
  }

  async countPending(): Promise<number> {
    return this.repo.count({
      where: { status: AppointmentRequestStatusEnum.PENDIENTE, isActive: true },
    });
  }

  async findByClient(clientUserId: number): Promise<AppointmentRequest[]> {
    return this.repo.find({
      where: { clientUserId },
      relations: ['patient'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: number,
    dto: UpdateAppointmentRequestStatusDto,
    reviewerUserId: number,
  ): Promise<AppointmentRequest> {
    const request = await this.repo.findOne({
      where: { id },
      relations: ['clientUser'],
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada.');

    if (request.status !== AppointmentRequestStatusEnum.PENDIENTE) {
      throw new ForbiddenException('Solo se pueden actualizar solicitudes pendientes.');
    }

    if (dto.status === AppointmentRequestStatusEnum.CONFIRMADA) {
      await this.confirmAndCreateAppointment(request, dto, reviewerUserId);
    }

    request.status = dto.status;
    request.staffNotes = dto.staffNotes ?? null;
    request.reviewedByUserId = reviewerUserId;

    const saved = await this.repo.save(request);

    this.gateway.emitAppointmentRequestStatusUpdated({
      id: saved.id,
      status: saved.status,
      staffNotes: saved.staffNotes,
    });

    const tokens = await this.deviceTokens.getTokensForUser(request.clientUserId);
    const isConfirmed = dto.status === AppointmentRequestStatusEnum.CONFIRMADA;
    const statusLabel = isConfirmed ? 'confirmada' : 'rechazada';
    const finalDate = dto.scheduledDate ?? request.preferredDate;
    const finalTime = (dto.scheduledTime ?? request.preferredTime)?.substring(0, 5);
    const dateStr = finalDate && finalTime ? ` para el ${finalDate} a las ${finalTime}` : '';
    const notifTitle = isConfirmed ? '✅ Cita confirmada' : '❌ Solicitud rechazada';
    const notifBody = `Tu solicitud fue ${statusLabel}${isConfirmed ? dateStr : ''}.${dto.staffNotes ? ` Nota del veterinario: ${dto.staffNotes}` : ''}`;

    await Promise.all([
      this.fcm.sendToTokens({ tokens, title: notifTitle, body: notifBody, data: { requestId: String(id), status: dto.status } }),
      this.userNotifications.create({ userId: request.clientUserId, title: notifTitle, body: notifBody, referenceType: 'APPOINTMENT_REQUEST', referenceId: id }),
    ]);

    return saved;
  }

  private async confirmAndCreateAppointment(
    request: AppointmentRequest,
    dto: UpdateAppointmentRequestStatusDto,
    reviewerUserId: number,
  ): Promise<void> {
    const scheduledDate = dto.scheduledDate ?? request.preferredDate;
    const rawTime = dto.scheduledTime ?? request.preferredTime;
    const scheduledTime = rawTime?.substring(0, 5) ?? null;

    if (!scheduledDate || !scheduledTime || !request.patientId) return;

    const reviewer = await this.userRepo.findOne({ where: { id: reviewerUserId } });
    if (!reviewer) return;

    const employee = await this.employeeRepo.findOne({ where: { personId: reviewer.personId } });
    if (!employee) return;

    const endTime = addMinutes(scheduledTime, 30);

    const conflict = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('a.id')
      .where('"a"."vet_id" = :vetId', { vetId: employee.id })
      .andWhere('"a"."scheduled_date" = :date', { date: scheduledDate })
      .andWhere('"a"."deleted_at" IS NULL')
      .andWhere('"a"."status" IN (:...statuses)', { statuses: ['PROGRAMADA', 'CONFIRMADA', 'EN_PROCESO'] })
      .andWhere('"a"."scheduled_time" < :end', { end: endTime })
      .andWhere('"a"."end_time" > :start', { start: scheduledTime })
      .getOne();

    if (conflict) {
      throw new ConflictException(
        `Conflicto de horario: ya existe una cita el ${scheduledDate} a las ${scheduledTime}. Elige otra fecha u hora.`,
      );
    }

    await this.appointmentRepo.save(
      this.appointmentRepo.create({
        patientId: request.patientId,
        vetId: employee.id,
        scheduledDate,
        scheduledTime,
        endTime,
        reason: AppointmentReasonEnum.CONSULTA_GENERAL,
        notes: dto.staffNotes ?? null,
        createdByUserId: reviewerUserId,
        status: AppointmentStatusEnum.PROGRAMADA,
      }),
    );
  }
}
