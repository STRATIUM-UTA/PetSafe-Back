import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, ObjectLiteral, Repository } from 'typeorm';

import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { PatientVaccinationPlanDose } from '../../../domain/entities/vaccinations/patient-vaccination-plan-dose.entity.js';
import { VaccinationScheme } from '../../../domain/entities/vaccinations/vaccination-scheme.entity.js';
import { VaccinationSchemeVersion } from '../../../domain/entities/vaccinations/vaccination-scheme-version.entity.js';
import { VaccinationSchemeVersionDose } from '../../../domain/entities/vaccinations/vaccination-scheme-version-dose.entity.js';
import {
  PatientVaccinationPlanDoseStatusEnum,
  PatientVaccinationPlanStatusEnum,
  VaccinationSchemeVersionStatusEnum,
} from '../../../domain/enums/index.js';
import { UpdatePatientVaccinationPlanDoseDto } from '../../../presentation/dto/vaccinations/update-patient-vaccination-plan-dose.dto.js';
import {
  PatientVaccinationPlanCoverageDto,
  PatientVaccinationPlanDoseResponseDto,
  PatientVaccinationPlanResponseDto,
  PatientVaccineRecordResponseDto,
  VaccinationSchemeVersionResponseDto,
} from '../../../presentation/dto/vaccinations/vaccination-response.dto.js';
import { PatientVaccinationPlanChangeModeEnum } from '../../../presentation/dto/patients/update-patient-vaccination-scheme.dto.js';

