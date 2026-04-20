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
import { EncounterPlan } from '../../../domain/entities/encounters/encounter-plan.entity.js';
import { EncounterTreatmentReviewDraft } from '../../../domain/entities/encounters/encounter-treatment-review-draft.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentEvolutionEvent } from '../../../domain/entities/encounters/treatment-evolution-event.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import {
  AppointmentReasonEnum,
  AppointmentStatusEnum,
  ClinicalCaseFollowUpStatusEnum,
  ClinicalCaseOutcomeEnum,
  ClinicalCasePlanLinkModeEnum,
  ClinicalCaseStatusEnum,
  EncounterStatusEnum,
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
    @InjectRepository(EncounterPlan)
    private readonly encounterPlanRepo: Repository<EncounterPlan>,
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
    const clinicalCase = await this.findClinicalCaseOrFail(caseId);

    if (status === clinicalCase.status) {
      return this.toClinicalCaseDetailDto(clinicalCase);
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

    await this.clinicalCaseRepo.update(caseId, patch);
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
    const plan = encounter.plan;
    if (!plan) {
      return encounter.clinicalCaseId
        ? this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager)
        : null;
    }

    if (
      plan.caseOutcome !== ClinicalCaseOutcomeEnum.CONTINUA
      && plan.requiresFollowUp
    ) {
      throw new BadRequestException(
        'No puedes cerrar o cancelar el caso y al mismo tiempo generar un nuevo control.',
      );
    }

    if (encounter.clinicalCaseId) {
      if (
        plan.clinicalCaseId
        && plan.caseLinkMode === ClinicalCasePlanLinkModeEnum.EXISTING
        && plan.clinicalCaseId !== encounter.clinicalCaseId
      ) {
        throw new BadRequestException(
          'La consulta ya está vinculada a un caso clínico distinto y no puede cambiarse desde esta atención.',
        );
      }

      return this.findClinicalCaseOrFail(encounter.clinicalCaseId, manager);
    }

    if (!plan.requiresFollowUp) {
      return null;
    }

    const linkMode = plan.caseLinkMode ?? ClinicalCasePlanLinkModeEnum.NONE;
    if (linkMode === ClinicalCasePlanLinkModeEnum.NONE) {
      throw new BadRequestException(
        'Debes elegir si el seguimiento abre un caso nuevo o se vincula a un caso existente.',
      );
    }

    if (linkMode === ClinicalCasePlanLinkModeEnum.EXISTING) {
      if (!plan.clinicalCaseId) {
        throw new BadRequestException('Debes elegir el caso clínico existente a vincular.');
      }

      const existingCase = await this.ensureOpenCaseForPatient(
        encounter.patientId,
        plan.clinicalCaseId,
        manager,
      );
      await this.persistEncounterClinicalCaseLink(encounter.id, existingCase.id, manager);
      encounter.clinicalCaseId = existingCase.id;
      return existingCase;
    }

    if (!plan.problemSummary?.trim()) {
      throw new BadRequestException(
        'Debes resumir el problema clínico para abrir un caso nuevo.',
      );
    }

    const createdCase = await this.createClinicalCaseFromEncounter(encounter, plan.problemSummary, manager);
    await this.persistEncounterClinicalCaseLink(encounter.id, createdCase.id, manager);
    encounter.clinicalCaseId = createdCase.id;
    return createdCase;
  }

  async finalizeEncounterClinicalCase(
    encounter: Encounter,
    closureTime: Date,
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

    const outcome = encounter.plan?.caseOutcome ?? ClinicalCaseOutcomeEnum.CONTINUA;

    if (outcome === ClinicalCaseOutcomeEnum.RESUELTO) {
      await this.updateClinicalCaseStatus(
        clinicalCase.id,
        ClinicalCaseStatusEnum.CERRADO,
        closureTime,
        manager,
      );
      return;
    }

    if (outcome === ClinicalCaseOutcomeEnum.CANCELADO) {
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

    if (!encounter.plan?.requiresFollowUp) {
      return;
    }

    if (!encounter.plan.suggestedFollowUpDate) {
      throw new BadRequestException(
        'La fecha sugerida de seguimiento es obligatoria para generar el control.',
      );
    }

    await this.createPendingControlFollowUp(encounter, clinicalCase.id, manager);
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
    manager: EntityManager,
  ): Promise<void> {
    const appointment = await this.getRepo(Appointment, this.appointmentRepo, manager).save(
      this.appointmentRepo.create({
        patientId: encounter.patientId,
        vetId: encounter.vetId,
        scheduledDate: this.toDateKey(encounter.plan?.suggestedFollowUpDate),
        scheduledTime: null,
        endTime: null,
        reason: AppointmentReasonEnum.CONTROL,
        notes: this.buildControlAppointmentNotes(encounter),
        status: AppointmentStatusEnum.PROGRAMADA,
        createdByUserId: encounter.createdByUserId,
      }),
    );

    await this.getRepo(ClinicalCaseFollowUp, this.followUpRepo, manager).save(
      this.followUpRepo.create({
        clinicalCaseId,
        sourceEncounterId: encounter.id,
        generatedAppointmentId: appointment.id,
        targetEncounterId: null,
        suggestedDate: new Date(this.toDateKey(encounter.plan?.suggestedFollowUpDate)),
        status: ClinicalCaseFollowUpStatusEnum.PROGRAMADO,
      }),
    );
  }

  private buildControlAppointmentNotes(encounter: Encounter): string | null {
    const notes: string[] = [];
    const problemSummary = encounter.plan?.problemSummary?.trim();
    const planNotes = encounter.plan?.planNotes?.trim();

    if (problemSummary) {
      notes.push(`Caso clínico: ${problemSummary}`);
    }

    if (planNotes) {
      notes.push(`Seguimiento: ${planNotes}`);
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

      await this.getRepo(EncounterPlan, this.encounterPlanRepo, manager).update(
        { encounterId: encounter.id },
        { clinicalCaseId: null },
      );

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
    const duplicateCase = await this.getRepo(ClinicalCase, this.clinicalCaseRepo, manager).findOne({
      where: {
        patientId: encounter.patientId,
        problemSummaryNormalized: normalizedSummary,
        status: ClinicalCaseStatusEnum.ABIERTO,
      },
    });

    if (duplicateCase && !duplicateCase.deletedAt) {
      throw new ConflictException(
        'Ya existe un caso clínico abierto con el mismo problema activo para esta mascota. Debes vincularlo en lugar de crear otro.',
      );
    }

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

    await this.getRepo(EncounterPlan, this.encounterPlanRepo, manager).update(
      { encounterId },
      { clinicalCaseId },
    );
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
