import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { ENCOUNTER_REACTIVATION_GRACE_MINUTES } from '../../../domain/constants/encounter.constants.js';
import { EncounterStatusEnum } from '../../../domain/enums/index.js';
import { QueueEntryTypeEnum, QueueStatusEnum, MediaOwnerTypeEnum, MediaTypeEnum } from '../../../domain/enums/index.js';

import { CreateQueueEntryDto } from '../../../presentation/dto/queue/create-queue-entry.dto.js';
import { ListQueueQueryDto } from '../../../presentation/dto/queue/list-queue-query.dto.js';
import {
  QueueEntryRecordDto,
  QueueEncounterSummaryDto,
  QueueListResponseDto,
  QueuePaginationMetaDto,
  QueuePatientDto,
  QueueSummaryDto,
  QueueVeterinarianDto,
} from '../../../presentation/dto/queue/queue-response.dto.js';
import { PatientMapper } from '../../mappers/patient.mapper.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(raw: string | Date | null | undefined): string | null {
  if (!raw) return null;
  return String(raw).substring(0, 5); // "HH:MM:SS" → "HH:MM"
}

function formatClockTime(raw: Date | string | null | undefined): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    const hours = String(raw.getHours()).padStart(2, '0');
    const minutes = String(raw.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return formatTime(raw);
}

function formatDate(raw: Date | string): string {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw).substring(0, 10);
}