@Injectable()
export class VaccinationPlanService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(PatientVaccineRecord)
    private readonly applicationRepo: Repository<PatientVaccineRecord>,
    @InjectRepository(VaccinationScheme)
    private readonly schemeRepo: Repository<VaccinationScheme>,
    @InjectRepository(VaccinationSchemeVersion)
    private readonly schemeVersionRepo: Repository<VaccinationSchemeVersion>,
    @InjectRepository(VaccinationSchemeVersionDose)
    private readonly schemeDoseRepo: Repository<VaccinationSchemeVersionDose>,
    @InjectRepository(PatientVaccinationPlan)
    private readonly planRepo: Repository<PatientVaccinationPlan>,
    @InjectRepository(PatientVaccinationPlanDose)
    private readonly planDoseRepo: Repository<PatientVaccinationPlanDose>,
  ) {}

  async initializePlanForPatient(
    patientId: number,
    speciesId: number,
    birthDate: Date | null,
    vaccinationSchemeId?: number | null,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan> {
    const existingPlan = await this.findActivePlan(patientId, manager);
    if (existingPlan) {
      return existingPlan;
    }

    const schemeVersion = await this.resolveSchemeVersionForPatient(
      speciesId,
      vaccinationSchemeId ?? null,
      manager,
    );
    this.assertSchemeVersionCanGeneratePlan(schemeVersion);
    const planRepo = this.getRepo(PatientVaccinationPlan, this.planRepo, manager);
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);

    const assignedAt = new Date();
    const plan = await planRepo.save(
      planRepo.create({
        patientId,
        schemeVersionId: schemeVersion.id,
        status: PatientVaccinationPlanStatusEnum.ACTIVO,
        assignedAt,
        notes: null,
      }),
    );

    const doses = this.buildPlanDoses(plan.id, schemeVersion, birthDate, assignedAt);
    if (doses.length > 0) {
      await planDoseRepo.save(doses);
    }

    return (await this.findActivePlan(patientId, manager))!;
  }

  async hasUsableSchemeForSpecies(
    speciesId: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const versionRepo = this.getRepo(
      VaccinationSchemeVersion,
      this.schemeVersionRepo,
      manager,
    );

    const versions = await versionRepo
      .createQueryBuilder('version')
      .innerJoin('version.scheme', 'scheme')
      .leftJoinAndSelect('version.doses', 'doses')
      .leftJoinAndSelect('doses.vaccine', 'vaccine')
      .where('scheme.species_id = :speciesId', { speciesId })
      .andWhere('scheme.deleted_at IS NULL')
      .andWhere('scheme.is_active = true')
      .andWhere('version.deleted_at IS NULL')
      .andWhere('version.is_active = true')
      .andWhere('version.status = :status', {
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      })
      .andWhere('version.valid_from <= CURRENT_DATE')
      .andWhere('(version.valid_to IS NULL OR version.valid_to >= CURRENT_DATE)')
      .orderBy('version.version', 'DESC')
      .addOrderBy('version.valid_from', 'DESC')
      .getMany();

    return versions.some((version) => this.isSchemeVersionPlanCompatible(version));
  }

  async initializePlanForExistingPatient(
    patientId: number,
    vaccinationSchemeId?: number | null,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan> {
    const patient = await this.findPatientOrFail(patientId, manager);
    const existingPlan = await this.findActivePlan(patientId, manager);
    if (existingPlan) {
      return existingPlan;
    }

    if (
      !vaccinationSchemeId &&
      !(await this.hasUsableSchemeForSpecies(patient.speciesId, manager))
    ) {
      throw new BadRequestException(
        'La especie de la mascota no tiene un esquema vacunal utilizable en este momento.',
      );
    }

    return this.initializePlanForPatient(
      patient.id,
      patient.speciesId,
      patient.birthDate ?? null,
      vaccinationSchemeId ?? null,
      manager,
    );
  }

  async syncPatientPlanAfterPatientUpdate(
    patientId: number,
    speciesId: number,
    birthDate: Date | null,
    manager?: EntityManager,
  ): Promise<void> {
    const activePlan = await this.findActivePlan(patientId, manager);
    if (!activePlan) {
      return;
    }

    if (activePlan.schemeVersion.scheme.speciesId !== speciesId) {
      await this.reassignPlanForSpeciesChange(patientId, speciesId, birthDate, manager);
      return;
    }

    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const assignedAt = activePlan.assignedAt ?? new Date();
    let previousReferenceDate: Date | null = null;

    for (const planDose of activePlan.doses.sort((a, b) => a.doseOrder - b.doseOrder)) {
      const recalculated = this.buildPlanDoseSnapshot(
        activePlan.id,
        activePlan.schemeVersion,
        planDose.schemeDose,
        birthDate,
        assignedAt,
        previousReferenceDate,
      );

      if (planDose.status !== PatientVaccinationPlanDoseStatusEnum.APLICADA) {
        planDose.expectedDate = recalculated.expectedDate ?? null;
        planDose.status =
          recalculated.status ?? PatientVaccinationPlanDoseStatusEnum.NO_APLICADA;

        await planDoseRepo.update(planDose.id, {
          expectedDate: planDose.expectedDate,
          status: planDose.status,
        });
      }

      previousReferenceDate =
        planDose.appliedAt ?? planDose.expectedDate ?? previousReferenceDate;
    }
  }

  async registerApplication(
    patientId: number,
    vaccineId: number,
    applicationDate: Date,
    applicationRecordId: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    await this.initializePlanForExistingPatient(patientId, null, manager);

    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const candidate = await planDoseRepo
      .createQueryBuilder('dose')
      .innerJoinAndSelect('dose.plan', 'plan')
      .where('plan.patient_id = :patientId', { patientId })
      .andWhere('plan.deleted_at IS NULL')
      .andWhere('plan.status = :status', { status: PatientVaccinationPlanStatusEnum.ACTIVO })
      .andWhere('dose.vaccine_id = :vaccineId', { vaccineId })
      .andWhere('dose.deleted_at IS NULL')
      .andWhere('dose.status IN (:...statuses)', {
        statuses: [
          PatientVaccinationPlanDoseStatusEnum.NO_APLICADA,
          PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA,
          PatientVaccinationPlanDoseStatusEnum.REQUIERE_REVISION,
        ],
      })
      .orderBy('dose.dose_order', 'ASC')
      .addOrderBy('dose.expected_date', 'ASC', 'NULLS LAST')
      .getOne();

    if (!candidate) {
      return null;
    }

    candidate.status = PatientVaccinationPlanDoseStatusEnum.APLICADA;
    candidate.appliedAt = applicationDate;
    candidate.applicationRecordId = applicationRecordId;
    await planDoseRepo.save(candidate);

    return candidate.id;
  }

  async registerApplicationForPlanDose(
    patientId: number,
    planDoseId: number,
    vaccineId: number,
    applicationDate: Date,
    applicationRecordId: number,
    manager?: EntityManager,
  ): Promise<number> {
    await this.initializePlanForExistingPatient(patientId, null, manager);

    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const targetDose = await planDoseRepo.findOne({
      where: {
        id: planDoseId,
        deletedAt: IsNull(),
      } as never,
      relations: ['plan'],
    });

    if (
      !targetDose
      || !targetDose.plan
      || targetDose.plan.deletedAt
      || targetDose.plan.patientId !== patientId
      || targetDose.plan.status !== PatientVaccinationPlanStatusEnum.ACTIVO
    ) {
      throw new BadRequestException(
        'La dosis pendiente ya no pertenece al plan vacunal activo del paciente.',
      );
    }

    if (targetDose.vaccineId !== vaccineId) {
      throw new BadRequestException(
        'La vacuna aplicada no coincide con la dosis pendiente seleccionada del plan vacunal.',
      );
    }

    if (
      targetDose.status === PatientVaccinationPlanDoseStatusEnum.APLICADA
      || targetDose.applicationRecordId
    ) {
      throw new BadRequestException(
        'La dosis pendiente seleccionada ya fue aplicada previamente.',
      );
    }

    targetDose.status = PatientVaccinationPlanDoseStatusEnum.APLICADA;
    targetDose.appliedAt = applicationDate;
    targetDose.applicationRecordId = applicationRecordId;
    await planDoseRepo.save(targetDose);

    return targetDose.id;
  }

  async rollbackApplicationRecord(
    patientId: number,
    applicationRecordId: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const targetDose = await planDoseRepo.findOne({
      where: {
        applicationRecordId,
        deletedAt: IsNull(),
      } as never,
      relations: ['plan', 'plan.patient', 'schemeDose'],
    });

    if (!targetDose) {
      return null;
    }

    if (!targetDose.plan || targetDose.plan.patientId !== patientId) {
      throw new BadRequestException(
        'La aplicación vacunal no coincide con el plan activo del paciente.',
      );
    }

    targetDose.status = this.getRestoredDoseStatus(
      targetDose.plan.patient?.birthDate ?? null,
      targetDose.schemeDose,
      targetDose.expectedDate ?? null,
      new Date(),
    );
    targetDose.appliedAt = null;
    targetDose.applicationRecordId = null;
    await planDoseRepo.save(targetDose);

    return targetDose.id;
  }

  async blockPendingDosesForInactiveProduct(
    vaccineId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const doses = await planDoseRepo.find({
      where: {
        vaccineId,
        deletedAt: IsNull(),
      } as never,
    });

    for (const dose of doses) {
      if (dose.status === PatientVaccinationPlanDoseStatusEnum.APLICADA) {
        continue;
      }

      await planDoseRepo.update(dose.id, {
        status: PatientVaccinationPlanDoseStatusEnum.BLOQUEADA,
        notes: this.appendNote(dose.notes, 'Producto biológico desactivado del catálogo.'),
      });
    }
  }

  async unblockPendingDosesForReactivatedProduct(
    vaccineId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const doses = await planDoseRepo.find({
      where: {
        vaccineId,
        deletedAt: IsNull(),
        status: PatientVaccinationPlanDoseStatusEnum.BLOQUEADA,
      } as never,
      relations: ['plan', 'plan.patient', 'schemeDose'],
    });

    const recalculationDate = new Date();
    for (const dose of doses) {
      const restoredStatus = this.getRestoredDoseStatus(
        dose.plan?.patient?.birthDate ?? null,
        dose.schemeDose,
        dose.expectedDate ?? null,
        recalculationDate,
      );

      await planDoseRepo.update(dose.id, {
        status: restoredStatus,
        notes: this.appendNote(dose.notes, 'Producto biológico reactivado en el catálogo.'),
      });
    }
  }

  async getPatientPlanDetail(
    patientId: number,
    manager?: EntityManager,
    extraAlerts: string[] = [],
  ): Promise<PatientVaccinationPlanResponseDto> {
    await this.findPatientOrFail(patientId, manager);
    const plan = await this.findActivePlan(patientId, manager);
    if (!plan) {
      throw new NotFoundException('La mascota no tiene plan vacunal generado.');
    }

    const applications = await this.findApplicationsForPatient(patientId, manager);
    const doses = plan.doses
      .filter((dose) => !dose.deletedAt)
      .sort((a, b) => a.doseOrder - b.doseOrder)
      .map((dose) => this.toPlanDoseResponse(dose));

    const coverage = this.calculateCoverage(doses);
    const alerts = [...this.buildAlerts(doses), ...extraAlerts];

    return {
      id: plan.id,
      patientId,
      status: plan.status,
      assignedAt: plan.assignedAt.toISOString(),
      notes: plan.notes ?? null,
      scheme: {
        id: plan.schemeVersion.scheme.id,
        name: plan.schemeVersion.scheme.name,
        species: {
          id: plan.schemeVersion.scheme.species.id,
          name: plan.schemeVersion.scheme.species.name,
        },
      },
      version: this.toSchemeVersionResponse(plan.schemeVersion),
      doses,
      applications,
      coverage,
      alerts,
    };
  }

  async updatePlanDoseStatus(
    patientId: number,
    planDoseId: number,
    dto: UpdatePatientVaccinationPlanDoseDto,
  ): Promise<PatientVaccinationPlanResponseDto> {
    const planDose = await this.planDoseRepo.findOne({
      where: { id: planDoseId },
      relations: ['plan'],
    });

    if (!planDose || planDose.deletedAt || planDose.plan.patientId !== patientId) {
      throw new NotFoundException('Dosis planificada no encontrada.');
    }

    if (
      planDose.status === PatientVaccinationPlanDoseStatusEnum.APLICADA &&
      dto.status !== PatientVaccinationPlanDoseStatusEnum.APLICADA
    ) {
      throw new BadRequestException(
        'Una dosis ya aplicada solo puede cambiarse registrando una nueva aplicación clínica.',
      );
    }

    if (dto.status === PatientVaccinationPlanDoseStatusEnum.APLICADA) {
      throw new BadRequestException(
        'El estado APLICADA solo puede establecerse mediante un registro de aplicación real.',
      );
    }

    planDose.status = dto.status;
    if (dto.notes !== undefined) {
      planDose.notes = dto.notes ?? null;
    }
    await this.planDoseRepo.save(planDose);

    return this.getPatientPlanDetail(patientId);
  }

  async findApplicationsForPatient(
    patientId: number,
    manager?: EntityManager,
  ): Promise<PatientVaccineRecordResponseDto[]> {
    const applicationRepo = this.getRepo(PatientVaccineRecord, this.applicationRepo, manager);
    const records = await applicationRepo.find({
      where: {
        patientId,
        deletedAt: IsNull(),
      } as never,
      relations: ['vaccine', 'vaccine.species', 'administeredByEmployee', 'administeredByEmployee.person'],
      order: { applicationDate: 'DESC', createdAt: 'DESC' },
    });

    const planDoseByRecordId = new Map<number, number>();
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const linkedPlanDoses = await planDoseRepo
      .createQueryBuilder('dose')
      .innerJoin('dose.plan', 'plan')
      .where('plan.patient_id = :patientId', { patientId })
      .andWhere('plan.deleted_at IS NULL')
      .andWhere('dose.deleted_at IS NULL')
      .getMany();

    for (const dose of linkedPlanDoses) {
      if (dose.applicationRecordId) {
        planDoseByRecordId.set(dose.applicationRecordId, dose.id);
      }
    }

    return records.map((record) =>
      this.toApplicationResponse(record, planDoseByRecordId.get(record.id) ?? null),
    );
  }

  async reassignOrRefreshPatientPlan(
    patientId: number,
    mode: PatientVaccinationPlanChangeModeEnum,
    vaccinationSchemeId: number | null,
    notes: string | null,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlanResponseDto> {
    const patientRepo = this.getRepo(Patient, this.patientRepo, manager);
    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Mascota no encontrada.');
    }

    const currentPlan = await this.findActivePlan(patientId, manager);
    if (!currentPlan) {
      throw new NotFoundException('La mascota no tiene un plan vacunal activo.');
    }

    const targetVersion = await this.resolveTargetVersionForPlanChange(
      currentPlan,
      patient.speciesId,
      mode,
      vaccinationSchemeId,
      manager,
    );

    if (targetVersion.id === currentPlan.schemeVersionId) {
      return this.getPatientPlanDetail(patientId, manager, [
        'La mascota ya utiliza la versión vigente seleccionada; no fue necesario reasignar el plan.',
      ]);
    }

    const createdPlan = await this.replacePlanWithVersion(
      patient,
      currentPlan,
      targetVersion,
      notes,
      manager,
    );

    const unreconciledApplications = await this.reconcileApplicationsIntoPlan(
      patientId,
      createdPlan.id,
      manager,
    );

    return this.getPatientPlanDetail(
      patientId,
      manager,
      unreconciledApplications > 0
        ? [
            `Existen ${unreconciledApplications} aplicaciones históricas no conciliadas con el nuevo plan y requieren revisión clínica.`,
          ]
        : [],
    );
  }

  private async reassignPlanForSpeciesChange(
    patientId: number,
    speciesId: number,
    birthDate: Date | null,
    manager?: EntityManager,
  ): Promise<void> {
    const applicationRepo = this.getRepo(
      PatientVaccineRecord,
      this.applicationRepo,
      manager,
    );
    const applicationsCount = await applicationRepo.count({
      where: {
        patientId,
        deletedAt: IsNull(),
      } as never,
    });

    if (applicationsCount > 0) {
      throw new BadRequestException(
        'No se puede cambiar la especie de una mascota que ya tiene aplicaciones vacunales registradas.',
      );
    }

    const planRepo = this.getRepo(PatientVaccinationPlan, this.planRepo, manager);
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);
    const activePlans = await planRepo.find({
      where: {
        patientId,
        deletedAt: IsNull(),
      } as never,
      relations: ['doses'],
    });

    for (const plan of activePlans) {
      const closedAt = new Date();
      await planRepo.update(plan.id, {
        status: PatientVaccinationPlanStatusEnum.REEMPLAZADO,
        isActive: false,
        deletedAt: closedAt,
      });

      for (const dose of plan.doses ?? []) {
        await planDoseRepo.update(dose.id, {
          isActive: false,
          deletedAt: closedAt,
        });
      }
    }

    await this.initializePlanForPatient(patientId, speciesId, birthDate, null, manager);
  }

  private buildPlanDoses(
    planId: number,
    schemeVersion: VaccinationSchemeVersion,
    birthDate: Date | null,
    assignedAt: Date,
  ): PatientVaccinationPlanDose[] {
    this.assertSchemeVersionCanGeneratePlan(schemeVersion);
    const doses = [...(schemeVersion.doses ?? [])].sort((a, b) => a.doseOrder - b.doseOrder);
    const built: PatientVaccinationPlanDose[] = [];
    let previousReferenceDate: Date | null = null;

    for (const schemeDose of doses) {
      const snapshot = this.buildPlanDoseSnapshot(
        planId,
        schemeVersion,
        schemeDose,
        birthDate,
        assignedAt,
        previousReferenceDate,
      );
      built.push(this.planDoseRepo.create(snapshot));
      previousReferenceDate = snapshot.expectedDate ?? previousReferenceDate;
    }

    return built;
  }

  private buildPlanDoseSnapshot(
    planId: number,
    schemeVersion: VaccinationSchemeVersion,
    schemeDose: VaccinationSchemeVersionDose,
    birthDate: Date | null,
    assignedAt: Date,
    previousReferenceDate: Date | null,
  ): Partial<PatientVaccinationPlanDose> {
    const expectedDate = this.calculateExpectedDate(
      birthDate,
      schemeDose,
      schemeVersion.generalIntervalDays,
      previousReferenceDate,
    );

    return {
      planId,
      schemeDoseId: schemeDose.id,
      vaccineId: schemeDose.vaccineId,
      doseOrder: schemeDose.doseOrder,
      expectedDate,
      appliedAt: null,
      applicationRecordId: null,
      notes: null,
      status: this.getInitialDoseStatus(birthDate, schemeDose, expectedDate, assignedAt),
    };
  }

  private calculateExpectedDate(
    birthDate: Date | null,
    schemeDose: VaccinationSchemeVersionDose,
    generalIntervalDays: number | null,
    previousReferenceDate: Date | null,
  ): Date | null {
    if (birthDate && schemeDose.ageStartWeeks !== null && schemeDose.ageStartWeeks !== undefined) {
      return this.addDays(birthDate, schemeDose.ageStartWeeks * 7);
    }

    if (previousReferenceDate && schemeDose.intervalDays !== null && schemeDose.intervalDays !== undefined) {
      return this.addDays(previousReferenceDate, schemeDose.intervalDays);
    }

    if (previousReferenceDate && generalIntervalDays !== null && generalIntervalDays !== undefined) {
      return this.addDays(previousReferenceDate, generalIntervalDays);
    }

    return null;
  }

  private getInitialDoseStatus(
    birthDate: Date | null,
    schemeDose: VaccinationSchemeVersionDose,
    expectedDate: Date | null,
    assignedAt: Date,
  ): PatientVaccinationPlanDoseStatusEnum {
    if (!birthDate) {
      return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
    }

    if (schemeDose.ageEndWeeks !== null && schemeDose.ageEndWeeks !== undefined) {
      const ageWindowEnd = this.addDays(birthDate, schemeDose.ageEndWeeks * 7);
      if (ageWindowEnd < assignedAt) {
        return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
      }
    }

    if (expectedDate && expectedDate < assignedAt) {
      return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
    }

    return PatientVaccinationPlanDoseStatusEnum.NO_APLICADA;
  }

  private getRestoredDoseStatus(
    birthDate: Date | null,
    schemeDose: VaccinationSchemeVersionDose,
    expectedDate: Date | null,
    evaluatedAt: Date,
  ): PatientVaccinationPlanDoseStatusEnum {
    if (!birthDate) {
      return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
    }

    if (schemeDose.ageEndWeeks !== null && schemeDose.ageEndWeeks !== undefined) {
      const ageWindowEnd = this.addDays(birthDate, schemeDose.ageEndWeeks * 7);
      if (ageWindowEnd < evaluatedAt) {
        return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
      }
    }

    if (expectedDate && expectedDate < evaluatedAt) {
      return PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA;
    }

    return PatientVaccinationPlanDoseStatusEnum.NO_APLICADA;
  }

  private async findCurrentSchemeVersionForSpecies(
    speciesId: number,
    manager?: EntityManager,
  ): Promise<VaccinationSchemeVersion> {
    const versionRepo = this.getRepo(
      VaccinationSchemeVersion,
      this.schemeVersionRepo,
      manager,
    );

    const speciesVersion = await versionRepo
      .createQueryBuilder('version')
      .innerJoinAndSelect('version.scheme', 'scheme')
      .innerJoinAndSelect('scheme.species', 'species')
      .leftJoinAndSelect('version.doses', 'doses')
      .leftJoinAndSelect('doses.vaccine', 'vaccine')
      .where('scheme.species_id = :speciesId', { speciesId })
      .andWhere('version.deleted_at IS NULL')
      .andWhere('scheme.deleted_at IS NULL')
      .andWhere('scheme.is_active = true')
      .andWhere('version.is_active = true')
      .andWhere('version.status = :status', {
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      })
      .andWhere('version.valid_from <= CURRENT_DATE')
      .andWhere('(version.valid_to IS NULL OR version.valid_to >= CURRENT_DATE)')
      .orderBy('version.version', 'DESC')
      .addOrderBy('version.valid_from', 'DESC')
      .getOne();

    if (!speciesVersion) {
      throw new NotFoundException(
        'No existe un esquema vacunal vigente para la especie del paciente.',
      );
    }

    speciesVersion.doses = [...(speciesVersion.doses ?? [])].sort(
      (a, b) => a.doseOrder - b.doseOrder,
    );

    return speciesVersion;
  }

  private async findCurrentSchemeVersionForScheme(
    schemeId: number,
    speciesId: number,
    manager?: EntityManager,
  ): Promise<VaccinationSchemeVersion> {
    const versionRepo = this.getRepo(
      VaccinationSchemeVersion,
      this.schemeVersionRepo,
      manager,
    );

    const selectedVersion = await versionRepo
      .createQueryBuilder('version')
      .innerJoinAndSelect('version.scheme', 'scheme')
      .innerJoinAndSelect('scheme.species', 'species')
      .leftJoinAndSelect('version.doses', 'doses')
      .leftJoinAndSelect('doses.vaccine', 'vaccine')
      .where('scheme.id = :schemeId', { schemeId })
      .andWhere('scheme.species_id = :speciesId', { speciesId })
      .andWhere('scheme.deleted_at IS NULL')
      .andWhere('scheme.is_active = true')
      .andWhere('version.deleted_at IS NULL')
      .andWhere('version.is_active = true')
      .andWhere('version.status = :status', {
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      })
      .andWhere('version.valid_from <= CURRENT_DATE')
      .andWhere('(version.valid_to IS NULL OR version.valid_to >= CURRENT_DATE)')
      .orderBy('version.version', 'DESC')
      .addOrderBy('version.valid_from', 'DESC')
      .getOne();

    if (!selectedVersion) {
      throw new BadRequestException(
        'El esquema vacunal seleccionado no está activo, no pertenece a la especie o no tiene una versión vigente utilizable.',
      );
    }

    selectedVersion.doses = [...(selectedVersion.doses ?? [])].sort(
      (a, b) => a.doseOrder - b.doseOrder,
    );

    return selectedVersion;
  }

  private async resolveSchemeVersionForPatient(
    speciesId: number,
    vaccinationSchemeId: number | null,
    manager?: EntityManager,
  ): Promise<VaccinationSchemeVersion> {
    if (!vaccinationSchemeId) {
      return this.findCurrentSchemeVersionForSpecies(speciesId, manager);
    }

    return this.findCurrentSchemeVersionForScheme(vaccinationSchemeId, speciesId, manager);
  }

  private async resolveTargetVersionForPlanChange(
    currentPlan: PatientVaccinationPlan,
    speciesId: number,
    mode: PatientVaccinationPlanChangeModeEnum,
    vaccinationSchemeId: number | null,
    manager?: EntityManager,
  ): Promise<VaccinationSchemeVersion> {
    if (mode === PatientVaccinationPlanChangeModeEnum.REFRESH_CURRENT) {
      const version = await this.findCurrentSchemeVersionForScheme(
        currentPlan.schemeVersion.schemeId,
        speciesId,
        manager,
      );
      this.assertSchemeVersionCanGeneratePlan(version);
      return version;
    }

    if (!vaccinationSchemeId) {
      throw new BadRequestException(
        'vaccinationSchemeId es obligatorio cuando mode es CHANGE_SCHEME.',
      );
    }

    const version = await this.findCurrentSchemeVersionForScheme(
      vaccinationSchemeId,
      speciesId,
      manager,
    );
    this.assertSchemeVersionCanGeneratePlan(version);
    return version;
  }

  private async findPatientOrFail(
    patientId: number,
    manager?: EntityManager,
  ): Promise<Patient> {
    const patientRepo = this.getRepo(Patient, this.patientRepo, manager);
    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    return patient;
  }

  private async findActivePlan(
    patientId: number,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan | null> {
    const planRepo = this.getRepo(PatientVaccinationPlan, this.planRepo, manager);
    const plan = await planRepo.findOne({
      where: {
        patientId,
        deletedAt: IsNull(),
        status: PatientVaccinationPlanStatusEnum.ACTIVO,
      } as never,
      relations: [
        'schemeVersion',
        'schemeVersion.scheme',
        'schemeVersion.scheme.species',
        'schemeVersion.doses',
        'schemeVersion.doses.vaccine',
        'doses',
        'doses.schemeDose',
        'doses.vaccine',
        'doses.applicationRecord',
      ],
      order: {
        doses: {
          doseOrder: 'ASC',
        },
      },
    });

    if (plan?.doses) {
      plan.doses = plan.doses.filter((dose) => !dose.deletedAt);
    }

    return plan;
  }

  private async replacePlanWithVersion(
    patient: Patient,
    currentPlan: PatientVaccinationPlan,
    targetVersion: VaccinationSchemeVersion,
    notes: string | null,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan> {
    const planRepo = this.getRepo(PatientVaccinationPlan, this.planRepo, manager);
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);

    const replacedAt = new Date();
    await planRepo.update(currentPlan.id, {
      status: PatientVaccinationPlanStatusEnum.REEMPLAZADO,
      isActive: false,
      deletedAt: replacedAt,
    });

    for (const dose of currentPlan.doses ?? []) {
      await planDoseRepo.update(dose.id, {
        isActive: false,
        deletedAt: replacedAt,
      });
    }

    const assignedAt = new Date();
    const newPlan = await planRepo.save(
      planRepo.create({
        patientId: patient.id,
        schemeVersionId: targetVersion.id,
        status: PatientVaccinationPlanStatusEnum.ACTIVO,
        assignedAt,
        notes: notes ?? null,
      }),
    );

    const doses = this.buildPlanDoses(
      newPlan.id,
      targetVersion,
      patient.birthDate ?? null,
      assignedAt,
    );

    if (doses.length > 0) {
      await planDoseRepo.save(doses);
    }

    return (await this.findActivePlan(patient.id, manager))!;
  }

  private async reconcileApplicationsIntoPlan(
    patientId: number,
    planId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const applicationRepo = this.getRepo(PatientVaccineRecord, this.applicationRepo, manager);
    const planDoseRepo = this.getRepo(PatientVaccinationPlanDose, this.planDoseRepo, manager);

    const applications = await applicationRepo.find({
      where: {
        patientId,
        deletedAt: IsNull(),
      } as never,
      order: {
        applicationDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    const planDoses = await planDoseRepo.find({
      where: {
        planId,
        deletedAt: IsNull(),
      } as never,
      relations: ['schemeDose'],
      order: {
        doseOrder: 'ASC',
      },
    });

    let unreconciledCount = 0;

    for (const application of applications) {
      const targetDose = planDoses.find(
        (dose) =>
          dose.vaccineId === application.vaccineId &&
          dose.status !== PatientVaccinationPlanDoseStatusEnum.APLICADA,
      );

      if (!targetDose) {
        unreconciledCount += 1;
        continue;
      }

      targetDose.status = PatientVaccinationPlanDoseStatusEnum.APLICADA;
      targetDose.appliedAt = application.applicationDate;
      targetDose.applicationRecordId = application.id;
      await planDoseRepo.save(targetDose);
    }

    return unreconciledCount;
  }

  private calculateCoverage(
    doses: PatientVaccinationPlanDoseResponseDto[],
  ): PatientVaccinationPlanCoverageDto {
    const required = doses.filter((dose) => dose.isRequired);
    const totalRequired = required.length;
    const applied = required.filter(
      (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.APLICADA,
    ).length;
    const unknown = required.filter(
      (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA,
    ).length;
    const notApplied = required.filter(
      (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.NO_APLICADA,
    ).length;
    const blocked = required.filter(
      (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.BLOQUEADA,
    ).length;
    const requiresReview = required.filter(
      (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.REQUIERE_REVISION,
    ).length;

    return {
      totalRequired,
      applied,
      unknown,
      notApplied,
      blocked,
      requiresReview,
      coveragePercent: totalRequired === 0 ? 100 : Math.round((applied / totalRequired) * 100),
    };
  }

  private buildAlerts(doses: PatientVaccinationPlanDoseResponseDto[]): string[] {
    const alerts: string[] = [];

    if (
      doses.some((dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.DESCONOCIDA)
    ) {
      alerts.push(
        'Existen dosis con estado DESCONOCIDA que requieren validación clínica o documental.',
      );
    }

    if (
      doses.some((dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.BLOQUEADA)
    ) {
      alerts.push(
        'Existen dosis bloqueadas por cambios en el catálogo o en el protocolo vacunal.',
      );
    }

    if (
      doses.some(
        (dose) => dose.status === PatientVaccinationPlanDoseStatusEnum.REQUIERE_REVISION,
      )
    ) {
      alerts.push(
        'Existen dosis que requieren revisión manual antes de continuar con el esquema.',
      );
    }

    return alerts;
  }

  private toPlanDoseResponse(
    dose: PatientVaccinationPlanDose,
  ): PatientVaccinationPlanDoseResponseDto {
    return {
      id: dose.id,
      schemeDoseId: dose.schemeDoseId,
      vaccineId: dose.vaccineId,
      vaccineName: dose.vaccine?.name ?? dose.schemeDose?.vaccine?.name ?? '',
      doseOrder: dose.doseOrder,
      status: dose.status,
      expectedDate: this.toDateString(dose.expectedDate),
      appliedAt: this.toDateString(dose.appliedAt),
      applicationRecordId: dose.applicationRecordId ?? null,
      ageStartWeeks: dose.schemeDose?.ageStartWeeks ?? null,
      ageEndWeeks: dose.schemeDose?.ageEndWeeks ?? null,
      intervalDays: dose.schemeDose?.intervalDays ?? null,
      isRequired: dose.schemeDose?.isRequired ?? true,
      notes: dose.notes ?? null,
    };
  }

  private toSchemeVersionResponse(
    version: VaccinationSchemeVersion,
  ): VaccinationSchemeVersionResponseDto {
    return {
      id: version.id,
      version: version.version,
      status: version.status,
      validFrom: this.toDateString(version.validFrom)!,
      validTo: this.toDateString(version.validTo),
      changeReason: version.changeReason ?? null,
      revaccinationRule: version.revaccinationRule ?? null,
      generalIntervalDays: version.generalIntervalDays ?? null,
      doses: [...(version.doses ?? [])]
        .filter((dose) => !dose.deletedAt)
        .sort((a, b) => a.doseOrder - b.doseOrder)
        .map((dose) => ({
          id: dose.id,
          doseOrder: dose.doseOrder,
          vaccineId: dose.vaccineId,
          vaccineName: dose.vaccine?.name ?? '',
          ageStartWeeks: dose.ageStartWeeks ?? null,
          ageEndWeeks: dose.ageEndWeeks ?? null,
          intervalDays: dose.intervalDays ?? null,
          isRequired: dose.isRequired,
          notes: dose.notes ?? null,
        })),
    };
  }

  private toApplicationResponse(
    record: PatientVaccineRecord,
    planDoseId: number | null,
  ): PatientVaccineRecordResponseDto {
    return {
      id: record.id,
      vaccineId: record.vaccineId,
      vaccineName: record.vaccine?.name ?? '',
      species: record.vaccine?.species
        ? {
            id: record.vaccine.species.id,
            name: record.vaccine.species.name,
          }
        : null,
      applicationDate: this.toDateString(record.applicationDate)!,
      administeredByEmployeeId: record.administeredByEmployeeId ?? null,
      administeredBy: record.administeredByEmployee?.person
        ? `${record.administeredByEmployee.person.firstName} ${record.administeredByEmployee.person.lastName}`.trim()
        : (record.administeredBy ?? null),
      administeredAt: record.administeredAt ?? null,
      isExternal: record.isExternal,
      batchNumber: record.batchNumber ?? null,
      nextDoseDate: this.toDateString(record.nextDoseDate),
      notes: record.notes ?? null,
      encounterId: record.encounterId ?? null,
      planDoseId,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toDateString(value: Date | string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    return String(value).split('T')[0];
  }

  private appendNote(current: string | null, next: string): string {
    return current ? `${current}\n${next}` : next;
  }

  private isSchemeVersionPlanCompatible(
    schemeVersion: VaccinationSchemeVersion,
  ): boolean {
    return !(schemeVersion.doses ?? []).some((dose) => !dose.vaccineId);
  }

  private assertSchemeVersionCanGeneratePlan(
    schemeVersion: VaccinationSchemeVersion,
  ): void {
    const invalidDose = [...(schemeVersion.doses ?? [])]
      .sort((a, b) => a.doseOrder - b.doseOrder)
      .find((dose) => !dose.vaccineId);

    if (invalidDose) {
      throw new BadRequestException(
        `La versión vigente del esquema tiene dosis incompletas sin producto biológico asociado. Revisa la dosis ${invalidDose.doseOrder}.`,
      );
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
