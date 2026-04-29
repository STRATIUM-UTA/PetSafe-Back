import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EncounterConsultationReason } from '../../../domain/entities/encounters/encounter-consultation-reason.entity.js';
import { EncounterAnamnesis } from '../../../domain/entities/encounters/encounter-anamnesis.entity.js';
import { EncounterClinicalExam } from '../../../domain/entities/encounters/encounter-clinical-exam.entity.js';
import { EncounterEnvironmentalData } from '../../../domain/entities/encounters/encounter-environmental-data.entity.js';
import { EncounterClinicalImpression } from '../../../domain/entities/encounters/encounter-clinical-impression.entity.js';
import { EncounterPlan } from '../../../domain/entities/encounters/encounter-plan.entity.js';
import { EncounterFollowUpConfig } from '../../../domain/entities/encounters/encounter-follow-up-config.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { UpsertConsultationReasonDto } from '../../../presentation/dto/encounters/upsert-consultation-reason.dto.js';
import { UpsertAnamnesisDto } from '../../../presentation/dto/encounters/upsert-anamnesis.dto.js';
import { UpsertClinicalExamDto } from '../../../presentation/dto/encounters/upsert-clinical-exam.dto.js';
import { UpsertEnvironmentalDataDto } from '../../../presentation/dto/encounters/upsert-environmental-data.dto.js';
import { UpsertClinicalImpressionDto } from '../../../presentation/dto/encounters/upsert-clinical-impression.dto.js';
import { UpsertPlanDto } from '../../../presentation/dto/encounters/upsert-plan.dto.js';
import { EncounterFollowUpActionEnum } from '../../../domain/enums/index.js';
import { EncounterSharedService } from './encounter-shared.service.js';
import { UpsertFollowUpConfigDto } from '../../../presentation/dto/encounters/upsert-follow-up-config.dto.js';

@Injectable()
export class EncounterRecordsService {
  constructor(
    @InjectRepository(EncounterConsultationReason)
    private readonly consultationReasonRepo: Repository<EncounterConsultationReason>,
    @InjectRepository(EncounterAnamnesis)
    private readonly anamnesisRepo: Repository<EncounterAnamnesis>,
    @InjectRepository(EncounterClinicalExam)
    private readonly clinicalExamRepo: Repository<EncounterClinicalExam>,
    @InjectRepository(EncounterEnvironmentalData)
    private readonly environmentalDataRepo: Repository<EncounterEnvironmentalData>,
    @InjectRepository(EncounterClinicalImpression)
    private readonly clinicalImpressionRepo: Repository<EncounterClinicalImpression>,
    @InjectRepository(EncounterPlan)
    private readonly planRepo: Repository<EncounterPlan>,
    @InjectRepository(EncounterFollowUpConfig)
    private readonly followUpConfigRepo: Repository<EncounterFollowUpConfig>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly sharedService: EncounterSharedService,
  ) {}

  /**
   * Registra o reemplaza el motivo de consulta y antecedentes inmediatos.
   */
  async upsertConsultationReason(
    encounterId: number,
    dto: UpsertConsultationReasonDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.consultationReasonRepo.save({
      encounterId,
      consultationReason: dto.consultationReason,
      currentIllnessHistory: dto.currentIllnessHistory ?? null,
      referredPreviousDiagnoses: dto.referredPreviousDiagnoses ?? null,
      referredPreviousTreatments: dto.referredPreviousTreatments ?? null,
    });
  }

