import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';

import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EncounterVaccinationDraft } from '../../../domain/entities/encounters/encounter-vaccination-draft.entity.js';
import { EncounterTreatmentDraft } from '../../../domain/entities/encounters/encounter-treatment-draft.entity.js';
import { EncounterTreatmentDraftItem } from '../../../domain/entities/encounters/encounter-treatment-draft-item.entity.js';
import { EncounterProcedureDraft } from '../../../domain/entities/encounters/encounter-procedure-draft.entity.js';
import { VaccinationEvent } from '../../../domain/entities/encounters/vaccination-event.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { ProcedureCatalog } from '../../../domain/entities/catalogs/procedure-catalog.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { PatientVaccinationPlanDose } from '../../../domain/entities/vaccinations/patient-vaccination-plan-dose.entity.js';
import {
  PatientVaccinationPlanDoseStatusEnum,
  PatientVaccinationPlanStatusEnum,
  TreatmentItemStatusEnum,
  TreatmentStatusEnum,
} from '../../../domain/enums/index.js';
import { UpsertVaccinationDraftDto } from '../../../presentation/dto/encounters/upsert-vaccination-draft.dto.js';
import { CreateTreatmentDto } from '../../../presentation/dto/encounters/create-treatment.dto.js';
import { CreateProcedureDto } from '../../../presentation/dto/encounters/create-procedure.dto.js';
import { EncounterSharedService } from './encounter-shared.service.js';
import { VaccinationPlanService } from '../vaccinations/vaccination-plan.service.js';

@Injectable()
export class EncounterActionDraftService {
  constructor(
    @InjectRepository(EncounterVaccinationDraft)
    private readonly vaccinationDraftRepo: Repository<EncounterVaccinationDraft>,
    @InjectRepository(EncounterTreatmentDraft)
    private readonly treatmentDraftRepo: Repository<EncounterTreatmentDraft>,
    @InjectRepository(EncounterTreatmentDraftItem)
    private readonly treatmentDraftItemRepo: Repository<EncounterTreatmentDraftItem>,
    @InjectRepository(EncounterProcedureDraft)
    private readonly procedureDraftRepo: Repository<EncounterProcedureDraft>,
    @InjectRepository(VaccinationEvent)
    private readonly vaccinationEventRepo: Repository<VaccinationEvent>,
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(TreatmentItem)
    private readonly treatmentItemRepo: Repository<TreatmentItem>,
    @InjectRepository(Procedure)
    private readonly procedureRepo: Repository<Procedure>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(ProcedureCatalog)
    private readonly procedureCatalogRepo: Repository<ProcedureCatalog>,
    @InjectRepository(PatientVaccineRecord)
    private readonly patientVaccineRecordRepo: Repository<PatientVaccineRecord>,
    @InjectRepository(PatientVaccinationPlanDose)
    private readonly planDoseRepo: Repository<PatientVaccinationPlanDose>,
    private readonly dataSource: DataSource,
    private readonly sharedService: EncounterSharedService,
    private readonly vaccinationPlanService: VaccinationPlanService,
  ) {}