function formatTimestamp(raw: Date | null | undefined): string {
  if (!raw) return new Date().toISOString();
  return raw instanceof Date ? raw.toISOString() : String(raw);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Minutos transcurridos desde arrivalTime (HH:MM) hasta ahora */
function calcWaitMinutes(entry: QueueEntry): number {
  if (entry.status !== QueueStatusEnum.EN_ESPERA) return 0;
  const [h, m] = (formatClockTime(entry.arrivalTime) ?? '00:00').split(':').map(Number);
  const now = new Date();
  const arrivalToday = new Date();
  arrivalToday.setHours(h, m, 0, 0);
  const diff = Math.floor((now.getTime() - arrivalToday.getTime()) / 60000);
  return Math.max(diff, 0);
}

const QUEUE_STATUS_ORDER: Record<QueueStatusEnum, number> = {
  [QueueStatusEnum.EN_ATENCION]: 0,
  [QueueStatusEnum.EN_ESPERA]: 1,
  [QueueStatusEnum.FINALIZADA]: 2,
  [QueueStatusEnum.CANCELADA]: 3,
};

const QUEUE_ENTRY_TYPE_ORDER: Record<QueueEntryTypeEnum, number> = {
  [QueueEntryTypeEnum.EMERGENCIA]: 0,
  [QueueEntryTypeEnum.CON_CITA]: 1,
  [QueueEntryTypeEnum.SIN_CITA]: 2,
};

function compareNullableTimes(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareDates(left: Date | string, right: Date | string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

// ── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
  ) { }

  private async syncCancelledAppointmentsIntoQueue(): Promise<void> {
    await this.queueRepo.query(
      `
        UPDATE queue_entries AS q
        SET status = $1,
            updated_at = NOW()
        FROM appointments AS a
        WHERE q.appointment_id = a.id
          AND q.deleted_at IS NULL
          AND a.deleted_at IS NULL
          AND q.status = $2
          AND a.status IN ($3, $4)
      `,
      [
        QueueStatusEnum.CANCELADA,
        QueueStatusEnum.EN_ESPERA,
        'CANCELADA',
        'NO_ASISTIO',
      ],
    );
  }

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

  // ── Mapea una QueueEntry a lo que espera el front ──
  private buildEncounterSummary(encounter: Encounter): QueueEncounterSummaryDto {
    const summary = new QueueEncounterSummaryDto();
    const reactivationGraceEndsAt =
      encounter.status === EncounterStatusEnum.FINALIZADA && encounter.endTime
        ? addMinutes(encounter.endTime, ENCOUNTER_REACTIVATION_GRACE_MINUTES)
        : null;

    summary.id = encounter.id;
    summary.status = encounter.status;
    summary.reactivationGraceEndsAt = reactivationGraceEndsAt
      ? formatTimestamp(reactivationGraceEndsAt)
      : null;
    summary.canReactivate = Boolean(
      reactivationGraceEndsAt && reactivationGraceEndsAt.getTime() >= Date.now(),
    );
    return summary;
  }

  private async findEncounterSummariesByQueueEntryIds(
    queueEntryIds: number[],
  ): Promise<Map<number, QueueEncounterSummaryDto>> {
    const encounterByQueueEntryId = new Map<number, QueueEncounterSummaryDto>();

    if (queueEntryIds.length === 0) {
      return encounterByQueueEntryId;
    }

    const encounters = await this.encounterRepo
      .createQueryBuilder('encounter')
      .where('encounter.queueEntryId IN (:...queueEntryIds)', { queueEntryIds })
      .andWhere('encounter.deletedAt IS NULL')
      .orderBy('encounter.queueEntryId', 'ASC')
      .addOrderBy('encounter.updatedAt', 'DESC')
      .addOrderBy('encounter.id', 'DESC')
      .getMany();

    for (const encounter of encounters) {
      if (
        encounter.queueEntryId !== null
        && !encounterByQueueEntryId.has(encounter.queueEntryId)
      ) {
        encounterByQueueEntryId.set(
          encounter.queueEntryId,
          this.buildEncounterSummary(encounter),
        );
      }
    }

    return encounterByQueueEntryId;
  }

  private toDto(
    entry: QueueEntry,
    patientImage?: MediaFile | null,
    encounterSummary?: QueueEncounterSummaryDto | null,
  ): QueueEntryRecordDto {
    const patient = entry.patient;
    const vet = entry.veterinarian;
    const vetPerson = vet?.person;

    const patientDto = new QueuePatientDto();
    patientDto.id = patient?.id ?? entry.patientId;
    patientDto.name = patient?.name ?? '';
    patientDto.species = patient?.species?.name ?? '';
    patientDto.breed = patient?.breed?.name ?? '';

    // Tutor primario
    const primaryTutor = patient?.tutors?.find((t) => !t.deletedAt && t.isPrimary);
    const tutorPerson = primaryTutor?.client?.person;
    patientDto.tutorName = tutorPerson
      ? `${tutorPerson.firstName} ${tutorPerson.lastName}`.trim()
      : '';
    patientDto.tutorPhone = tutorPerson?.phone ?? null;
    patientDto.image = PatientMapper.toImageDto(patientImage);

    const vetDto = new QueueVeterinarianDto();
    vetDto.id = vet?.id ?? entry.vetId;
    vetDto.name = vetPerson
      ? `${vetPerson.firstName} ${vetPerson.lastName}`.trim()
      : '';
    vetDto.code = vet?.code ?? null;

    const dto = new QueueEntryRecordDto();
    dto.id = entry.id;
    dto.date = formatDate(entry.date);
    dto.appointmentId = entry.appointmentId ?? null;
    dto.patient = patientDto;
    dto.veterinarian = vetDto;
    dto.entryType = entry.entryType;
    dto.arrivalTime = formatClockTime(entry.arrivalTime) ?? '';
    dto.scheduledTime = formatTime(entry.scheduledTime) ?? null;
    dto.queueStatus = entry.status;
    dto.notes = entry.notes ?? null;
    dto.encounter = encounterSummary ?? null;
    dto.waitMinutes = calcWaitMinutes(entry);
    dto.createdAt = formatTimestamp(entry.createdAt);
    dto.updatedAt = formatTimestamp(entry.updatedAt);
    return dto;
  }

  private async findImagesByPatientIds(patientIds: number[]): Promise<Map<number, MediaFile>> {
    const imagesByPatientId = new Map<number, MediaFile>();

    if (patientIds.length === 0) {
      return imagesByPatientId;
    }

    const images = await this.mediaFileRepo
      .createQueryBuilder('media')
      .where('media.owner_type = :ownerType', { ownerType: MediaOwnerTypeEnum.PACIENTE })
      .andWhere('media.media_type = :mediaType', { mediaType: MediaTypeEnum.IMAGEN })
      .andWhere('media.is_active = true')
      .andWhere('media.owner_id IN (:...patientIds)', { patientIds })
      .andWhere('media.deleted_at IS NULL')
      .orderBy('media.owner_id', 'ASC')
      .addOrderBy('media.created_at', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .getMany();

    for (const image of images) {
      if (!imagesByPatientId.has(image.ownerId)) {
        imagesByPatientId.set(image.ownerId, image);
      }
    }

    return imagesByPatientId;
  }

  // ── Construye el query base con relaciones ──
  private baseQb() {
    return this.queueRepo
      .createQueryBuilder('q')
      .innerJoinAndSelect('q.patient', 'patient')
      .leftJoinAndSelect('patient.species', 'species')
      .leftJoinAndSelect('patient.breed', 'breed')
      .leftJoinAndSelect(
        'patient.tutors',
        'tutor',
        '"tutor"."is_primary" = true AND "tutor"."deleted_at" IS NULL',
      )
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .innerJoinAndSelect('q.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .where('"q"."deleted_at" IS NULL');
  }

  // ── Ordenamiento de cola en memoria para evitar edge-cases del QueryBuilder con CASE/skip/take ──
  private sortEntries(entries: QueueEntry[]): QueueEntry[] {
    return [...entries].sort((left, right) => {
      const statusOrder =
        (QUEUE_STATUS_ORDER[left.status] ?? Number.MAX_SAFE_INTEGER)
        - (QUEUE_STATUS_ORDER[right.status] ?? Number.MAX_SAFE_INTEGER);
      if (statusOrder !== 0) return statusOrder;

      const typeOrder =
        (QUEUE_ENTRY_TYPE_ORDER[left.entryType] ?? Number.MAX_SAFE_INTEGER)
        - (QUEUE_ENTRY_TYPE_ORDER[right.entryType] ?? Number.MAX_SAFE_INTEGER);
      if (typeOrder !== 0) return typeOrder;

      const scheduledOrder = compareNullableTimes(left.scheduledTime, right.scheduledTime);
      if (scheduledOrder !== 0) return scheduledOrder;

      const arrivalOrder = compareDates(left.arrivalTime, right.arrivalTime);
      if (arrivalOrder !== 0) return arrivalOrder;

      return left.id - right.id;
    });
  }

  // ── Construye el summary ──
  private buildSummary(entries: QueueEntryRecordDto[]): QueueSummaryDto {
    const waiting = entries.filter((e) => e.queueStatus === 'EN_ESPERA');
    const inAttention = entries.filter((e) => e.queueStatus === 'EN_ATENCION');
    const finished = entries.filter((e) => e.queueStatus === 'FINALIZADA');
    const emergencies = entries.filter((e) => e.entryType === 'EMERGENCIA');
    const active = entries.filter(
      (e) => e.queueStatus === 'EN_ESPERA' || e.queueStatus === 'EN_ATENCION',
    );
    const averageWaitMinutes =
      active.length === 0
        ? 0
        : Math.round(active.reduce((sum, e) => sum + e.waitMinutes, 0) / active.length);

    const summary = new QueueSummaryDto();
    summary.totalEntries = entries.length;
    summary.waitingEntries = waiting.length;
    summary.inAttentionEntries = inAttention.length;
    summary.finishedEntries = finished.length;
    summary.emergencyEntries = emergencies.length;
    summary.averageWaitMinutes = averageWaitMinutes;
    summary.currentAttentionEntry = inAttention[0] ?? null;
    summary.nextUpEntry = waiting[0] ?? null;
    return summary;
  }

  // ── GET /queue ──
  async list(query: ListQueueQueryDto): Promise<QueueListResponseDto> {
    await this.syncCancelledAppointmentsIntoQueue();

    const today = new Date();
    const targetDate =
      query.date ?? formatDate(today);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 15, 1), 100);

    // Query para el summary (todo el día + entradas activas de días anteriores)
    const allQb = this.baseQb().andWhere(
      '("q"."date" = :date OR "q"."status" IN (:...activeStatuses))',
      { date: targetDate, activeStatuses: [QueueStatusEnum.EN_ATENCION, QueueStatusEnum.EN_ESPERA] },
    );
    if (query.veterinarianId) {
      allQb.andWhere('"q"."vet_id" = :veterinarianId', {
        veterinarianId: query.veterinarianId,
      });
    }
    const allEntities = this.sortEntries(await allQb.getMany());
    const allEncounterSummariesByQueueEntryId = await this.findEncounterSummariesByQueueEntryIds(
      allEntities.map((entry) => entry.id),
    );
    const allImagesByPatientId = await this.findImagesByPatientIds(
      allEntities.map((entry) => entry.patient?.id ?? entry.patientId),
    );
    const allDtos = allEntities.map((e) =>
      this.toDto(
        e,
        allImagesByPatientId.get(e.patient?.id ?? e.patientId),
        allEncounterSummariesByQueueEntryId.get(e.id) ?? null,
      ),
    );
    const summary = this.buildSummary(allDtos);

    // Query filtrada para la lista paginada
    const filteredQb = this.baseQb().andWhere(
      '("q"."date" = :date OR "q"."status" IN (:...activeStatuses))',
      { date: targetDate, activeStatuses: [QueueStatusEnum.EN_ATENCION, QueueStatusEnum.EN_ESPERA] },
    );

    if (query.veterinarianId) {
      filteredQb.andWhere('"q"."vet_id" = :veterinarianId', {
        veterinarianId: query.veterinarianId,
      });
    }

    if (query.status && query.status !== 'TODOS') {
      filteredQb.andWhere('"q"."status" = :status', { status: query.status });
    }

    if (query.searchTerm?.trim()) {
      const search = `%${query.searchTerm.trim()}%`;
      filteredQb.andWhere(
        `(patient.name ILIKE :search
          OR CONCAT("tutorPerson"."first_name", ' ', "tutorPerson"."last_name") ILIKE :search
          OR "tutorPerson"."phone" ILIKE :search
          OR species.name ILIKE :search
          OR breed.name ILIKE :search
        )`,
        { search },
      );
    }

    const filteredEntities = this.sortEntries(await filteredQb.getMany());
    const total = filteredEntities.length;
    const entities = filteredEntities.slice((page - 1) * limit, page * limit);
    const encounterSummariesByQueueEntryId = await this.findEncounterSummariesByQueueEntryIds(
      entities.map((entry) => entry.id),
    );
    const imagesByPatientId = await this.findImagesByPatientIds(
      entities.map((entry) => entry.patient?.id ?? entry.patientId),
    );

    const dtos = entities.map((e) =>
      this.toDto(
        e,
        imagesByPatientId.get(e.patient?.id ?? e.patientId),
        encounterSummariesByQueueEntryId.get(e.id) ?? null,
      ),
    );

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    const currentPage = Math.min(page, totalPages);

    const meta = new QueuePaginationMetaDto();
    meta.totalItems = total;
    meta.itemCount = dtos.length;
    meta.itemsPerPage = limit;
    meta.totalPages = totalPages;
    meta.currentPage = currentPage;
    meta.hasNextPage = currentPage < totalPages;
    meta.hasPrevPage = currentPage > 1;

    const response = new QueueListResponseDto();
    response.data = dtos;
    response.meta = meta;
    response.summary = summary;
    return response;
  }

  // ── POST /queue ──
  async create(dto: CreateQueueEntryDto, userId: number): Promise<QueueEntryRecordDto> {
    // 1) Validar paciente
    const patient = await this.patientRepo.findOne({ where: { id: dto.patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    // 1b) Verificar que el paciente no tenga ya una entrada activa hoy
    const today = formatDate(new Date());
    const existingActive = await this.queueRepo.findOne({
      where: [
        { patientId: dto.patientId, date: today as unknown as Date, status: QueueStatusEnum.EN_ESPERA },
        { patientId: dto.patientId, date: today as unknown as Date, status: QueueStatusEnum.EN_ATENCION },
      ],
    });
    if (existingActive && !existingActive.deletedAt) {
      throw new BadRequestException(
        'El paciente ya se encuentra en la lista de espera de hoy.',
      );
    }

    let linkedAppointment: Appointment | null = null;
    if (dto.appointmentId) {
      linkedAppointment = await this.appointmentRepo.findOne({
        where: { id: dto.appointmentId },
      });
      if (!linkedAppointment || linkedAppointment.deletedAt) {
        throw new NotFoundException('Cita no encontrada.');
      }
      if (linkedAppointment.patientId !== dto.patientId) {
        throw new BadRequestException(
          'La cita seleccionada no corresponde al paciente indicado.',
        );
      }
      if (
        ['FINALIZADA', 'CANCELADA', 'NO_ASISTIO'].includes(linkedAppointment.status as any)
      ) {
        throw new BadRequestException(
          'La cita enlazada no puede registrarse en la cola por su estado actual.',
        );
      }
      if (formatDate(linkedAppointment.scheduledDate) !== formatDate(new Date())) {
        throw new BadRequestException(
          'Solo se puede registrar llegada en cola para citas del día actual.',
        );
      }
      if (!linkedAppointment.scheduledTime || !linkedAppointment.endTime) {
        throw new BadRequestException(
          'La cita de control aún no tiene hora confirmada y no puede registrarse en cola.',
        );
      }
      if (
        dto.veterinarianId &&
        dto.veterinarianId !== linkedAppointment.vetId
      ) {
        throw new BadRequestException(
          'La cita ya está asignada a otro veterinario.',
        );
      }

      const existingEntry = await this.queueRepo.findOne({
        where: { appointmentId: linkedAppointment.id },
      });
      if (existingEntry && !existingEntry.deletedAt) {
        return this.findOneDto(existingEntry.id);
      }
    }

    // 2) Resolver veterinario
    let vetId: number;
    if (linkedAppointment) {
      vetId = linkedAppointment.vetId;
    } else if (dto.veterinarianId) {
      const vet = await this.employeeRepo.findOne({ where: { id: dto.veterinarianId } });
      if (!vet || vet.deletedAt) throw new NotFoundException('Veterinario no encontrado.');
      vetId = vet.id;
    } else {
      vetId = await this.resolveVetId(userId);
    }

    // 3) Crear la entrada
    const now = new Date();
    const entry = this.queueRepo.create({
      date: formatDate(now) as unknown as Date,
      patientId: dto.patientId,
      vetId,
      appointmentId: linkedAppointment?.id ?? dto.appointmentId ?? null,
      entryType: linkedAppointment ? QueueEntryTypeEnum.CON_CITA : dto.entryType,
      arrivalTime: now,
      scheduledTime: linkedAppointment?.scheduledTime ?? dto.scheduledTime ?? null,
      notes: dto.notes?.trim() ?? null,
      status: QueueStatusEnum.EN_ESPERA,
    });
    const saved = await this.queueRepo.save(entry);

    // 4) Recargar con relaciones
    return this.findOneDto(saved.id);
  }

  // ── PATCH /queue/:id/start ──
  async startAttention(id: number): Promise<QueueEntryRecordDto> {
    const entry = await this.queueRepo.findOne({ where: { id } });
    if (!entry || entry.deletedAt) throw new NotFoundException('Entrada no encontrada.');
    if (entry.status === QueueStatusEnum.EN_ATENCION) {
      return this.findOneDto(id);
    }
    if (entry.status !== QueueStatusEnum.EN_ESPERA) {
      throw new BadRequestException('Solo se puede iniciar una atención que esté en espera.');
    }

    // Verificar que el mismo paciente no tenga ya otra entrada EN_ATENCION hoy
    const activeAttention = await this.queueRepo.findOne({
      where: { patientId: entry.patientId, status: QueueStatusEnum.EN_ATENCION, date: entry.date },
    });
    if (activeAttention && activeAttention.id !== id) {
      throw new BadRequestException(
        'El paciente ya tiene una atención en curso.',
      );
    }

    if (entry.appointmentId) {
      const appointment = await this.appointmentRepo.findOne({
        where: { id: entry.appointmentId },
      });
      if (
        appointment
        && !appointment.deletedAt
        && ['CANCELADA', 'NO_ASISTIO'].includes(appointment.status as any)
      ) {
        await this.queueRepo.update(id, { status: QueueStatusEnum.CANCELADA });
        throw new BadRequestException(
          'La cita enlazada fue cancelada o marcada como no asistió. El ingreso en cola se canceló automáticamente.',
        );
      }
    }

    await this.queueRepo.update(id, { status: QueueStatusEnum.EN_ATENCION });
    if (entry.appointmentId) {
      await this.appointmentRepo.update(entry.appointmentId, { status: 'EN_PROCESO' as any });
    }
    return this.findOneDto(id);
  }

  // ── PATCH /queue/:id/finish ──
  async finishAttention(id: number): Promise<QueueEntryRecordDto> {
    const entry = await this.queueRepo.findOne({ where: { id } });
    if (!entry || entry.deletedAt) throw new NotFoundException('Entrada no encontrada.');
    if (entry.status !== QueueStatusEnum.EN_ATENCION) {
      throw new BadRequestException('Solo se puede finalizar una atención que ya inició.');
    }
    await this.queueRepo.update(id, { status: QueueStatusEnum.FINALIZADA });
    if (entry.appointmentId) {
      await this.appointmentRepo.update(entry.appointmentId, { status: 'FINALIZADA' as any });
    }
    return this.findOneDto(id);
  }

  // ── PATCH /queue/:id/cancel ──
  async cancelEntry(id: number): Promise<QueueEntryRecordDto> {
    const entry = await this.queueRepo.findOne({ where: { id } });
    if (!entry || entry.deletedAt) throw new NotFoundException('Entrada no encontrada.');
    if (entry.status !== QueueStatusEnum.EN_ESPERA) {
      throw new BadRequestException('Solo se puede cancelar un ingreso que esté en espera.');
    }
    await this.queueRepo.update(id, { status: QueueStatusEnum.CANCELADA });
    return this.findOneDto(id);
  }

  // ── Helper: recarga una entrada con todas sus relaciones ──
  private async findOneDto(id: number): Promise<QueueEntryRecordDto> {
    const full = await this.baseQb().andWhere('q.id = :id', { id }).getOne();
    if (!full) throw new NotFoundException('Entrada de cola no encontrada.');
    const imagesByPatientId = await this.findImagesByPatientIds([
      full.patient?.id ?? full.patientId,
    ]);
    const encounterSummariesByQueueEntryId = await this.findEncounterSummariesByQueueEntryIds([
      full.id,
    ]);
    return this.toDto(
      full,
      imagesByPatientId.get(full.patient?.id ?? full.patientId),
      encounterSummariesByQueueEntryId.get(full.id) ?? null,
    );
  }
}
