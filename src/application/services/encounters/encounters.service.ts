import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

import { CreateEncounterDto } from '../../../presentation/dto/encounters/create-encounter.dto.js';
import { CloseEncounterDto } from '../../../presentation/dto/encounters/update-encounter-status.dto.js';
import { UpsertConsultationReasonDto } from '../../../presentation/dto/encounters/upsert-consultation-reason.dto.js';
import { UpsertAnamnesisDto } from '../../../presentation/dto/encounters/upsert-anamnesis.dto.js';
import { UpsertClinicalExamDto } from '../../../presentation/dto/encounters/upsert-clinical-exam.dto.js';
import { UpsertEnvironmentalDataDto } from '../../../presentation/dto/encounters/upsert-environmental-data.dto.js';
import { UpsertClinicalImpressionDto } from '../../../presentation/dto/encounters/upsert-clinical-impression.dto.js';
import { UpsertPlanDto } from '../../../presentation/dto/encounters/upsert-plan.dto.js';
import { UpsertClinicalCaseLinkDto } from '../../../presentation/dto/encounters/upsert-clinical-case-link.dto.js';
import { UpsertFollowUpConfigDto } from '../../../presentation/dto/encounters/upsert-follow-up-config.dto.js';
import { CreateVaccinationEventDto } from '../../../presentation/dto/encounters/create-vaccination-event.dto.js';
import { CreateDewormingEventDto } from '../../../presentation/dto/encounters/create-deworming-event.dto.js';
import { CreateTreatmentDto } from '../../../presentation/dto/encounters/create-treatment.dto.js';
import { CreateSurgeryDto } from '../../../presentation/dto/encounters/create-surgery.dto.js';
import { CreateProcedureDto } from '../../../presentation/dto/encounters/create-procedure.dto.js';
import { UpsertVaccinationDraftDto } from '../../../presentation/dto/encounters/upsert-vaccination-draft.dto.js';
import { UpsertTreatmentReviewDraftDto } from '../../../presentation/dto/encounters/upsert-treatment-review-draft.dto.js';
import {
  EncounterAttachmentResponseDto,
  EncounterListItemDto,
  EncounterResponseDto,
} from '../../../presentation/dto/encounters/encounter-response.dto.js';
import { EncounterCoreService } from './encounter-core.service.js';
import { EncounterRecordsService } from './encounter-records.service.js';
import { EncounterActionsService } from './encounter-actions.service.js';
import { EncounterTreatmentService } from './encounter-treatment.service.js';
import { EncounterActionDraftService } from './encounter-action-draft.service.js';
import { ClinicalCasesService } from '../clinical-cases/clinical-cases.service.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import {
  MediaOwnerTypeEnum,
  MediaTypeEnum,
  StorageProviderEnum,
} from '../../../domain/enums/index.js';
import { ENCOUNTER_UPLOADS_DIR } from '../../../infra/config/uploads.config.js';