  async createVaccinationDraft(
    encounterId: number,
    dto: UpsertVaccinationDraftDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);
    await this.saveVaccinationDraft(encounter, dto);
  }

  async updateVaccinationDraft(
    encounterId: number,
    draftId: number,
    dto: UpsertVaccinationDraftDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    const existing = await this.findVaccinationDraftOrFail(encounterId, draftId);
    await this.saveVaccinationDraft(encounter, dto, existing);
  }

  async deleteVaccinationDraft(encounterId: number, draftId: number): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.findVaccinationDraftOrFail(encounterId, draftId);
    await this.vaccinationDraftRepo.delete(draftId);
  }

  async createTreatmentDraft(encounterId: number, dto: CreateTreatmentDto): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);
    await this.saveTreatmentDraft(encounter, dto);
  }

  async updateTreatmentDraft(
    encounterId: number,
    draftId: number,
    dto: CreateTreatmentDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    const existing = await this.findTreatmentDraftOrFail(encounterId, draftId);
    await this.saveTreatmentDraft(encounter, dto, existing);
  }

  async deleteTreatmentDraft(encounterId: number, draftId: number): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.findTreatmentDraftOrFail(encounterId, draftId);
    await this.treatmentDraftRepo.delete(draftId);
  }

  async createProcedureDraft(encounterId: number, dto: CreateProcedureDto): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);
    await this.saveProcedureDraft(encounter, dto);
  }

  async updateProcedureDraft(
    encounterId: number,
    draftId: number,
    dto: CreateProcedureDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    const existing = await this.findProcedureDraftOrFail(encounterId, draftId);
    await this.saveProcedureDraft(encounter, dto, existing);
  }

  async deleteProcedureDraft(encounterId: number, draftId: number): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.findProcedureDraftOrFail(encounterId, draftId);
    await this.procedureDraftRepo.delete(draftId);
  }

  async materializeDrafts(encounter: Encounter, manager: EntityManager): Promise<void> {
    const vaccinationDrafts = [...(encounter.vaccinationDrafts ?? [])].sort(
      (left, right) => left.id - right.id,
    );
    for (const draft of vaccinationDrafts) {
      await this.materializeVaccinationDraft(encounter, draft, manager);
    }

    const treatmentDrafts = [...(encounter.treatmentDrafts ?? [])].sort(
      (left, right) => left.id - right.id,
    );
    for (const draft of treatmentDrafts) {
      await this.materializeTreatmentDraft(encounter, draft, manager);
    }

    const procedureDrafts = [...(encounter.procedureDrafts ?? [])].sort(
      (left, right) => left.id - right.id,
    );
    for (const draft of procedureDrafts) {
      await this.materializeProcedureDraft(encounter, draft, manager);
    }

    await this.deleteAllDrafts(encounter.id, manager);
  }

  async restoreDraftsFromMaterializedActions(
    encounter: Encounter,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    await this.deleteAllDrafts(encounter.id, manager);
    const deletedAt = new Date();

    for (const event of encounter.vaccinationEvents ?? []) {
      await this.restoreVaccinationDraft(encounter, event, userId, deletedAt, manager);
    }

    for (const treatment of encounter.treatments ?? []) {
      await this.restoreTreatmentDraft(encounter, treatment, userId, deletedAt, manager);
    }

    for (const procedure of encounter.procedures ?? []) {
      await this.restoreProcedureDraft(encounter, procedure, userId, deletedAt, manager);
    }
  }

  async deleteAllDrafts(encounterId: number, manager?: EntityManager): Promise<void> {
    await this.getRepo(EncounterVaccinationDraft, this.vaccinationDraftRepo, manager).delete({
      encounterId,
    });
    await this.getRepo(EncounterTreatmentDraft, this.treatmentDraftRepo, manager).delete({
      encounterId,
    });
    await this.getRepo(EncounterProcedureDraft, this.procedureDraftRepo, manager).delete({
      encounterId,
    });
  }

  private async saveVaccinationDraft(
    encounter: Encounter,
    dto: UpsertVaccinationDraftDto,
    existing?: EncounterVaccinationDraft,
  ): Promise<void> {
    const vaccine = await this.vaccineRepo.findOne({ where: { id: dto.vaccineId } });
    if (!vaccine || vaccine.deletedAt || !vaccine.isActive) {
      throw new NotFoundException('Vacuna no encontrada en el catálogo.');
    }

    await this.sharedService.ensureVaccineMatchesPatientSpecies(vaccine, encounter.patientId);

    const planDoseId = dto.planDoseId ?? existing?.planDoseId ?? null;
    if (planDoseId !== null) {
      await this.validatePlanDoseReference(encounter, planDoseId, dto.vaccineId);
    }

    const draft = existing ?? this.vaccinationDraftRepo.create({ encounterId: encounter.id });
    draft.planDoseId = planDoseId;
    draft.vaccineId = dto.vaccineId;
    draft.applicationDate = new Date(dto.applicationDate);
    draft.suggestedNextDate = dto.suggestedNextDate ? new Date(dto.suggestedNextDate) : null;
    draft.notes = dto.notes?.trim() || null;
    await this.vaccinationDraftRepo.save(draft);
  }

  private async saveTreatmentDraft(
    encounter: Encounter,
    dto: CreateTreatmentDto,
    existing?: EncounterTreatmentDraft,
  ): Promise<void> {
    const items = dto.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException(
        'Debes agregar al menos un ítem de tratamiento antes de guardarlo como pendiente.',
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin del tratamiento no puede ser anterior a la fecha de inicio.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const draftRepo = this.getRepo(EncounterTreatmentDraft, this.treatmentDraftRepo, manager);
      const itemRepo = this.getRepo(
        EncounterTreatmentDraftItem,
        this.treatmentDraftItemRepo,
        manager,
      );

      const draft =
        existing
          ? ((await draftRepo.findOne({ where: { id: existing.id } })) ??
            draftRepo.create({ encounterId: encounter.id, id: existing.id }))
          : draftRepo.create({ encounterId: encounter.id });

      draft.startDate = startDate;
      draft.endDate = endDate;
      draft.generalInstructions = dto.generalInstructions?.trim() || null;
      const savedDraft = await draftRepo.save(draft);

      if (existing) {
        await itemRepo.delete({ draftId: savedDraft.id });
      }

      const draftItems = items.map((item) =>
        itemRepo.create({
          draftId: savedDraft.id,
          medication: item.medication.trim(),
          dose: item.dose.trim(),
          frequency: item.frequency.trim(),
          durationDays: item.durationDays,
          administrationRoute: item.administrationRoute.trim(),
          notes: item.notes?.trim() || null,
          status: item.status ?? TreatmentItemStatusEnum.ACTIVO,
        }),
      );

      await itemRepo.save(draftItems);
    });
  }

  private async saveProcedureDraft(
    encounter: Encounter,
    dto: CreateProcedureDto,
    existing?: EncounterProcedureDraft,
  ): Promise<void> {
    let catalogId: number | null = null;
    let procedureType = dto.procedureType?.trim() || null;

    if (dto.catalogId !== undefined) {
      const catalog = await this.procedureCatalogRepo.findOne({ where: { id: dto.catalogId } });
      if (!catalog || catalog.deletedAt || !catalog.isActive) {
        throw new NotFoundException(
          'El procedimiento seleccionado no está disponible en el catálogo.',
        );
      }

      catalogId = catalog.id;
      procedureType = procedureType || catalog.name;
    }

    if (!procedureType) {
      throw new BadRequestException(
        'Debes indicar un procedimiento del catálogo o escribir el tipo realizado.',
      );
    }

    const draft = existing ?? this.procedureDraftRepo.create({ encounterId: encounter.id });
    draft.catalogId = catalogId;
    draft.procedureType = procedureType;
    draft.performedDate = new Date(dto.performedDate);
    draft.description = dto.description?.trim() || null;
    draft.result = dto.result?.trim() || null;
    draft.notes = dto.notes?.trim() || null;
    await this.procedureDraftRepo.save(draft);
  }

  private async materializeVaccinationDraft(
    encounter: Encounter,
    draft: EncounterVaccinationDraft,
    manager: EntityManager,
  ): Promise<void> {
    const vaccineRepo = this.getRepo(Vaccine, this.vaccineRepo, manager);
    const vaccine = await vaccineRepo.findOne({ where: { id: draft.vaccineId } });
    if (!vaccine || vaccine.deletedAt || !vaccine.isActive) {
      throw new NotFoundException('Una vacuna pendiente ya no está disponible en el catálogo.');
    }

    await this.sharedService.ensureVaccineMatchesPatientSpecies(vaccine, encounter.patientId);

    const recordRepo = this.getRepo(PatientVaccineRecord, this.patientVaccineRecordRepo, manager);
    const eventRepo = this.getRepo(VaccinationEvent, this.vaccinationEventRepo, manager);
    const applicationDate = new Date(draft.applicationDate);
    const suggestedNextDate = draft.suggestedNextDate ? new Date(draft.suggestedNextDate) : null;

    const carnetRecord = recordRepo.create({
      patientId: encounter.patientId,
      vaccineId: draft.vaccineId,
      applicationDate,
      administeredByEmployeeId: encounter.vetId,
      isExternal: false,
      nextDoseDate: suggestedNextDate,
      notes: draft.notes ?? 'Aplicada en consulta médica',
      encounterId: encounter.id,
      createdByUserId: encounter.createdByUserId,
    });
    const savedRecord = await recordRepo.save(carnetRecord);

    const event = eventRepo.create({
      encounterId: encounter.id,
      vaccineId: draft.vaccineId,
      applicationDate,
      suggestedNextDate,
      notes: draft.notes ?? null,
      patientVaccineRecordId: savedRecord.id,
    });
    await eventRepo.save(event);

    if (draft.planDoseId) {
      await this.vaccinationPlanService.registerApplicationForPlanDose(
        encounter.patientId,
        draft.planDoseId,
        draft.vaccineId,
        applicationDate,
        savedRecord.id,
        manager,
      );
      return;
    }

    await this.vaccinationPlanService.registerApplication(
      encounter.patientId,
      draft.vaccineId,
      applicationDate,
      savedRecord.id,
      manager,
    );
  }

  private async materializeTreatmentDraft(
    encounter: Encounter,
    draft: EncounterTreatmentDraft,
    manager: EntityManager,
  ): Promise<void> {
    const treatmentStatus = this.resolveTreatmentStatus(draft.endDate ? new Date(draft.endDate) : null);
    const treatmentRepo = this.getRepo(Treatment, this.treatmentRepo, manager);
    const treatmentItemRepo = this.getRepo(TreatmentItem, this.treatmentItemRepo, manager);

    const treatment = treatmentRepo.create({
      encounterId: encounter.id,
      status: treatmentStatus,
      startDate: new Date(draft.startDate),
      endDate: draft.endDate ? new Date(draft.endDate) : null,
      generalInstructions: draft.generalInstructions ?? null,
    });
    const savedTreatment = await treatmentRepo.save(treatment);

    const items = (draft.items ?? []).map((item) =>
      treatmentItemRepo.create({
        treatmentId: savedTreatment.id,
        medication: item.medication,
        dose: item.dose,
        frequency: item.frequency,
        durationDays: item.durationDays,
        administrationRoute: item.administrationRoute,
        notes: item.notes ?? null,
        status:
          item.status === TreatmentItemStatusEnum.ACTIVO
          && treatmentStatus === TreatmentStatusEnum.FINALIZADO
            ? TreatmentItemStatusEnum.FINALIZADO
            : item.status,
      }),
    );

    if (items.length > 0) {
      await treatmentItemRepo.save(items);
    }
  }

  private async materializeProcedureDraft(
    encounter: Encounter,
    draft: EncounterProcedureDraft,
    manager: EntityManager,
  ): Promise<void> {
    let procedureType = draft.procedureType?.trim() || null;

    if (draft.catalogId) {
      const catalog = await this.getRepo(ProcedureCatalog, this.procedureCatalogRepo, manager).findOne({
        where: { id: draft.catalogId },
      });
      if (!catalog || catalog.deletedAt || !catalog.isActive) {
        throw new NotFoundException(
          'Un procedimiento pendiente ya no está disponible en el catálogo.',
        );
      }

      procedureType = procedureType || catalog.name;
    }

    if (!procedureType) {
      throw new BadRequestException(
        'Un procedimiento pendiente no tiene un tipo válido para materializarse.',
      );
    }

    await this.getRepo(Procedure, this.procedureRepo, manager).save(
      this.procedureRepo.create({
        encounterId: encounter.id,
        catalogId: draft.catalogId ?? null,
        procedureType,
        performedDate: new Date(draft.performedDate),
        description: draft.description ?? null,
        result: draft.result ?? null,
        notes: draft.notes ?? null,
      }),
    );
  }

  private async restoreVaccinationDraft(
    encounter: Encounter,
    event: VaccinationEvent,
    userId: number,
    deletedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    const record = await this.resolveVaccinationRecordForRollback(encounter, event, manager);
    const planDose = record
      ? await this.findPlanDoseByApplicationRecordId(record.id, manager)
      : null;

    await this.getRepo(EncounterVaccinationDraft, this.vaccinationDraftRepo, manager).save(
      this.vaccinationDraftRepo.create({
        encounterId: encounter.id,
        planDoseId: planDose?.id ?? null,
        vaccineId: event.vaccineId,
        applicationDate: new Date(event.applicationDate),
        suggestedNextDate: event.suggestedNextDate ? new Date(event.suggestedNextDate) : null,
        notes: event.notes ?? null,
      }),
    );

    if (record) {
      await this.vaccinationPlanService.rollbackApplicationRecord(
        encounter.patientId,
        record.id,
        manager,
      );

      await this.getRepo(PatientVaccineRecord, this.patientVaccineRecordRepo, manager).update(
        record.id,
        {
          isActive: false,
          deletedAt,
          deletedByUserId: userId,
        },
      );
    }

    await this.getRepo(VaccinationEvent, this.vaccinationEventRepo, manager).update(event.id, {
      isActive: false,
      deletedAt,
      deletedByUserId: userId,
    });
  }

  private async restoreTreatmentDraft(
    encounter: Encounter,
    treatment: Treatment,
    userId: number,
    deletedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    const draftRepo = this.getRepo(EncounterTreatmentDraft, this.treatmentDraftRepo, manager);
    const itemRepo = this.getRepo(EncounterTreatmentDraftItem, this.treatmentDraftItemRepo, manager);

    const savedDraft = await draftRepo.save(
      draftRepo.create({
        encounterId: encounter.id,
        startDate: new Date(treatment.startDate),
        endDate: treatment.endDate ? new Date(treatment.endDate) : null,
        generalInstructions: treatment.generalInstructions ?? null,
      }),
    );

    const draftItems = (treatment.items ?? []).map((item) =>
      itemRepo.create({
        draftId: savedDraft.id,
        medication: item.medication,
        dose: item.dose,
        frequency: item.frequency,
        durationDays: item.durationDays,
        administrationRoute: item.administrationRoute,
        notes: item.notes ?? null,
        status: item.status,
      }),
    );

    if (draftItems.length > 0) {
      await itemRepo.save(draftItems);
      await this.getRepo(TreatmentItem, this.treatmentItemRepo, manager).update(
        (treatment.items ?? []).map((item) => item.id),
        {
          isActive: false,
          deletedAt,
          deletedByUserId: userId,
        },
      );
    }

    await this.getRepo(Treatment, this.treatmentRepo, manager).update(treatment.id, {
      isActive: false,
      deletedAt,
      deletedByUserId: userId,
    });
  }

  private async restoreProcedureDraft(
    encounter: Encounter,
    procedure: Procedure,
    userId: number,
    deletedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    await this.getRepo(EncounterProcedureDraft, this.procedureDraftRepo, manager).save(
      this.procedureDraftRepo.create({
        encounterId: encounter.id,
        catalogId: procedure.catalogId ?? null,
        procedureType: procedure.procedureType,
        performedDate: new Date(procedure.performedDate),
        description: procedure.description ?? null,
        result: procedure.result ?? null,
        notes: procedure.notes ?? null,
      }),
    );

    await this.getRepo(Procedure, this.procedureRepo, manager).update(procedure.id, {
      isActive: false,
      deletedAt,
      deletedByUserId: userId,
    });
  }

  private async resolveVaccinationRecordForRollback(
    encounter: Encounter,
    event: VaccinationEvent,
    manager: EntityManager,
  ): Promise<PatientVaccineRecord | null> {
    const recordRepo = this.getRepo(PatientVaccineRecord, this.patientVaccineRecordRepo, manager);

    if (event.patientVaccineRecordId) {
      return recordRepo.findOne({ where: { id: event.patientVaccineRecordId } });
    }

    return recordRepo.findOne({
      where: {
        patientId: encounter.patientId,
        encounterId: encounter.id,
        vaccineId: event.vaccineId,
        applicationDate: new Date(event.applicationDate),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private async validatePlanDoseReference(
    encounter: Encounter,
    planDoseId: number,
    vaccineId: number,
  ): Promise<void> {
    const planDose = await this.planDoseRepo.findOne({
      where: { id: planDoseId },
      relations: ['plan'],
    });

    if (
      !planDose
      || planDose.deletedAt
      || !planDose.plan
      || planDose.plan.deletedAt
      || planDose.plan.patientId !== encounter.patientId
      || planDose.plan.status !== PatientVaccinationPlanStatusEnum.ACTIVO
    ) {
      throw new BadRequestException(
        'La dosis del plan vacunal seleccionada ya no pertenece al paciente o no está disponible.',
      );
    }

    if (planDose.vaccineId !== vaccineId) {
      throw new BadRequestException(
        'La vacuna seleccionada no coincide con la dosis del plan vacunal pendiente.',
      );
    }

    if (
      planDose.status === PatientVaccinationPlanDoseStatusEnum.APLICADA
      || planDose.applicationRecordId
    ) {
      throw new BadRequestException(
        'La dosis del plan vacunal seleccionada ya fue aplicada previamente.',
      );
    }
  }

  private async findVaccinationDraftOrFail(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterVaccinationDraft> {
    const draft = await this.vaccinationDraftRepo.findOne({
      where: { id: draftId, encounterId },
    });

    if (!draft) {
      throw new NotFoundException('Vacunación pendiente no encontrada.');
    }

    return draft;
  }

  private async findTreatmentDraftOrFail(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterTreatmentDraft> {
    const draft = await this.treatmentDraftRepo.findOne({
      where: { id: draftId, encounterId },
      relations: ['items'],
    });

    if (!draft) {
      throw new NotFoundException('Tratamiento pendiente no encontrado.');
    }

    return draft;
  }

  private async findProcedureDraftOrFail(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterProcedureDraft> {
    const draft = await this.procedureDraftRepo.findOne({
      where: { id: draftId, encounterId },
    });

    if (!draft) {
      throw new NotFoundException('Procedimiento pendiente no encontrado.');
    }

    return draft;
  }

  private async findPlanDoseByApplicationRecordId(
    applicationRecordId: number,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlanDose | null> {
    return this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager).findOne({
      where: { applicationRecordId },
      relations: ['plan', 'plan.patient', 'schemeDose'],
    });
  }

  private resolveTreatmentStatus(endDate: Date | null): TreatmentStatusEnum {
    if (!endDate) {
      return TreatmentStatusEnum.ACTIVO;
    }

    const today = this.normalizeDate(new Date());
    return this.normalizeDate(endDate) <= today
      ? TreatmentStatusEnum.FINALIZADO
      : TreatmentStatusEnum.ACTIVO;
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getRepo<T extends ObjectLiteral>(
    entity: new () => T,
    repo: Repository<T>,
    manager?: EntityManager,
  ): Repository<T> {
    return manager ? manager.getRepository<T>(entity) : repo;
  }
}
