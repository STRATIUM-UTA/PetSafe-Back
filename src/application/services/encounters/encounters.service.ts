import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { EncounterConsultationReason } from '../../../domain/entities/encounters/encounter-consultation-reason.entity.js';
import { EncounterAnamnesis } from '../../../domain/entities/encounters/encounter-anamnesis.entity.js';
import { EncounterClinicalExam } from '../../../domain/entities/encounters/encounter-clinical-exam.entity.js';
import { EncounterEnvironmentalData } from '../../../domain/entities/encounters/encounter-environmental-data.entity.js';
import { EncounterClinicalImpression } from '../../../domain/entities/encounters/encounter-clinical-impression.entity.js';
import { EncounterPlan } from '../../../domain/entities/encounters/encounter-plan.entity.js';
import { VaccinationEvent } from '../../../domain/entities/encounters/vaccination-event.entity.js';
import { DewormingEvent } from '../../../domain/entities/encounters/deworming-event.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { Surgery } from '../../../domain/entities/encounters/surgery.entity.js';
import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { Antiparasitic } from '../../../domain/entities/catalogs/antiparasitic.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';

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
import {
  EncounterResponseDto,
  EncounterListItemDto,
} from '../../../presentation/dto/encounters/encounter-response.dto.js';
import { EncounterMapper } from '../../mappers/encounter.mapper.js';
import { EncounterStatusEnum, SurgeryStatusEnum, TreatmentStatusEnum } from '../../../domain/enums/index.js';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
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
    @InjectRepository(VaccinationEvent)
    private readonly vaccinationRepo: Repository<VaccinationEvent>,
    @InjectRepository(DewormingEvent)
    private readonly dewormingRepo: Repository<DewormingEvent>,
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(TreatmentItem)
    private readonly treatmentItemRepo: Repository<TreatmentItem>,
    @InjectRepository(Surgery)
    private readonly surgeryRepo: Repository<Surgery>,
    @InjectRepository(Procedure)
    private readonly procedureRepo: Repository<Procedure>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(Antiparasitic)
    private readonly antiparasiticRepo: Repository<Antiparasitic>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientVaccineRecord)
    private readonly patientVaccineRecordRepo: Repository<PatientVaccineRecord>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findEncounterOrFail(id: number): Promise<Encounter> {
    const enc = await this.encounterRepo.findOne({
      where: { id },
      relations: [
        'consultationReason',
        'anamnesis',
        'clinicalExam',
        'environmentalData',
        'clinicalImpression',
        'plan',
        'vaccinationEvents',
        'vaccinationEvents.vaccine',
        'dewormingEvents',
        'dewormingEvents.product',
        'treatments',
        'treatments.items',
        'surgeries',
        'procedures',
      ],
    });
    if (!enc || enc.deletedAt) {
      throw new NotFoundException('Atención no encontrada.');
    }
    return enc;
  }

  private ensureActive(enc: Encounter): void {
    if (enc.status !== EncounterStatusEnum.ACTIVA) {
      throw new ConflictException(
        `La atención ya está en estado "${enc.status}". No se puede modificar.`,
      );
    }
  }

  // ── CRUD principal ─────────────────────────────────────────────────────────

  async create(dto: CreateEncounterDto, userId: number): Promise<EncounterResponseDto> {
    // Verificar que el paciente existe
    const patient = await this.patientRepo.findOne({ where: { id: dto.patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    const enc = this.encounterRepo.create({
      patientId: dto.patientId,
      vetId: dto.vetId,
      startTime: new Date(dto.startTime),
      appointmentId: dto.appointmentId ?? null,
      queueEntryId: dto.queueEntryId ?? null,
      generalNotes: dto.generalNotes ?? null,
      status: EncounterStatusEnum.ACTIVA,
      createdByUserId: userId,
    });

    const saved = await this.encounterRepo.save(enc);
    return this.findOne(saved.id);
  }

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

  async findOne(id: number): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(id);
    return EncounterMapper.toResponseDto(enc);
  }

  async closeEncounter(id: number, dto: CloseEncounterDto): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(id);
    this.ensureActive(enc);

    const endTime = new Date(dto.endTime);
    if (endTime < enc.startTime) {
      throw new BadRequestException('La hora de finalización no puede ser anterior a la hora de inicio.');
    }

    await this.encounterRepo.update(id, {
      status: EncounterStatusEnum.FINALIZADA,
      endTime,
      generalNotes: dto.generalNotes ?? enc.generalNotes,
    });

    return this.findOne(id);
  }

  async cancelEncounter(id: number): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(id);
    this.ensureActive(enc);

    await this.encounterRepo.update(id, {
      status: EncounterStatusEnum.ANULADA,
    });

    return this.findOne(id);
  }

  // ── Upserts de sub-entidades 1:1 ──────────────────────────────────────────

  async upsertConsultationReason(
    encounterId: number,
    dto: UpsertConsultationReasonDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    await this.consultationReasonRepo.save({
      encounterId,
      consultationReason: dto.consultationReason,
      currentIllnessHistory: dto.currentIllnessHistory ?? null,
      referredPreviousDiagnoses: dto.referredPreviousDiagnoses ?? null,
      referredPreviousTreatments: dto.referredPreviousTreatments ?? null,
    });

    return this.findOne(encounterId);
  }

  async upsertAnamnesis(
    encounterId: number,
    dto: UpsertAnamnesisDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

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

    return this.findOne(encounterId);
  }

  async upsertClinicalExam(
    encounterId: number,
    dto: UpsertClinicalExamDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

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

    return this.findOne(encounterId);
  }

  async upsertEnvironmentalData(
    encounterId: number,
    dto: UpsertEnvironmentalDataDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    await this.environmentalDataRepo.save({
      encounterId,
      environmentNotes: dto.environmentNotes ?? null,
      nutritionNotes: dto.nutritionNotes ?? null,
      lifestyleNotes: dto.lifestyleNotes ?? null,
      feedingTypeNotes: dto.feedingTypeNotes ?? null,
      notes: dto.notes ?? null,
    });

    return this.findOne(encounterId);
  }

  async upsertClinicalImpression(
    encounterId: number,
    dto: UpsertClinicalImpressionDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    await this.clinicalImpressionRepo.save({
      encounterId,
      presumptiveDiagnosis: dto.presumptiveDiagnosis ?? null,
      differentialDiagnosis: dto.differentialDiagnosis ?? null,
      prognosis: dto.prognosis ?? null,
      clinicalNotes: dto.clinicalNotes ?? null,
    });

    return this.findOne(encounterId);
  }

  async upsertPlan(
    encounterId: number,
    dto: UpsertPlanDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    const requiresFollowUp = dto.requiresFollowUp ?? false;

    if (requiresFollowUp && !dto.suggestedFollowUpDate) {
      throw new BadRequestException('La fecha de seguimiento es obligatoria cuando se requiere seguimiento.');
    }

    await this.planRepo.save({
      encounterId,
      clinicalPlan: dto.clinicalPlan ?? null,
      requiresFollowUp,
      suggestedFollowUpDate: dto.suggestedFollowUpDate ? new Date(dto.suggestedFollowUpDate) : null,
      planNotes: dto.planNotes ?? null,
    });

    return this.findOne(encounterId);
  }

  // ── Eventos de vacunación ─────────────────────────────────────────────────

  async addVaccinationEvent(
    encounterId: number,
    dto: CreateVaccinationEventDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    const vaccine = await this.vaccineRepo.findOne({ where: { id: dto.vaccineId } });
    if (!vaccine) {
      throw new NotFoundException('Vacuna no encontrada en el catálogo.');
    }

    const event = this.vaccinationRepo.create({
      encounterId,
      vaccineId: dto.vaccineId,
      applicationDate: new Date(dto.applicationDate),
      suggestedNextDate: dto.suggestedNextDate ? new Date(dto.suggestedNextDate) : null,
      notes: dto.notes ?? null,
    });
    
    // Automatización: También guardamos en el carnet permanente (PatientVaccineRecord)
    const carnetRecord = this.patientVaccineRecordRepo.create({
      patientId: enc.patientId,
      vaccineId: dto.vaccineId,
      applicationDate: new Date(dto.applicationDate),
      administeredBy: 'Veterinario en Consulta',
      isExternal: false,
      nextDoseDate: dto.suggestedNextDate ? new Date(dto.suggestedNextDate) : null,
      notes: dto.notes ?? 'Aplicada en consulta médica',
      encounterId: enc.id,
      createdByUserId: enc.createdByUserId,
    });

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.save(VaccinationEvent, event);
      await manager.save(PatientVaccineRecord, carnetRecord);
    });

    return this.findOne(encounterId);
  }

  // ── Eventos de desparasitación ────────────────────────────────────────────

  async addDewormingEvent(
    encounterId: number,
    dto: CreateDewormingEventDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    const product = await this.antiparasiticRepo.findOne({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException('Antiparasitario no encontrado en el catálogo.');
    }

    const event = this.dewormingRepo.create({
      encounterId,
      productId: dto.productId,
      applicationDate: new Date(dto.applicationDate),
      suggestedNextDate: dto.suggestedNextDate ? new Date(dto.suggestedNextDate) : null,
      notes: dto.notes ?? null,
    });

    await this.dewormingRepo.save(event);
    return this.findOne(encounterId);
  }

  // ── Tratamientos ──────────────────────────────────────────────────────────

  async addTreatment(
    encounterId: number,
    dto: CreateTreatmentDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatment = manager.create(Treatment, {
        encounterId,
        status: TreatmentStatusEnum.ACTIVO,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        generalInstructions: dto.generalInstructions ?? null,
      });
      const savedTreatment = await manager.save(Treatment, treatment);

      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item) =>
          manager.create(TreatmentItem, {
            treatmentId: savedTreatment.id,
            medication: item.medication,
            dose: item.dose,
            frequency: item.frequency,
            durationDays: item.durationDays,
            administrationRoute: item.administrationRoute,
            notes: item.notes ?? null,
            status: item.status,
          }),
        );
        await manager.save(TreatmentItem, items);
      }

      return this.findOne(encounterId);
    });
  }

  // ── Cirugías ──────────────────────────────────────────────────────────────

  async addSurgery(
    encounterId: number,
    dto: CreateSurgeryDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    const surgery = this.surgeryRepo.create({
      encounterId,
      surgeryType: dto.surgeryType,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      performedDate: dto.performedDate ? new Date(dto.performedDate) : null,
      surgeryStatus: dto.surgeryStatus ?? SurgeryStatusEnum.PROGRAMADA,
      description: dto.description ?? null,
      postoperativeInstructions: dto.postoperativeInstructions ?? null,
    });

    await this.surgeryRepo.save(surgery);
    return this.findOne(encounterId);
  }

  // ── Procedimientos ────────────────────────────────────────────────────────

  async addProcedure(
    encounterId: number,
    dto: CreateProcedureDto,
  ): Promise<EncounterResponseDto> {
    const enc = await this.findEncounterOrFail(encounterId);
    this.ensureActive(enc);

    const procedure = this.procedureRepo.create({
      encounterId,
      procedureType: dto.procedureType,
      performedDate: new Date(dto.performedDate),
      description: dto.description ?? null,
      result: dto.result ?? null,
      notes: dto.notes ?? null,
    });

    await this.procedureRepo.save(procedure);
    return this.findOne(encounterId);
  }
}
