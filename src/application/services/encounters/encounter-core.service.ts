import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EDITABLE_ENCOUNTER_STATUSES } from '../../../domain/constants/encounter.constants.js';
import { CreateEncounterDto } from '../../../presentation/dto/encounters/create-encounter.dto.js';
import { CloseEncounterDto } from '../../../presentation/dto/encounters/update-encounter-status.dto.js';
import {
  EncounterListItemDto,
  EncounterResponseDto,
} from '../../../presentation/dto/encounters/encounter-response.dto.js';
import { EncounterMapper } from '../../mappers/encounter.mapper.js';
import { EncounterStatusEnum, QueueStatusEnum } from '../../../domain/enums/index.js';
import { EncounterSharedService } from './encounter-shared.service.js';
import { EncounterTreatmentService } from './encounter-treatment.service.js';
import { EncounterActionDraftService } from './encounter-action-draft.service.js';
import { ClinicalCasesService } from '../clinical-cases/clinical-cases.service.js';

@Injectable()
export class EncounterCoreService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    private readonly dataSource: DataSource,
    private readonly sharedService: EncounterSharedService,
    private readonly treatmentService: EncounterTreatmentService,
    private readonly draftService: EncounterActionDraftService,
    private readonly clinicalCasesService: ClinicalCasesService,
  ) {}

  /**
   * Crea una nueva atención clínica validando paciente y veterinario responsable.
   */
  async create(
    dto: CreateEncounterDto,
    userId: number,
    roles: string[],
  ): Promise<EncounterResponseDto> {
    let patientId = dto.patientId;
    let vetId = dto.vetId;
    let appointmentId = dto.appointmentId ?? null;
    let startTime = dto.startTime ? new Date(dto.startTime) : new Date();

    if (dto.queueEntryId) {
      const existingEncounter = await this.encounterRepo.findOne({
        where: {
          queueEntryId: dto.queueEntryId,
          status: In([...EDITABLE_ENCOUNTER_STATUSES]),
        },
      });
      if (existingEncounter && !existingEncounter.deletedAt) {
        return this.findOne(existingEncounter.id);
      }

      const queueEntry = await this.queueRepo.findOne({ where: { id: dto.queueEntryId } });
      if (!queueEntry || queueEntry.deletedAt) {
        throw new NotFoundException('Entrada de cola no encontrada.');
      }
      if (queueEntry.status === QueueStatusEnum.CANCELADA) {
        throw new BadRequestException(
          'No se puede iniciar una consulta desde una entrada de cola cancelada.',
        );
      }
      if (queueEntry.appointmentId) {
        const linkedAppointment = await this.appointmentRepo.findOne({
          where: { id: queueEntry.appointmentId },
        });
        if (
          linkedAppointment
          && !linkedAppointment.deletedAt
          && ['CANCELADA', 'NO_ASISTIO'].includes(linkedAppointment.status as any)
        ) {
          await this.queueRepo.update(queueEntry.id, { status: QueueStatusEnum.CANCELADA });
          throw new BadRequestException(
            'La cita enlazada fue cancelada o marcada como no asistió. El ingreso en cola se canceló automáticamente.',
          );
        }
      }

      patientId = patientId ?? queueEntry.patientId;
      vetId = vetId ?? queueEntry.vetId;
      appointmentId = appointmentId ?? queueEntry.appointmentId ?? null;
      startTime = dto.startTime ? new Date(dto.startTime) : new Date();

      const isPureMvz = roles.includes('MVZ') && !roles.includes('ADMIN');
      if (isPureMvz && vetId) {
        const assignedEmployee = await this.sharedService.findEmployeeById(vetId);
        if (!assignedEmployee || assignedEmployee.deletedAt || !assignedEmployee.isVeterinarian) {
          const currentVet = await this.sharedService.findVeterinarianEmployeeForUser(userId);
          vetId = currentVet.id;

          await this.queueRepo.update(queueEntry.id, { vetId: currentVet.id });

          if (appointmentId) {
            await this.appointmentRepo.update(appointmentId, { vetId: currentVet.id });
          }
        }
      }
    }

    if (!patientId || !vetId) {
      throw new BadRequestException(
        'Debes indicar paciente y veterinario, o bien iniciar la consulta desde una entrada en cola válida.',
      );
    }
    if (Number.isNaN(startTime.getTime())) {
      throw new BadRequestException('La hora de inicio de la atención no es válida.');
    }

    await this.sharedService.findPatientOrFail(patientId);
    await this.sharedService.ensureVetCanCreateEncounter(vetId, userId, roles);

    const encounter = this.encounterRepo.create({
      patientId,
      vetId,
      startTime,
      appointmentId,
      queueEntryId: dto.queueEntryId ?? null,
      generalNotes: dto.generalNotes ?? null,
      status: EncounterStatusEnum.ACTIVA,
      createdByUserId: userId,
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const savedEncounter = await manager.getRepository(Encounter).save(encounter);

      if (appointmentId) {
        const clinicalCaseId = await this.clinicalCasesService.attachCaseFromFollowUpAppointment(
          appointmentId,
          savedEncounter.id,
          manager,
        );
        if (clinicalCaseId) {
          savedEncounter.clinicalCaseId = clinicalCaseId;
        }
      }

      return savedEncounter;
    });
    return this.findOne(saved.id);
  }

  /**
   * Lista atenciones con paginación simple y filtro opcional por paciente.
   */
  async findAll(
    patientId?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: EncounterListItemDto[]; total: number; page: number; limit: number }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const qb = this.encounterRepo
      .createQueryBuilder('e')
      .where('e.deleted_at IS NULL')
      .orderBy('e.start_time', 'DESC')
      .skip(skip)
      .take(take);

    if (patientId) {
      qb.andWhere('e.patient_id = :patientId', { patientId });
    }

    const [encounters, total] = await qb.getManyAndCount();

    return {
      data: encounters.map(EncounterMapper.toListItemDto),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  /**
   * Devuelve la atención completa y sincroniza antes los tratamientos vencidos.
   */
  async findOne(id: number): Promise<EncounterResponseDto> {
    await this.treatmentService.syncEncounterTreatmentStatuses(id);
    const encounter = await this.sharedService.findEncounterOrFail(id);
    const response = EncounterMapper.toResponseDto(encounter);
    response.clinicalCaseSummary = await this.clinicalCasesService.buildEncounterClinicalCaseSummary(
      encounter.id,
    );
    return response;
  }

  /**
   * Finaliza una atención validando que la hora de cierre no sea inválida.
   */
  async closeEncounter(
    id: number,
    dto: CloseEncounterDto,
    userId: number,
  ): Promise<EncounterResponseDto> {
    const encounter = await this.sharedService.findEncounterOrFail(id);
    this.sharedService.ensureActive(encounter);

    if (!encounter.consultationReason?.consultationReason?.trim()) {
      throw new BadRequestException(
        'No se puede finalizar la atención sin registrar el motivo de consulta.',
      );
    }

    const endTime = new Date(dto.endTime);
    if (endTime < encounter.startTime) {
      throw new BadRequestException(
        'La hora de finalización no puede ser anterior a la hora de inicio.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const clinicalCase = await this.clinicalCasesService.prepareEncounterFinalization(
        encounter,
        manager,
      );
      if (clinicalCase) {
        encounter.clinicalCaseId = clinicalCase.id;
      }

      await this.draftService.materializeDrafts(encounter, manager);
      await this.clinicalCasesService.finalizeEncounterClinicalCase(
        encounter,
        endTime,
        dto.controlAppointment,
        manager,
      );

      await manager.update(Encounter, id, {
        status: EncounterStatusEnum.FINALIZADA,
        endTime,
        generalNotes: dto.generalNotes ?? encounter.generalNotes,
        clinicalCaseId: encounter.clinicalCaseId ?? null,
        updatedAt: new Date(),
      });

      if (encounter.queueEntryId) {
        await manager.update(QueueEntry, encounter.queueEntryId, {
          status: QueueStatusEnum.FINALIZADA,
        });
      }

      if (encounter.appointmentId) {
        await manager.update(Appointment, encounter.appointmentId, {
          status: 'FINALIZADA' as any,
        });
      }
    });

    return this.findOne(id);
  }

  async reactivateEncounter(id: number, userId: number): Promise<EncounterResponseDto> {
    const encounter = await this.sharedService.findEncounterOrFail(id);
    this.sharedService.ensureCanReactivate(encounter);

    await this.dataSource.transaction(async (manager) => {
      await this.draftService.restoreDraftsFromMaterializedActions(encounter, userId, manager);
      await this.clinicalCasesService.reactivateEncounterClinicalCaseEffects(
        encounter,
        userId,
        manager,
      );

      await manager.update(Encounter, id, {
        status: EncounterStatusEnum.REACTIVADA,
        endTime: null,
        updatedAt: new Date(),
      });

      if (encounter.queueEntryId) {
        await manager.update(QueueEntry, encounter.queueEntryId, {
          status: QueueStatusEnum.EN_ATENCION,
        });
      }

      if (encounter.appointmentId) {
        await manager.update(Appointment, encounter.appointmentId, {
          status: 'EN_PROCESO' as any,
        });
      }
    });

    return this.findOne(id);
  }

  /**
   * Anula una atención activa sin eliminar su historial.
   */
  async cancelEncounter(id: number): Promise<EncounterResponseDto> {
    const encounter = await this.sharedService.findEncounterOrFail(id);
    this.sharedService.ensureActive(encounter);

    await this.dataSource.transaction(async (manager) => {
      await this.draftService.deleteAllDrafts(id, manager);
      await manager.update(Encounter, id, {
        status: EncounterStatusEnum.ANULADA,
        updatedAt: new Date(),
      });
    });

    return this.findOne(id);
  }
}