  /**
   * Registra o reemplaza la anamnesis completa del paciente en esta atención.
   */
  async upsertAnamnesis(encounterId: number, dto: UpsertAnamnesisDto): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.anamnesisRepo.save({
      encounterId,
      problemStartText: dto.problemStartText ?? null,
      previousSurgeriesText: dto.previousSurgeriesText ?? null,
      howProblemStartedText: dto.howProblemStartedText ?? null,
      vaccinesUpToDate: dto.vaccinesUpToDate ?? null,
      dewormingUpToDate: dto.dewormingUpToDate ?? null,
      hasPetAtHome: dto.hasPetAtHome ?? null,
      petAtHomeDetail: dto.petAtHomeDetail ?? null,
      administeredMedicationText: dto.administeredMedicationText ?? null,
      appetiteStatus: dto.appetiteStatus ?? null,
      waterIntakeStatus: dto.waterIntakeStatus ?? null,
      fecesText: dto.fecesText ?? null,
      vomitText: dto.vomitText ?? null,
      numberOfBowelMovements: dto.numberOfBowelMovements ?? null,
      urineText: dto.urineText ?? null,
      respiratoryProblemsText: dto.respiratoryProblemsText ?? null,
      difficultyWalkingText: dto.difficultyWalkingText ?? null,
      notes: dto.notes ?? null,
    });
  }

  /**
   * Registra o reemplaza el examen clínico del encounter.
   */
  async upsertClinicalExam(
    encounterId: number,
    dto: UpsertClinicalExamDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.clinicalExamRepo.save({
      encounterId,
      weightKg: dto.weightKg ?? null,
      temperatureC: dto.temperatureC ?? null,
      pulse: dto.pulse ?? null,
      heartRate: dto.heartRate ?? null,
      respiratoryRate: dto.respiratoryRate ?? null,
      mucousMembranes: dto.mucousMembranes ?? null,
      lymphNodes: dto.lymphNodes ?? null,
      hydration: dto.hydration ?? null,
      crtSeconds: dto.crtSeconds ?? null,
      examNotes: dto.examNotes ?? null,
    });

    if (dto.weightKg !== undefined && dto.weightKg !== null) {
      await this.patientRepo.update(encounter.patientId, {
        currentWeight: dto.weightKg,
      });
    }
  }

  /**
   * Registra o reemplaza los datos ambientales y de estilo de vida.
   */
  async upsertEnvironmentalData(
    encounterId: number,
    dto: UpsertEnvironmentalDataDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.environmentalDataRepo.save({
      encounterId,
      environmentNotes: dto.environmentNotes ?? null,
      nutritionNotes: dto.nutritionNotes ?? null,
      lifestyleNotes: dto.lifestyleNotes ?? null,
      feedingTypeNotes: dto.feedingTypeNotes ?? null,
      notes: dto.notes ?? null,
    });
  }

  /**
   * Registra o reemplaza la impresión clínica del veterinario.
   */
  async upsertClinicalImpression(
    encounterId: number,
    dto: UpsertClinicalImpressionDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.clinicalImpressionRepo.save({
      encounterId,
      presumptiveDiagnosis: dto.presumptiveDiagnosis ?? null,
      differentialDiagnosis: dto.differentialDiagnosis ?? null,
      prognosis: dto.prognosis ?? null,
      clinicalNotes: dto.clinicalNotes ?? null,
    });
  }

  /**
   * Registra o reemplaza el plan clínico documentado.
   */
  async upsertPlan(encounterId: number, dto: UpsertPlanDto): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    await this.planRepo.save({
      encounterId,
      clinicalPlan: dto.clinicalPlan ?? null,
      planNotes: dto.planNotes ?? null,
    });
  }

  async upsertFollowUpConfig(
    encounterId: number,
    dto: UpsertFollowUpConfigDto,
  ): Promise<void> {
    const encounter = await this.sharedService.findEncounterOrFail(encounterId);
    this.sharedService.ensureActive(encounter);

    if (dto.action !== EncounterFollowUpActionEnum.NONE && !encounter.clinicalCaseId) {
      throw new BadRequestException(
        'Debes vincular primero la consulta a un caso clínico antes de definir el seguimiento.',
      );
    }

    await this.followUpConfigRepo.save({
      encounterId,
      action: dto.action,
    });
  }
}
