import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ObjectLiteral, Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { ClinicalCase } from '../../../domain/entities/encounters/clinical-case.entity.js';
import { ClinicalCaseFollowUp } from '../../../domain/entities/encounters/clinical-case-follow-up.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EncounterTreatmentReviewDraft } from '../../../domain/entities/encounters/encounter-treatment-review-draft.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentEvolutionEvent } from '../../../domain/entities/encounters/treatment-evolution-event.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import {
  AppointmentReasonEnum,
  AppointmentStatusEnum,
  ClinicalCasePlanLinkModeEnum,
  ClinicalCaseFollowUpStatusEnum,
  ClinicalCaseStatusEnum,
  EncounterClinicalCaseLinkModeEnum,
  EncounterFollowUpActionEnum,
  TreatmentEvolutionEventTypeEnum,
  TreatmentItemStatusEnum,
  TreatmentStatusEnum,
} from '../../../domain/enums/index.js';
import {
  ClinicalCaseActiveTreatmentDto,
  ClinicalCaseConsultationSummaryDto,
  ClinicalCaseDetailDto,
  ClinicalCaseFollowUpDetailDto,
  ClinicalCaseLastEvolutionDto,
  ClinicalCaseNextFollowUpDto,
  ClinicalCaseSummaryDto,
} from '../../../presentation/dto/clinical-cases/clinical-case-response.dto.js';
import { ScheduleControlAppointmentDto } from '../../../presentation/dto/encounters/schedule-control-appointment.dto.js';
import { UpsertClinicalCaseLinkDto } from '../../../presentation/dto/encounters/upsert-clinical-case-link.dto.js';
import { EncounterSharedService } from '../encounters/encounter-shared.service.js';

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
};

const normalizeDateValue = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

@Injectable()
export class ClinicalCasesService {
  constructor(
    @InjectRepository(ClinicalCase)
    private readonly clinicalCaseRepo: Repository<ClinicalCase>,
    @InjectRepository(ClinicalCaseFollowUp)
    private readonly followUpRepo: Repository<ClinicalCaseFollowUp>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(EncounterTreatmentReviewDraft)
    private readonly treatmentReviewDraftRepo: Repository<EncounterTreatmentReviewDraft>,
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(TreatmentItem)
    private readonly treatmentItemRepo: Repository<TreatmentItem>,
    @InjectRepository(TreatmentEvolutionEvent)
    private readonly treatmentEvolutionEventRepo: Repository<TreatmentEvolutionEvent>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly sharedService: EncounterSharedService,
  ) {}

  async listByPatient(patientId: number): Promise<ClinicalCaseSummaryDto[]> {
    await this.ensurePatientExists(patientId);
    const cases = await this.clinicalCaseRepo.find({
      where: { patientId },
      order: { openedAt: 'DESC', id: 'DESC' },
      relations: this.summaryRelations(),
    });

    return cases
      .filter((clinicalCase) => !clinicalCase.deletedAt)
      .map((clinicalCase) => this.toClinicalCaseSummaryDto(clinicalCase));
  }

  async findOne(caseId: number): Promise<ClinicalCaseDetailDto> {
    const clinicalCase = await this.findClinicalCaseOrFail(caseId);
    return this.toClinicalCaseDetailDto(clinicalCase);
  }

  async findFollowUps(caseId: number): Promise<ClinicalCaseFollowUpDetailDto[]> {
    const clinicalCase = await this.findClinicalCaseOrFail(caseId);
    return this.buildFollowUpDtos(clinicalCase);
  }

  async updateStatus(
    caseId: number,
    status: ClinicalCaseStatusEnum,
  ): Promise<ClinicalCaseDetailDto> {
    await this.dataAwareTransaction(async (manager) => {
      const clinicalCase = await this.findClinicalCaseOrFail(caseId, manager);

      if (status === clinicalCase.status) {
        return;
      }

      if (
        status === ClinicalCaseStatusEnum.CERRADO
        || status === ClinicalCaseStatusEnum.CANCELADO
      ) {
        await this.cancelPendingFollowUpsForCase(clinicalCase.id, manager);
      }

      const patch: Partial<ClinicalCase> = {
        status,
        closedAt: status === ClinicalCaseStatusEnum.CERRADO ? new Date() : null,
        canceledAt: status === ClinicalCaseStatusEnum.CANCELADO ? new Date() : null,
      };

      if (status === ClinicalCaseStatusEnum.ABIERTO) {
        patch.closedAt = null;
        patch.canceledAt = null;
      }

      await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).update(caseId, patch);
    });