@Injectable()
export class EncountersService {
  constructor(
    private readonly coreService: EncounterCoreService,
    private readonly recordsService: EncounterRecordsService,
    private readonly actionsService: EncounterActionsService,
    private readonly treatmentService: EncounterTreatmentService,
    private readonly draftService: EncounterActionDraftService,
    private readonly clinicalCasesService: ClinicalCasesService,
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
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

  async upsertClinicalCaseLink(
    encounterId: number,
    dto: UpsertClinicalCaseLinkDto,
  ): Promise<EncounterResponseDto> {
    await this.clinicalCasesService.upsertEncounterClinicalCaseLink(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async upsertFollowUpConfig(
    encounterId: number,
    dto: UpsertFollowUpConfigDto,
  ): Promise<EncounterResponseDto> {
    await this.recordsService.upsertFollowUpConfig(encounterId, dto);
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

  async upsertTreatmentReviewDraft(
    encounterId: number,
    dto: UpsertTreatmentReviewDraftDto,
  ): Promise<EncounterResponseDto> {
    await this.draftService.upsertTreatmentReviewDraft(encounterId, dto);
    return this.coreService.findOne(encounterId);
  }

  async deleteTreatmentReviewDraft(
    encounterId: number,
    draftId: number,
  ): Promise<EncounterResponseDto> {
    await this.draftService.deleteTreatmentReviewDraft(encounterId, draftId);
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

  // ── Attachments ────────────────────────────────────────────────────────────

  async listAttachments(
    encounterId: number,
    baseUrl: string,
  ): Promise<EncounterAttachmentResponseDto[]> {
    const files = await this.mediaFileRepo.find({
      where: {
        ownerType: MediaOwnerTypeEnum.ATENCION,
        ownerId: encounterId,
      },
      order: { createdAt: 'ASC' },
    });

    return files.map((f) => this.toAttachmentDto(f, baseUrl));
  }

  async uploadAttachment(
    encounterId: number,
    file: any,
    userId: number | null,
    baseUrl: string,
  ): Promise<EncounterAttachmentResponseDto> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }

    // Verify the encounter exists
    await this.coreService.findOne(encounterId);

    const isPdf = file.mimetype === 'application/pdf';
    const mediaType = isPdf ? MediaTypeEnum.PDF : MediaTypeEnum.IMAGEN;
    const storedFilePath = join(ENCOUNTER_UPLOADS_DIR, file.filename);
    const finalSizeBytes = isPdf
      ? await this.optimizePdfAttachment(storedFilePath, file.size)
      : file.size;

    const mediaFile = this.mediaFileRepo.create({
      ownerType: MediaOwnerTypeEnum.ATENCION,
      ownerId: encounterId,
      mediaType,
      provider: StorageProviderEnum.LOCAL,
      url: `uploads/encounters/${file.filename}`,
      storageKey: `uploads/encounters/${file.filename}`,
      originalName: this.normalizeAttachmentOriginalName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: finalSizeBytes,
      width: null,
      height: null,
      metadata: {},
      createdByUserId: userId,
    });

    const saved = await this.mediaFileRepo.save(mediaFile);
    return this.toAttachmentDto(saved, baseUrl);
  }

  async deleteAttachment(
    encounterId: number,
    fileId: number,
  ): Promise<{ success: boolean }> {
    const file = await this.mediaFileRepo.findOne({
      where: {
        id: fileId,
        ownerType: MediaOwnerTypeEnum.ATENCION,
        ownerId: encounterId,
      },
    });

    if (!file) {
      throw new NotFoundException('Archivo adjunto no encontrado.');
    }

    // Try to delete from disk
    if (file.storageKey?.startsWith('uploads/encounters/')) {
      const fileName = file.storageKey.replace('uploads/encounters/', '');
      try {
        await unlink(join(ENCOUNTER_UPLOADS_DIR, fileName));
      } catch {
        // File may have already been removed
      }
    }

    await this.mediaFileRepo.remove(file);
    return { success: true };
  }

  private toAttachmentDto(
    f: MediaFile,
    baseUrl: string,
  ): EncounterAttachmentResponseDto {
    const fileName = f.storageKey?.replace('uploads/encounters/', '') ?? '';
    return {
      id: f.id,
      url: `${baseUrl}/${fileName}`,
      originalName: this.normalizeAttachmentOriginalName(f.originalName),
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes ? Number(f.sizeBytes) : null,
      mediaType: f.mediaType,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    };
  }

  private normalizeAttachmentOriginalName(value: string | null | undefined): string {
    const originalName = value?.trim() || 'archivo';

    try {
      const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
      return decoded.includes('�') ? originalName : decoded;
    } catch {
      return originalName;
    }
  }

  private async optimizePdfAttachment(filePath: string, originalSizeBytes: number): Promise<number> {
    try {
      const originalBytes = await readFile(filePath);
      const pdfDocument = await PDFDocument.load(originalBytes, {
        updateMetadata: false,
        ignoreEncryption: true,
      });

      const optimizedBytes = await pdfDocument.save({
        useObjectStreams: true,
        updateFieldAppearances: false,
        addDefaultPage: false,
      });

      if (optimizedBytes.length > 0 && optimizedBytes.length < originalBytes.length) {
        await writeFile(filePath, optimizedBytes);
        return optimizedBytes.length;
      }
    } catch {
      return originalSizeBytes;
    }

    return originalSizeBytes;
  }
}
