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
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan> {
    const existingPlan = await this.findActivePlan(patientId, manager);
    if (existingPlan) {
      return existingPlan;
    }

    const schemeVersion = await this.findCurrentSchemeVersionForSpecies(speciesId, manager);
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

  async ensurePlanForPatient(
    patientId: number,
    manager?: EntityManager,
  ): Promise<PatientVaccinationPlan> {
    const patientRepo = this.getRepo(Patient, this.patientRepo, manager);
    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    const existingPlan = await this.findActivePlan(patientId, manager);
    if (existingPlan) {
      return existingPlan;
    }

    return this.initializePlanForPatient(
      patient.id,
      patient.speciesId,
      patient.birthDate ?? null,
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
      await this.initializePlanForPatient(patientId, speciesId, birthDate, manager);
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
      }

      previousReferenceDate =
        planDose.appliedAt ?? planDose.expectedDate ?? previousReferenceDate;
      await planDoseRepo.save(planDose);
    }
  }

  async registerApplication(
    patientId: number,
    vaccineId: number,
    applicationDate: Date,
    applicationRecordId: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    await this.ensurePlanForPatient(patientId, manager);

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

      dose.status = PatientVaccinationPlanDoseStatusEnum.BLOQUEADA;
      dose.notes = this.appendNote(dose.notes, 'Producto biológico desactivado del catálogo.');
      await planDoseRepo.save(dose);
    }
  }

  async getPatientPlanDetail(patientId: number): Promise<PatientVaccinationPlanResponseDto> {
    const plan = await this.ensurePlanForPatient(patientId);
    const applications = await this.findApplicationsForPatient(patientId);
    const doses = plan.doses
      .filter((dose) => !dose.deletedAt)
      .sort((a, b) => a.doseOrder - b.doseOrder)
      .map((dose) => this.toPlanDoseResponse(dose));

    const coverage = this.calculateCoverage(doses);
    const alerts = this.buildAlerts(doses);

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
  ): Promise<PatientVaccineRecordResponseDto[]> {
    const records = await this.applicationRepo.find({
      where: {
        patientId,
        deletedAt: IsNull(),
      } as never,
      relations: ['vaccine', 'vaccine.species'],
      order: { applicationDate: 'DESC', createdAt: 'DESC' },
    });

    const planDoseByRecordId = new Map<number, number>();
    const linkedPlanDoses = await this.planDoseRepo
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
      plan.status = PatientVaccinationPlanStatusEnum.REEMPLAZADO;
      plan.isActive = false;
      plan.deletedAt = new Date();
      await planRepo.save(plan);

      for (const dose of plan.doses ?? []) {
        dose.isActive = false;
        dose.deletedAt = new Date();
        await planDoseRepo.save(dose);
      }
    }

    await this.initializePlanForPatient(patientId, speciesId, birthDate, manager);
  }

  private buildPlanDoses(
    planId: number,
    schemeVersion: VaccinationSchemeVersion,
    birthDate: Date | null,
    assignedAt: Date,
  ): PatientVaccinationPlanDose[] {
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
      .andWhere('version.status = :status', {
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      })
      .andWhere('version.valid_from <= CURRENT_DATE')
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
      administeredBy: record.administeredBy ?? null,
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

  private toDateString(value: Date | null | undefined): string | null {
    if (!value) {
      return null;
    }
    return value.toISOString().split('T')[0];
  }

  private appendNote(current: string | null, next: string): string {
    return current ? `${current}\n${next}` : next;
  }

  private getRepo<T extends ObjectLiteral>(
    entity: new () => T,
    repo: Repository<T>,
    manager?: EntityManager,
  ): Repository<T> {
    return manager ? manager.getRepository<T>(entity) : repo;
  }
}