    return this.findOne(caseId);
  }

  async buildEncounterClinicalCaseSummary(encounterId: number): Promise<ClinicalCaseSummaryDto | null> {
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId },
      select: ['id', 'clinicalCaseId'],
    });

    if (!encounter || !encounter.clinicalCaseId) {
      return null;
    }

    const clinicalCase = await this.findClinicalCaseOrFail(encounter.clinicalCaseId);
    return this.toClinicalCaseSummaryDto(clinicalCase);
  }

  async upsertEncounterClinicalCaseLink(
    encounterId: number,
    dto: UpsertClinicalCaseLinkDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);

    if (encounter.status === 'ANULADA') {
      throw new BadRequestException(
        'No se puede vincular una atención anulada a un caso clínico.',
      );
    }

    await this.dataAwareTransaction(async (manager) => {
      if (dto.mode === EncounterClinicalCaseLinkModeEnum.UNLINK) {
        if (!this.sharedService.isEditableStatus(encounter.status)) {
          throw new ConflictException(
            'Solo puedes desvincular un caso clínico mientras la atención siga editable.',
          );
        }

        if (!encounter.clinicalCaseId) {
          return;
        }

        await this.detachEncounterFromClinicalCase(encounter, manager);
        return;
      }

      if (encounter.clinicalCaseId) {
        if (
          dto.mode === EncounterClinicalCaseLinkModeEnum.EXISTING
          && dto.clinicalCaseId === encounter.clinicalCaseId
        ) {
          return;
        }

        throw new ConflictException(
          'La atención ya está vinculada a un caso clínico. Desvincúlala primero si quieres cambiarla.',
        );
      }

      if (dto.mode === EncounterClinicalCaseLinkModeEnum.EXISTING) {
        if (!dto.clinicalCaseId) {
          throw new BadRequestException('Debes elegir el caso clínico existente a vincular.');
        }

        const existingCase = await this.ensureOpenCaseForPatient(
          encounter.patientId,
          dto.clinicalCaseId,
          manager,
        );
        await this.persistEncounterClinicalCaseLink(encounter.id, existingCase.id, manager);
        return;
      }

      if (!dto.problemSummary?.trim()) {
        throw new BadRequestException(
          'Debes resumir el problema clínico para abrir un caso nuevo.',
        );
      }

      const createdCase = await this.createClinicalCaseFromEncounter(
        encounter,
        dto.problemSummary,
        manager,
      );
      await this.persistEncounterClinicalCaseLink(encounter.id, createdCase.id, manager);
    });
  }

  async scheduleFollowUpForCase(
    clinicalCaseId: number,
    payload: ScheduleControlAppointmentDto,
    userId: number | null,
  ): Promise<ClinicalCaseDetailDto> {
    await this.dataAwareTransaction(async (manager) => {
      const clinicalCase = await this.findClinicalCaseOrFail(clinicalCaseId, manager);

      if (clinicalCase.status !== ClinicalCaseStatusEnum.ABIERTO) {
        throw new BadRequestException(
          'Solo puedes programar controles para un caso clínico abierto.',
        );
      }

      await this.ensureCaseHasNoPendingFollowUp(clinicalCase.id, manager);

      const latestEncounter = this.latestEncounterForCase(clinicalCase);
      if (!latestEncounter) {
        throw new BadRequestException(
          'No existe una consulta base desde la cual programar el control clínico.',
        );
      }

      const appointment = await this.createControlAppointment(
        clinicalCase.patientId,
        latestEncounter.vetId,
        latestEncounter.id,
        clinicalCase.problemSummary,
        latestEncounter.plan?.planNotes ?? null,
        payload,
        userId,
        manager,
      );

      await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).save(
        this.followUpRepo.create({
          clinicalCaseId: clinicalCase.id,
          sourceEncounterId: latestEncounter.id,
          generatedAppointmentId: appointment.id,
          targetEncounterId: null,
          suggestedDate: new Date(payload.scheduledDate),
          status: ClinicalCaseFollowUpStatusEnum.PROGRAMADO,
        }),
      );
    });

    return this.findOne(clinicalCaseId);
  }

  async attachCaseFromFollowUpAppointment(
    appointmentId: number | null,
    encounterId: number,
    manager: EntityManager,
  ): Promise<number | null> {
    if (!appointmentId) {
      return null;
    }

    const followUp = await this.getRepo(
      ClinicalCaseFollowUp,
      this.followUpRepo,
      manager,
    ).findOne({
      where: {
        generatedAppointmentId: appointmentId,
      },
    });

    if (!followUp || followUp.deletedAt) {
      return null;
    }

    await this.getRepo(Encounter, this.encounterRepo, manager).update(encounterId, {
      clinicalCaseId: followUp.clinicalCaseId,
    });

    await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).update(followUp.id, {
      targetEncounterId: encounterId,
      status: ClinicalCaseFollowUpStatusEnum.EN_ATENCION,
    });

    return followUp.clinicalCaseId;
  }

  async prepareEncounterFinalization(
    encounter: Encounter,
    manager: EntityManager,
  ): Promise<ClinicalCase | null> {
    const action = encounter.followUpConfig?.action ?? EncounterFollowUpActionEnum.NONE;

    if (action !== EncounterFollowUpActionEnum.NONE && !encounter.clinicalCaseId) {
      throw new BadRequestException(
        'Debes vincular la consulta a un caso clínico antes de configurar su seguimiento.',
      );
    }

    if (!encounter.clinicalCaseId) {
      return null;
    }

    return this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager);
  }

  async finalizeEncounterClinicalCase(
    encounter: Encounter,
    closureTime: Date,
    controlAppointment: ScheduleControlAppointmentDto | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const clinicalCase = encounter.clinicalCaseId
      ? await this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager)
      : null;

    await this.processTreatmentReviewDrafts(encounter, closureTime, manager);
    await this.processTreatmentReplacements(encounter, closureTime, manager);

    if (!clinicalCase) {
      return;
    }

    await this.completeCurrentFollowUpIfNeeded(encounter.id, manager);
    const action = encounter.followUpConfig?.action ?? EncounterFollowUpActionEnum.NONE;

    if (action === EncounterFollowUpActionEnum.RESOLVE) {
      if (controlAppointment) {
        throw new BadRequestException(
          'No puedes programar un turno de control cuando el caso se marca como resuelto.',
        );
      }

      await this.cancelPendingFollowUpsForCase(clinicalCase.id, manager);
      await this.updateClinicalCaseStatus(
        clinicalCase.id,
        ClinicalCaseStatusEnum.CERRADO,
        closureTime,
        manager,
      );
      return;
    }

    if (action === EncounterFollowUpActionEnum.CANCEL) {
      if (controlAppointment) {
        throw new BadRequestException(
          'No puedes programar un turno de control cuando el caso se cancela.',
        );
      }

      await this.cancelPendingFollowUpsForCase(clinicalCase.id, manager);
      await this.updateClinicalCaseStatus(
        clinicalCase.id,
        ClinicalCaseStatusEnum.CANCELADO,
        closureTime,
        manager,
      );
      return;
    }

    await this.updateClinicalCaseStatus(
      clinicalCase.id,
      ClinicalCaseStatusEnum.ABIERTO,
      closureTime,
      manager,
    );

    if (action === EncounterFollowUpActionEnum.SCHEDULE_CONTROL) {
      if (!controlAppointment) {
        throw new BadRequestException(
          'Debes programar un turno de control para finalizar la consulta con seguimiento.',
        );
      }

      await this.ensureCaseHasNoPendingFollowUp(clinicalCase.id, manager);
      await this.createPendingControlFollowUp(encounter, clinicalCase.id, controlAppointment, manager);
      return;
    }

    if (controlAppointment) {
      throw new BadRequestException(
        'No se puede adjuntar un turno de control cuando el seguimiento no está configurado para programarlo.',
      );
    }
  }

  async reactivateEncounterClinicalCaseEffects(
    encounter: Encounter,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    await this.ensureReactivationDoesNotBreakCaseFlow(encounter.id, manager);
    await this.cancelPendingFollowUpsFromEncounter(encounter.id, manager);
    await this.restoreTreatmentReviewDraftsFromEvents(encounter, userId, manager);
    await this.reopenOrRemoveClinicalCaseAfterReactivation(encounter, manager);
    await this.restoreCurrentFollowUpInAttention(encounter.id, manager);
  }

  private async createPendingControlFollowUp(
    encounter: Encounter,
    clinicalCaseId: number,
    payload: ScheduleControlAppointmentDto,
    manager: EntityManager,
  ): Promise<void> {
    const appointment = await this.createControlAppointment(
      encounter.patientId,
      encounter.vetId,
      encounter.id,
      this.resolveClinicalCaseProblemSummary(encounter, null),
      encounter.plan?.planNotes ?? null,
      payload,
      encounter.createdByUserId,
      manager,
    );

    await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).save(
      this.followUpRepo.create({
        clinicalCaseId,
        sourceEncounterId: encounter.id,
        generatedAppointmentId: appointment.id,
        targetEncounterId: null,
        suggestedDate: new Date(payload.scheduledDate),
        status: ClinicalCaseFollowUpStatusEnum.PROGRAMADO,
      }),
    );
  }

  private buildControlAppointmentNotes(
    problemSummary: string | null,
    planNotes: string | null,
    appointmentNotes: string | null,
  ): string | null {
    const notes: string[] = [];

    if (problemSummary?.trim()) {
      notes.push(`Caso clínico: ${problemSummary.trim()}`);
    }

    if (planNotes?.trim()) {
      notes.push(`Seguimiento: ${planNotes.trim()}`);
    }

    if (appointmentNotes?.trim()) {
      notes.push(appointmentNotes.trim());
    }

    return notes.length > 0 ? notes.join('\n') : null;
  }

  private async processTreatmentReviewDrafts(
    encounter: Encounter,
    closureTime: Date,
    manager: EntityManager,
  ): Promise<void> {
    const clinicalCaseId = encounter.clinicalCaseId;
    if (!clinicalCaseId) {
      return;
    }

    const reviewDrafts = await this.getRepo(
      EncounterTreatmentReviewDraft,
      this.treatmentReviewDraftRepo,
      manager,
    ).find({
      where: { encounterId: encounter.id },
      relations: ['sourceTreatment', 'sourceTreatment.items'],
      order: { id: 'ASC' },
    });

    const replacementSources = new Set(
      [...(encounter.treatmentDrafts ?? [])]
        .map((draft) => draft.replacesTreatmentId)
        .filter((value): value is number => typeof value === 'number' && value > 0),
    );

    for (const reviewDraft of reviewDrafts) {
      if (!reviewDraft.sourceTreatment || reviewDraft.sourceTreatment.deletedAt) {
        throw new NotFoundException('Uno de los tratamientos revisados ya no está disponible.');
      }

      if (replacementSources.has(reviewDraft.sourceTreatmentId)) {
        throw new BadRequestException(
          'No puedes registrar una revisión y un reemplazo sobre el mismo tratamiento en la misma consulta.',
        );
      }

      if (reviewDraft.sourceTreatment.status !== TreatmentStatusEnum.ACTIVO) {
        throw new BadRequestException(
          'Solo se pueden revisar tratamientos activos dentro del caso clínico.',
        );
      }

      const previousStatus = reviewDraft.sourceTreatment.status;
      const previousEndDate = reviewDraft.sourceTreatment.endDate ?? null;

      if (reviewDraft.action === TreatmentEvolutionEventTypeEnum.SUSPENDE) {
        await this.updateTreatmentLifecycle(
          reviewDraft.sourceTreatment,
          TreatmentStatusEnum.SUSPENDIDO,
          encounter.id,
          closureTime,
          manager,
        );
      } else if (reviewDraft.action === TreatmentEvolutionEventTypeEnum.FINALIZA) {
        await this.updateTreatmentLifecycle(
          reviewDraft.sourceTreatment,
          TreatmentStatusEnum.FINALIZADO,
          encounter.id,
          closureTime,
          manager,
        );
      } else if (reviewDraft.action !== TreatmentEvolutionEventTypeEnum.CONTINUA) {
        throw new BadRequestException(
          'La acción de evolución indicada no está soportada para revisión directa.',
        );
      }

      await this.getRepo(
        TreatmentEvolutionEvent,
        this.treatmentEvolutionEventRepo,
        manager,
      ).save(
        this.treatmentEvolutionEventRepo.create({
          treatmentId: reviewDraft.sourceTreatmentId,
          encounterId: encounter.id,
          clinicalCaseId,
          eventType: reviewDraft.action,
          notes: reviewDraft.notes?.trim() || null,
          replacementTreatmentId: null,
          previousStatus,
          previousEndDate,
        }),
      );
    }

    if (reviewDrafts.length > 0) {
      await this.getRepo(
        EncounterTreatmentReviewDraft,
        this.treatmentReviewDraftRepo,
        manager,
      ).delete({ encounterId: encounter.id });
    }
  }

  private async processTreatmentReplacements(
    encounter: Encounter,
    closureTime: Date,
    manager: EntityManager,
  ): Promise<void> {
    const clinicalCaseId = encounter.clinicalCaseId;
    if (!clinicalCaseId) {
      return;
    }

    const replacements = await this.getRepo(Treatment, this.treatmentRepo, manager).find({
      where: {
        encounterId: encounter.id,
      },
      relations: ['items'],
      order: { id: 'ASC' },
    });

    const replacementTreatments = replacements.filter(
      (treatment) =>
        !treatment.deletedAt
        && treatment.replacesTreatmentId !== null
        && treatment.replacesTreatmentId !== undefined,
    );

    if (replacementTreatments.length === 0) {
      return;
    }

    const alreadyReviewed = await this.getRepo(
      TreatmentEvolutionEvent,
      this.treatmentEvolutionEventRepo,
      manager,
    ).find({
      where: {
        encounterId: encounter.id,
      },
      select: ['id', 'treatmentId'],
    });

    const reviewedTreatmentIds = new Set(alreadyReviewed.map((event) => event.treatmentId));

    for (const treatment of replacementTreatments) {
      const sourceTreatment = await this.getRepo(Treatment, this.treatmentRepo, manager).findOne({
        where: { id: treatment.replacesTreatmentId! },
        relations: ['items'],
      });

      if (!sourceTreatment || sourceTreatment.deletedAt) {
        throw new NotFoundException('El tratamiento que intentas reemplazar ya no está disponible.');
      }

      if (reviewedTreatmentIds.has(sourceTreatment.id)) {
        throw new BadRequestException(
          'No puedes reemplazar un tratamiento que ya fue revisado con otra acción en esta misma consulta.',
        );
      }

      if (sourceTreatment.status !== TreatmentStatusEnum.ACTIVO) {
        throw new BadRequestException(
          'Solo se pueden reemplazar tratamientos activos del caso clínico.',
        );
      }

      const previousStatus = sourceTreatment.status;
      const previousEndDate = sourceTreatment.endDate ?? null;

      await this.updateTreatmentLifecycle(
        sourceTreatment,
        TreatmentStatusEnum.FINALIZADO,
        encounter.id,
        closureTime,
        manager,
      );

      await this.getRepo(
        TreatmentEvolutionEvent,
        this.treatmentEvolutionEventRepo,
        manager,
      ).save(
        this.treatmentEvolutionEventRepo.create({
          treatmentId: sourceTreatment.id,
          encounterId: encounter.id,
          clinicalCaseId,
          eventType: TreatmentEvolutionEventTypeEnum.REEMPLAZA,
          notes: null,
          replacementTreatmentId: treatment.id,
          previousStatus,
          previousEndDate,
        }),
      );
    }
  }

  private async updateTreatmentLifecycle(
    treatment: Treatment,
    nextStatus: TreatmentStatusEnum,
    encounterId: number,
    closureTime: Date,
    manager: EntityManager,
  ): Promise<void> {
    const normalizedClosureDate = this.normalizeDate(closureTime);
    const patch: Partial<Treatment> = {
      status: nextStatus,
      closedByEncounterId: encounterId,
    };

    if (!treatment.endDate || this.normalizeDate(treatment.endDate) > normalizedClosureDate) {
      patch.endDate = normalizedClosureDate;
    }

    await this.getRepo(Treatment, this.treatmentRepo, manager).update(treatment.id, patch);

    const targetItemStatus =
      nextStatus === TreatmentStatusEnum.SUSPENDIDO
        ? TreatmentItemStatusEnum.SUSPENDIDO
        : TreatmentItemStatusEnum.FINALIZADO;

    const activeItemIds = (treatment.items ?? [])
      .filter((item) => !item.deletedAt && item.status === TreatmentItemStatusEnum.ACTIVO)
      .map((item) => item.id);

    if (activeItemIds.length > 0) {
      await this.getRepo(TreatmentItem, this.treatmentItemRepo, manager).update(activeItemIds, {
        status: targetItemStatus,
      });
    }
  }

  private async ensureReactivationDoesNotBreakCaseFlow(
    encounterId: number,
    manager: EntityManager,
  ): Promise<void> {
    const pendingFollowUps = await this.getRepo(
      ClinicalCaseFollowUp,
      this.followUpRepo,
      manager,
    ).find({
      where: { sourceEncounterId: encounterId },
    });

    for (const followUp of pendingFollowUps) {
      if (followUp.targetEncounterId) {
        throw new ConflictException(
          'No se puede reactivar la consulta porque su control ya generó una nueva atención clínica.',
        );
      }

      if (!followUp.generatedAppointmentId) {
        continue;
      }

      const appointment = await this.getRepo(Appointment, this.appointmentRepo, manager).findOne({
        where: { id: followUp.generatedAppointmentId },
      });

      if (!appointment || appointment.deletedAt) {
        continue;
      }

      const queueEntry = await this.getRepo(QueueEntry, this.queueRepo, manager).findOne({
        where: { appointmentId: appointment.id },
      });

      if (queueEntry && !queueEntry.deletedAt) {
        throw new ConflictException(
          'No se puede reactivar la consulta porque el control siguiente ya tuvo movimiento operativo.',
        );
      }

      if (
        ![
          AppointmentStatusEnum.PROGRAMADA,
          AppointmentStatusEnum.CONFIRMADA,
          AppointmentStatusEnum.CANCELADA,
        ].includes(appointment.status as AppointmentStatusEnum)
      ) {
        throw new ConflictException(
          'No se puede reactivar la consulta porque el control siguiente ya tuvo actividad clínica.',
        );
      }
    }
  }

  private async cancelPendingFollowUpsFromEncounter(
    encounterId: number,
    manager: EntityManager,
  ): Promise<void> {
    const followUps = await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).find({
      where: { sourceEncounterId: encounterId },
    });

    for (const followUp of followUps) {
      await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).update(followUp.id, {
        status: ClinicalCaseFollowUpStatusEnum.CANCELADO,
      });

      if (followUp.generatedAppointmentId) {
        await this.getRepo(Appointment, this.appointmentRepo, manager).update(
          followUp.generatedAppointmentId,
          { status: AppointmentStatusEnum.CANCELADA },
        );
      }
    }
  }

  private async cancelPendingFollowUpsForCase(
    clinicalCaseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const followUps = await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).find({
      where: { clinicalCaseId },
    });

    for (const followUp of followUps) {
      if (
        followUp.deletedAt
        || followUp.status === ClinicalCaseFollowUpStatusEnum.CANCELADO
        || followUp.status === ClinicalCaseFollowUpStatusEnum.COMPLETADO
      ) {
        continue;
      }

      await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).update(followUp.id, {
        status: ClinicalCaseFollowUpStatusEnum.CANCELADO,
      });

      if (followUp.generatedAppointmentId) {
        await this.getRepo(Appointment, this.appointmentRepo, manager).update(
          followUp.generatedAppointmentId,
          { status: AppointmentStatusEnum.CANCELADA },
        );
      }
    }
  }

  private async restoreTreatmentReviewDraftsFromEvents(
    encounter: Encounter,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const events = await this.getRepo(
      TreatmentEvolutionEvent,
      this.treatmentEvolutionEventRepo,
      manager,
    ).find({
      where: { encounterId: encounter.id },
      relations: ['treatment'],
      order: { id: 'ASC' },
    });

    if (events.length === 0) {
      return;
    }

    const deletedAt = new Date();

    for (const event of events) {
      if (
        event.eventType === TreatmentEvolutionEventTypeEnum.CONTINUA
        || event.eventType === TreatmentEvolutionEventTypeEnum.SUSPENDE
        || event.eventType === TreatmentEvolutionEventTypeEnum.FINALIZA
      ) {
        await this.getRepo(
          EncounterTreatmentReviewDraft,
          this.treatmentReviewDraftRepo,
          manager,
        ).save(
          this.treatmentReviewDraftRepo.create({
            encounterId: encounter.id,
            sourceTreatmentId: event.treatmentId,
            action: event.eventType,
            notes: event.notes ?? null,
          }),
        );
      }

      if (
        event.eventType === TreatmentEvolutionEventTypeEnum.SUSPENDE
        || event.eventType === TreatmentEvolutionEventTypeEnum.FINALIZA
        || event.eventType === TreatmentEvolutionEventTypeEnum.REEMPLAZA
      ) {
        await this.getRepo(Treatment, this.treatmentRepo, manager).update(event.treatmentId, {
          status: event.previousStatus ?? TreatmentStatusEnum.ACTIVO,
          endDate: event.previousEndDate ?? null,
          closedByEncounterId: null,
        });

        await this.getRepo(TreatmentItem, this.treatmentItemRepo, manager).update(
          { treatmentId: event.treatmentId },
          {
            status:
              (event.previousStatus ?? TreatmentStatusEnum.ACTIVO) === TreatmentStatusEnum.ACTIVO
                ? TreatmentItemStatusEnum.ACTIVO
                : TreatmentItemStatusEnum.FINALIZADO,
          },
        );
      }

      await this.getRepo(
        TreatmentEvolutionEvent,
        this.treatmentEvolutionEventRepo,
        manager,
      ).update(event.id, {
        isActive: false,
        deletedAt,
        deletedByUserId: userId,
      });
    }
  }

  private async reopenOrRemoveClinicalCaseAfterReactivation(
    encounter: Encounter,
    manager: EntityManager,
  ): Promise<void> {
    if (!encounter.clinicalCaseId) {
      return;
    }

    const clinicalCase = await this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager);

    const otherEncounters = await this.getRepo(Encounter, this.encounterRepo, manager).count({
      where: { clinicalCaseId: clinicalCase.id },
    });

    const remainingFollowUps = await this.getRepo(
      ClinicalCaseFollowUp,
      this.followUpRepo,
      manager,
    ).count({
      where: { clinicalCaseId: clinicalCase.id },
    });

    if (
      clinicalCase.originEncounterId === encounter.id
      && otherEncounters <= 1
      && remainingFollowUps === 0
    ) {
      await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).update(clinicalCase.id, {
        isActive: false,
        deletedAt: new Date(),
      });

      await this.getRepo(Encounter, this.encounterRepo, manager).update(encounter.id, {
        clinicalCaseId: null,
      });

      return;
    }

    await this.updateClinicalCaseStatus(
      clinicalCase.id,
      ClinicalCaseStatusEnum.ABIERTO,
      new Date(),
      manager,
    );
  }

  private async restoreCurrentFollowUpInAttention(
    encounterId: number,
    manager: EntityManager,
  ): Promise<void> {
    const followUp = await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).findOne({
      where: { targetEncounterId: encounterId },
    });

    if (!followUp || followUp.deletedAt) {
      return;
    }

    await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).update(followUp.id, {
      status: ClinicalCaseFollowUpStatusEnum.EN_ATENCION,
    });
  }

  private async completeCurrentFollowUpIfNeeded(
    encounterId: number,
    manager: EntityManager,
  ): Promise<void> {
    const followUp = await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).findOne({
      where: { targetEncounterId: encounterId },
    });

    if (!followUp || followUp.deletedAt) {
      return;
    }

    await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).update(followUp.id, {
      status: ClinicalCaseFollowUpStatusEnum.COMPLETADO,
    });
  }

  private async createClinicalCaseFromEncounter(
    encounter: Encounter,
    problemSummary: string,
    manager: EntityManager,
  ): Promise<ClinicalCase> {
    const normalizedSummary = this.normalizeProblemSummary(problemSummary);

    return this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).save(
      this.clinicalCaseRepo.create({
        patientId: encounter.patientId,
        originEncounterId: encounter.id,
        status: ClinicalCaseStatusEnum.ABIERTO,
        problemSummary: problemSummary.trim(),
        problemSummaryNormalized: normalizedSummary,
        openedAt: encounter.startTime ?? new Date(),
        closedAt: null,
        canceledAt: null,
      }),
    );
  }

  private async persistEncounterClinicalCaseLink(
    encounterId: number,
    clinicalCaseId: number,
    manager: EntityManager,
  ): Promise<void> {
    await this.getRepo(Encounter, this.encounterRepo, manager).update(encounterId, {
      clinicalCaseId,
    });
  }

  private async detachEncounterFromClinicalCase(
    encounter: Encounter,
    manager: EntityManager,
  ): Promise<void> {
    if (!encounter.clinicalCaseId) {
      return;
    }

    const clinicalCase = await this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager);
    const otherEncounters = await this.getRepo(Encounter, this.encounterRepo, manager).count({
      where: { clinicalCaseId: clinicalCase.id },
    });
    const followUpsCount = await this.getRepo(
      ClinicalCaseFollowUp,
      this.followUpRepo,
      manager,
    ).count({
      where: { clinicalCaseId: clinicalCase.id },
    });
    const activeTreatmentsCount = await this.getRepo(Treatment, this.treatmentRepo, manager).count({
      where: { clinicalCaseId: clinicalCase.id },
    });
    const evolutionEventsCount = await this.getRepo(
      TreatmentEvolutionEvent,
      this.treatmentEvolutionEventRepo,
      manager,
    ).count({
      where: { clinicalCaseId: clinicalCase.id },
    });

    if (
      clinicalCase.originEncounterId === encounter.id
      && otherEncounters <= 1
      && followUpsCount === 0
      && activeTreatmentsCount === 0
      && evolutionEventsCount === 0
    ) {
      await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).update(clinicalCase.id, {
        isActive: false,
        deletedAt: new Date(),
      });
    }

    await this.getRepo(Encounter, this.encounterRepo, manager).update(encounter.id, {
      clinicalCaseId: null,
    });
  }

  private async ensureOpenCaseForPatient(
    patientId: number,
    clinicalCaseId: number,
    manager?: EntityManager,
  ): Promise<ClinicalCase> {
    const clinicalCase = await this.findClinicalCaseOrFail(clinicalCaseId, manager);

    if (clinicalCase.patientId !== patientId) {
      throw new BadRequestException(
        'El caso clínico seleccionado no pertenece a la mascota de esta consulta.',
      );
    }

    if (clinicalCase.status !== ClinicalCaseStatusEnum.ABIERTO) {
      throw new BadRequestException(
        'Solo puedes vincular un caso clínico que se encuentre abierto.',
      );
    }

    return clinicalCase;
  }

  private async updateClinicalCaseStatus(
    clinicalCaseId: number,
    status: ClinicalCaseStatusEnum,
    referenceDate: Date,
    manager: EntityManager,
  ): Promise<void> {
    await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).update(clinicalCaseId, {
      status,
      closedAt: status === ClinicalCaseStatusEnum.CERRADO ? referenceDate : null,
      canceledAt: status === ClinicalCaseStatusEnum.CANCELADO ? referenceDate : null,
    });
  }

  private async findClinicalCaseOrFail(
    caseId: number,
    manager?: EntityManager,
  ): Promise<ClinicalCase> {
    const clinicalCase = await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).findOne({
      where: { id: caseId },
      relations: this.summaryRelations(),
      order: {
        encounters: { startTime: 'DESC', id: 'DESC' },
        followUps: { suggestedDate: 'ASC', id: 'ASC' },
        treatmentEvolutionEvents: { createdAt: 'DESC', id: 'DESC' },
      } as any,
    });

    if (!clinicalCase || clinicalCase.deletedAt) {
      throw new NotFoundException('Caso clínico no encontrado.');
    }

    return clinicalCase;
  }

  private summaryRelations(): string[] {
    return [
      'encounters',
      'encounters.consultationReason',
      'encounters.clinicalImpression',
      'encounters.vet',
      'encounters.vet.person',
      'followUps',
      'followUps.generatedAppointment',
      'followUps.targetEncounter',
      'treatments',
      'treatments.items',
      'treatmentEvolutionEvents',
      'treatmentEvolutionEvents.treatment',
      'treatmentEvolutionEvents.treatment.items',
      'treatmentEvolutionEvents.replacementTreatment',
      'treatmentEvolutionEvents.replacementTreatment.items',
    ];
  }

  private toClinicalCaseSummaryDto(clinicalCase: ClinicalCase): ClinicalCaseSummaryDto {
    const activeTreatments = this.buildActiveTreatmentDtos(clinicalCase);
    const lastEvolution = this.buildLastEvolutionDto(clinicalCase);
    const nextFollowUp = this.buildNextFollowUpDto(clinicalCase);
    const latestImpression = this.buildLatestImpression(clinicalCase);
    const consultationsCount = (clinicalCase.encounters ?? []).filter((encounter) => !encounter.deletedAt).length;

    return {
      id: clinicalCase.id,
      patientId: clinicalCase.patientId,
      originEncounterId: clinicalCase.originEncounterId,
      status: clinicalCase.status,
      problemSummary: clinicalCase.problemSummary,
      openedAt: toIso(clinicalCase.openedAt)!,
      closedAt: toIso(clinicalCase.closedAt),
      canceledAt: toIso(clinicalCase.canceledAt),
      latestImpression,
      nextFollowUp,
      lastEvolution,
      activeTreatments,
      consultationsCount,
    };
  }

  private toClinicalCaseDetailDto(clinicalCase: ClinicalCase): ClinicalCaseDetailDto {
    return {
      ...this.toClinicalCaseSummaryDto(clinicalCase),
      consultations: this.buildConsultationDtos(clinicalCase),
      followUps: this.buildFollowUpDtos(clinicalCase),
    };
  }

  private buildConsultationDtos(clinicalCase: ClinicalCase): ClinicalCaseConsultationSummaryDto[] {
    const sortedEncounters = [...(clinicalCase.encounters ?? [])]
      .filter((encounter) => !encounter.deletedAt)
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.startTime)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.startTime)?.getTime() ?? 0;
        return rightDate - leftDate || right.id - left.id;
      });

    const patientEncounterSequence = [...(clinicalCase.encounters ?? [])]
      .filter((encounter) => !encounter.deletedAt)
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.startTime)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.startTime)?.getTime() ?? 0;
        return leftDate - rightDate || left.id - right.id;
      })
      .reduce((map, encounter, index) => {
        map.set(encounter.id, index + 1);
        return map;
      }, new Map<number, number>());

    return sortedEncounters.map((encounter) => ({
      id: encounter.id,
      patientConsultationNumber: patientEncounterSequence.get(encounter.id) ?? 1,
      startTime: toIso(encounter.startTime)!,
      status: encounter.status,
      consultationReason: encounter.consultationReason?.consultationReason?.trim() || null,
      clinicianName: this.buildClinicianName(encounter),
    }));
  }

  private buildFollowUpDtos(clinicalCase: ClinicalCase): ClinicalCaseFollowUpDetailDto[] {
    return [...(clinicalCase.followUps ?? [])]
      .filter((followUp) => !followUp.deletedAt)
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.suggestedDate)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.suggestedDate)?.getTime() ?? 0;
        return leftDate - rightDate || left.id - right.id;
      })
      .map((followUp) => this.mapFollowUp(followUp));
  }

  private buildActiveTreatmentDtos(clinicalCase: ClinicalCase): ClinicalCaseActiveTreatmentDto[] {
    return [...(clinicalCase.treatments ?? [])]
      .filter(
        (treatment) =>
          !treatment.deletedAt
          && treatment.status === TreatmentStatusEnum.ACTIVO
          && treatment.isActive,
      )
      .sort((left, right) => right.id - left.id)
      .map((treatment) => ({
        id: treatment.id,
        encounterId: treatment.encounterId,
        status: treatment.status,
        summary: this.buildTreatmentSummary(treatment),
        startDate: toIso(treatment.startDate)!,
        endDate: toIso(treatment.endDate),
      }));
  }

  private buildLastEvolutionDto(clinicalCase: ClinicalCase): ClinicalCaseLastEvolutionDto | null {
    const latest = [...(clinicalCase.treatmentEvolutionEvents ?? [])]
      .filter((event) => !event.deletedAt && event.isActive)
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.createdAt)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.createdAt)?.getTime() ?? 0;
        return rightDate - leftDate || right.id - left.id;
      })[0];

    if (!latest) {
      return null;
    }

    return {
      id: latest.id,
      encounterId: latest.encounterId,
      treatmentId: latest.treatmentId,
      treatmentSummary: this.buildTreatmentSummary(latest.treatment),
      eventType: latest.eventType,
      notes: latest.notes ?? null,
      replacementTreatmentId: latest.replacementTreatmentId ?? null,
      replacementTreatmentSummary: latest.replacementTreatment
        ? this.buildTreatmentSummary(latest.replacementTreatment)
        : null,
      createdAt: toIso(latest.createdAt)!,
    };
  }

  private buildNextFollowUpDto(clinicalCase: ClinicalCase): ClinicalCaseNextFollowUpDto | null {
    const followUp = [...(clinicalCase.followUps ?? [])]
      .filter(
        (candidate) =>
          !candidate.deletedAt
          && candidate.isActive
          && candidate.status !== ClinicalCaseFollowUpStatusEnum.CANCELADO,
      )
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.suggestedDate)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.suggestedDate)?.getTime() ?? 0;
        return leftDate - rightDate || left.id - right.id;
      })[0];

    return followUp ? this.mapFollowUp(followUp) : null;
  }

  private mapFollowUp(followUp: ClinicalCaseFollowUp): ClinicalCaseFollowUpDetailDto {
    const appointment = followUp.generatedAppointment;

    return {
      id: followUp.id,
      sourceEncounterId: followUp.sourceEncounterId,
      targetEncounterId: followUp.targetEncounterId ?? null,
      suggestedDate: toIso(followUp.suggestedDate)!,
      status: followUp.status,
      appointmentId: followUp.generatedAppointmentId ?? null,
      appointmentScheduledDate: appointment ? String(appointment.scheduledDate) : null,
      appointmentScheduledTime: appointment?.scheduledTime ?? null,
      appointmentEndTime: appointment?.endTime ?? null,
      appointmentStatus: appointment?.status ?? null,
    };
  }

  private buildLatestImpression(clinicalCase: ClinicalCase): string | null {
    const latestEncounter = [...(clinicalCase.encounters ?? [])]
      .filter((encounter) => !encounter.deletedAt)
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.startTime)?.getTime() ?? 0;
        const rightDate = normalizeDateValue(right.startTime)?.getTime() ?? 0;
        return rightDate - leftDate || right.id - left.id;
      })[0];

    return (
      latestEncounter?.clinicalImpression?.presumptiveDiagnosis?.trim()
      || latestEncounter?.clinicalImpression?.clinicalNotes?.trim()
      || null
    );
  }

  private buildClinicianName(encounter: Encounter): string | null {
    const firstName = encounter.vet?.person?.firstName?.trim() ?? '';
    const lastName = encounter.vet?.person?.lastName?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || null;
  }

  private buildTreatmentSummary(treatment: Treatment | null | undefined): string {
    if (!treatment) {
      return 'Tratamiento';
    }

    const medicationNames = (treatment.items ?? [])
      .filter((item) => !item.deletedAt)
      .map((item) => item.medication?.trim())
      .filter((value): value is string => Boolean(value));

    if (medicationNames.length === 1) {
      return medicationNames[0];
    }

    if (medicationNames.length > 1) {
      return `${medicationNames[0]} + ${medicationNames.length - 1} más`;
    }

    return treatment.generalInstructions?.trim() || `Tratamiento #${treatment.id}`;
  }

  private async dataAwareTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.clinicalCaseRepo.manager.transaction(operation);
  }

  private latestEncounterForCase(clinicalCase: ClinicalCase): Encounter | null {
    return [...(clinicalCase.encounters ?? [])]
      .filter((encounter) => !encounter.deletedAt)
      .sort((left, right) => {
        const rightTime = normalizeDateValue(right.startTime)?.getTime() ?? 0;
        const leftTime = normalizeDateValue(left.startTime)?.getTime() ?? 0;
        return rightTime - leftTime || right.id - left.id;
      })[0] ?? null;
  }

  private resolveClinicalCaseProblemSummary(
    encounter: Encounter,
    clinicalCase: ClinicalCase | null,
  ): string | null {
    return clinicalCase?.problemSummary?.trim()
      || encounter.clinicalCase?.problemSummary?.trim()
      || null;
  }

  private isTimeRangeValid(startTime: string, endTime: string): boolean {
    return Boolean(startTime.trim()) && Boolean(endTime.trim()) && endTime > startTime;
  }

  private async ensureCaseHasNoPendingFollowUp(
    clinicalCaseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const pending = await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).findOne({
      where: { clinicalCaseId },
      order: { id: 'DESC' },
    });

    if (
      pending
      && !pending.deletedAt
      && pending.status !== ClinicalCaseFollowUpStatusEnum.CANCELADO
      && !pending.targetEncounterId
    ) {
      throw new ConflictException(
        'Este caso clínico ya tiene un control pendiente. Debes resolverlo antes de programar otro.',
      );
    }
  }

  private async createControlAppointment(
    patientId: number,
    vetId: number,
    sourceEncounterId: number,
    problemSummary: string | null,
    planNotes: string | null,
    payload: ScheduleControlAppointmentDto,
    userId: number | null,
    manager: EntityManager,
  ): Promise<Appointment> {
    if (!this.isTimeRangeValid(payload.scheduledTime, payload.endTime)) {
      throw new BadRequestException(
        'La hora de fin del control debe ser mayor a la hora de inicio.',
      );
    }

    const appointmentRepo = this.getRepo(Appointment, this.appointmentRepo, manager);
    const overlappingAppointment = await appointmentRepo
      .createQueryBuilder('a')
      .select('a.id')
      .where('"a"."vet_id" = :vetId', { vetId })
      .andWhere('"a"."scheduled_date" = :scheduledDate', { scheduledDate: payload.scheduledDate })
      .andWhere('"a"."deleted_at" IS NULL')
      .andWhere(`"a"."status" IN (:...activeStatuses)`, {
        activeStatuses: [
          AppointmentStatusEnum.PROGRAMADA,
          AppointmentStatusEnum.CONFIRMADA,
          AppointmentStatusEnum.EN_PROCESO,
        ],
      })
      .andWhere('"a"."scheduled_time" < :endTime', { endTime: payload.endTime })
      .andWhere('"a"."end_time" > :scheduledTime', { scheduledTime: payload.scheduledTime })
      .getOne();

    if (overlappingAppointment) {
      throw new ConflictException(
        'El veterinario ya tiene un turno que se cruza con el horario seleccionado para el control.',
      );
    }

    return appointmentRepo.save(
      this.appointmentRepo.create({
        patientId,
        vetId,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        endTime: payload.endTime,
        reason: AppointmentReasonEnum.CONTROL,
        notes: this.buildControlAppointmentNotes(problemSummary, planNotes, payload.notes ?? null),
        status: AppointmentStatusEnum.PROGRAMADA,
        createdByUserId: userId,
      }),
    );
  }

  private normalizeProblemSummary(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toDateKey(value: Date | string | null | undefined): string {
    const parsed = normalizeDateValue(value);
    if (!parsed) {
      throw new BadRequestException('La fecha indicada para el seguimiento no es válida.');
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async ensurePatientExists(patientId: number): Promise<void> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Mascota no encontrada.');
    }
  }

  private getRepo<T extends ObjectLiteral>(
    entity: new () => T,
    repo: Repository<T>,
    manager?: EntityManager,
  ): Repository<T> {
    return manager ? manager.getRepository<T>(entity) : repo;
  }
}
