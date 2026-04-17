import { Injectable } from '@nestjs/common';

import { CreateEncounterDto } from '../../../presentation/dto/encounters/create-encounter.dto.js';
import { CloseEncounterDto } from '../../../presentation/dto/encounters/update-encounter-status.dto.js';
import { UpsertConsultationReasonDto } from '../../../presentation/dto/encounters/upsert-consultation-reason.dto.js';
import { UpsertAnamnesisDto } from '../../../presentation/dto/encounters/upsert-anamnesis.dto.js';
import { UpsertClinicalExamDto } from '../../../presentation/dto/encounters/upsert-clinical-exam.dto.js';
import { UpsertEnvironmentalDataDto } from '../../../presentation/dto/encounters/upsert-environmental-data.dto.js';
import { UpsertClinicalImpressionDto } from '../../../presentation/dto/encounters/upsert-clinical-impression.dto.js';
import { UpsertPlanDto } from '../../../presentation/dto/encounters/upsert-plan.dto.js';
import { CreateVaccinationEventDto } from '../../../presentation/dto/encounters/create-vaccination-event.dto.js';
import { CreateDewormingEventDto } from '../../../presentation/dto/encounters/create-deworming-event.dto.js';
import { CreateTreatmentDto } from '../../../presentation/dto/encounters/create-treatment.dto.js';
import { CreateSurgeryDto } from '../../../presentation/dto/encounters/create-surgery.dto.js';
import { CreateProcedureDto } from '../../../presentation/dto/encounters/create-procedure.dto.js';
import { UpsertVaccinationDraftDto } from '../../../presentation/dto/encounters/upsert-vaccination-draft.dto.js';
import {
  EncounterListItemDto,
  EncounterResponseDto,
} from '../../../presentation/dto/encounters/encounter-response.dto.js';
import { EncounterCoreService } from './encounter-core.service.js';
import { EncounterRecordsService } from './encounter-records.service.js';
import { EncounterActionsService } from './encounter-actions.service.js';
import { EncounterTreatmentService } from './encounter-treatment.service.js';
import { EncounterActionDraftService } from './encounter-action-draft.service.js';

@Injectable()
export class EncountersService {
  constructor(
    private readonly coreService: EncounterCoreService,
    private readonly recordsService: EncounterRecordsService,
    private readonly actionsService: EncounterActionsService,
    private readonly treatmentService: EncounterTreatmentService,
    private readonly draftService: EncounterActionDraftService,
  ) {}

  /**
   * Crea la atención principal de un paciente.
   */
  async create(
    dto: CreateEncounterDto,
    userId: number,
    roles: string[],
  ): Promise<EncounterResponseDto> {
    return this.coreService.create(dto, userId, roles);
  }

  /**
   * Lista atenciones con paginación simple.
   */
  async findAll(
    patientId?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: EncounterListItemDto[]; total: number; page: number; limit: number }> {
    return this.coreService.findAll(patientId, page, limit);
  }

  /**
   * Obtiene una atención completa.
   */
  async findOne(id: number): Promise<EncounterResponseDto> {
    return this.coreService.findOne(id);
  }

  /**
   * Finaliza una atención abierta.
   */
  async closeEncounter(
    id: number,
    dto: CloseEncounterDto,
    userId: number,
  ): Promise<EncounterResponseDto> {
    return this.coreService.closeEncounter(id, dto, userId);
  }

  /**
   * Reactiva una atención finalizada dentro de la ventana de gracia.
   */
  async reactivateEncounter(id: number, userId: number): Promise<EncounterResponseDto> {
    return this.coreService.reactivateEncounter(id, userId);
  }

  /**
   * Anula una atención abierta.
   */
  async cancelEncounter(id: number): Promise<EncounterResponseDto> {
    return this.coreService.cancelEncounter(id);
  }

  /**
   * Registra o reemplaza el motivo de consulta.
   */
  async upsertConsultationReason(
    encounterId: number,
    dto: UpsertConsultationReasonDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertConsultationReason(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra o reemplaza la anamnesis.
   */
  async upsertAnamnesis(
    encounterId: number,
    dto: UpsertAnamnesisDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertAnamnesis(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra o reemplaza el examen clínico.
   */
  async upsertClinicalExam(
    encounterId: number,
    dto: UpsertClinicalExamDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertClinicalExam(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra o reemplaza datos ambientales y de manejo.
   */
  async upsertEnvironmentalData(
    encounterId: number,
    dto: UpsertEnvironmentalDataDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertEnvironmentalData(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra o reemplaza la impresión clínica.
   */
  async upsertClinicalImpression(
    encounterId: number,
    dto: UpsertClinicalImpressionDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertClinicalImpression(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra o reemplaza el plan clínico.
   */
  async upsertPlan(encounterId: number, dto: UpsertPlanDto): Promise<EncounterResponseDto> {
    await this.recordsService.upsertPlan(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra una vacunación en la atención y la replica al carnet.
   */
  async addVaccinationEvent(
    encounterId: number,
    dto: CreateVaccinationEventDto,
  ): Promise<EncounterResponseDto> {
    await this.actionsService.addVaccinationEvent(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra una desparasitación en la atención.
   */
  async addDewormingEvent(
    encounterId: number,
    dto: CreateDewormingEventDto,
  ): Promise<EncounterResponseDto> {
    await this.actionsService.addDewormingEvent(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra un tratamiento y deja listo su cierre automático por fecha.
   */
  async addTreatment(
    encounterId: number,
    dto: CreateTreatmentDto,
  ): Promise<EncounterResponseDto> {
    await this.treatmentService.addTreatment(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra una cirugía en la atención.
   */
  async addSurgery(
    encounterId: number,
    dto: CreateSurgeryDto,
  ): Promise<EncounterResponseDto> {
    await this.actionsService.addSurgery(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  /**
   * Registra un procedimiento clínico.
   */
  async addProcedure(
    encounterId: number,
    dto: CreateProcedureDto,
  ): Promise<EncounterResponseDto> {
    await this.actionsService.addProcedure(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async createVaccinationDraft(
    encounterId: number,
    dto: UpsertVaccinationDraftDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.createVaccinationDraft(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async updateVaccinationDraft(
    encounterId: number,
    draftId: number,
    dto: UpsertVaccinationDraftDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.updateVaccinationDraft(encounterId, draftId, dto);
    return this.coreService.findOne(encounterId);
  }

  async deleteVaccinationDraft(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterResponseDto> {
    await this.draftService.deleteVaccinationDraft(encounterId, draftId);
    return this.coreService.findOne(encounterId);
  }

  async createTreatmentDraft(
    encounterId: number,
    dto: CreateTreatmentDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.createTreatmentDraft(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async updateTreatmentDraft(
    encounterId: number,
    draftId: number,
    dto: CreateTreatmentDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.updateTreatmentDraft(encounterId, draftId, dto);
    return this.coreService.findOne(encounterId);
  }

  async deleteTreatmentDraft(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterResponseDto> {
    await this.draftService.deleteTreatmentDraft(encounterId, draftId);
    return this.coreService.findOne(encounterId);
  }

  async createProcedureDraft(
    encounterId: number,
    dto: CreateProcedureDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.createProcedureDraft(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async updateProcedureDraft(
    encounterId: number,
    draftId: number,
    dto: CreateProcedureDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.updateProcedureDraft(encounterId, draftId, dto);
    return this.coreService.findOne(encounterId);
  }

  async deleteProcedureDraft(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterResponseDto> {
    await this.draftService.deleteProcedureDraft(encounterId, draftId);
    return this.coreService.findOne(encounterId);
  }
}
