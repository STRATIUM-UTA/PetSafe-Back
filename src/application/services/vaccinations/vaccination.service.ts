import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { VaccinationScheme } from '../../../domain/entities/vaccinations/vaccination-scheme.entity.js';
import { VaccinationSchemeVersion } from '../../../domain/entities/vaccinations/vaccination-scheme-version.entity.js';
import { VaccinationSchemeVersionDose } from '../../../domain/entities/vaccinations/vaccination-scheme-version-dose.entity.js';
import {
  PatientVaccinationPlanDoseStatusEnum,
  VaccinationSchemeVersionStatusEnum,
} from '../../../domain/enums/index.js';
import { CreateVaccineDto } from '../../../presentation/dto/vaccinations/create-vaccine.dto.js';
import { UpdateVaccineDto } from '../../../presentation/dto/vaccinations/update-vaccine.dto.js';
import { CreatePatientVaccineRecordDto } from '../../../presentation/dto/vaccinations/create-patient-vaccine-record.dto.js';
import { CreateVaccinationSchemeDto } from '../../../presentation/dto/vaccinations/create-vaccination-scheme.dto.js';
import { CreateVaccinationSchemeVersionDto } from '../../../presentation/dto/vaccinations/create-vaccination-scheme-version.dto.js';
import { UpdateVaccinationSchemeVersionStatusDto } from '../../../presentation/dto/vaccinations/update-vaccination-scheme-version-status.dto.js';
import { UpdatePatientVaccinationPlanDoseDto } from '../../../presentation/dto/vaccinations/update-patient-vaccination-plan-dose.dto.js';
import {
  PatientVaccinationPlanResponseDto,
  PatientVaccineRecordResponseDto,
  VaccineCatalogItemDto,
  VaccinationSchemeResponseDto,
  VaccinationSchemeVersionResponseDto,
} from '../../../presentation/dto/vaccinations/vaccination-response.dto.js';
import { VaccinationPlanService } from './vaccination-plan.service.js';

@Injectable()
export class VaccinationService {
  constructor(
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(PatientVaccineRecord)
    private readonly recordRepo: Repository<PatientVaccineRecord>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Species)
    private readonly speciesRepo: Repository<Species>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(VaccinationScheme)
    private readonly schemeRepo: Repository<VaccinationScheme>,
    @InjectRepository(VaccinationSchemeVersion)
    private readonly schemeVersionRepo: Repository<VaccinationSchemeVersion>,
    @InjectRepository(VaccinationSchemeVersionDose)
    private readonly schemeDoseRepo: Repository<VaccinationSchemeVersionDose>,
    private readonly dataSource: DataSource,
    private readonly vaccinationPlanService: VaccinationPlanService,
  ) {}

  async getProducts(speciesId?: number): Promise<VaccineCatalogItemDto[]> {
    const where: Record<string, unknown> = {
      deletedAt: IsNull(),
    };
    if (speciesId) {
      await this.ensureSpeciesExists(speciesId);
      where['speciesId'] = speciesId;
    }

    const vaccines = await this.vaccineRepo.find({
      where: where as never,
      relations: ['species'],
      order: { name: 'ASC' },
    });

    return vaccines.map((vaccine) => this.toProductResponse(vaccine));
  }

  async getProduct(productId: number): Promise<VaccineCatalogItemDto> {
    const vaccine = await this.findVaccineOrFail(productId);
    return this.toProductResponse(vaccine);
  }

  async createProduct(dto: CreateVaccineDto): Promise<VaccineCatalogItemDto> {
    await this.ensureSpeciesExists(dto.speciesId);

    const duplicate = await this.vaccineRepo.findOne({
      where: {
        name: dto.name.trim(),
        speciesId: dto.speciesId,
        deletedAt: IsNull(),
      } as never,
    });

    if (duplicate) {
      throw new ConflictException(
        `Ya existe un producto biológico con el nombre "${dto.name}" para esta especie.`,
      );
    }

    const vaccine = await this.vaccineRepo.save(
      this.vaccineRepo.create({
        name: dto.name.trim(),
        speciesId: dto.speciesId,
        isRevaccination: dto.isRevaccination ?? false,
        isMandatory: false,
        doseOrder: null,
      }),
    );

    return this.getProduct(vaccine.id);
  }

  async updateProduct(
    productId: number,
    dto: UpdateVaccineDto,
  ): Promise<VaccineCatalogItemDto> {
    const vaccine = await this.findVaccineOrFail(productId);

    if (dto.name && dto.name.trim() !== vaccine.name) {
      const duplicate = await this.vaccineRepo.findOne({
        where: {
          name: dto.name.trim(),
          speciesId: vaccine.speciesId,
          deletedAt: IsNull(),
        } as never,
      });

      if (duplicate && duplicate.id !== productId) {
        throw new ConflictException(
          `Ya existe otro producto biológico con el nombre "${dto.name}" para esta especie.`,
        );
      }
    }

    if (dto.name !== undefined) {
      vaccine.name = dto.name.trim();
    }
    if (dto.isRevaccination !== undefined) {
      vaccine.isRevaccination = dto.isRevaccination;
    }

    await this.vaccineRepo.save(vaccine);
    return this.getProduct(productId);
  }

  async deactivateProduct(
    productId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const vaccine = await this.findVaccineOrFail(productId);

    await this.dataSource.transaction(async (manager) => {
      vaccine.isActive = false;
      vaccine.deletedAt = new Date();
      vaccine.deletedByUserId = userId;
      await manager.getRepository(Vaccine).save(vaccine);
      await this.vaccinationPlanService.blockPendingDosesForInactiveProduct(
        productId,
        manager,
      );
    });

    return { message: `Producto biológico "${vaccine.name}" desactivado correctamente.` };
  }

  async getSchemes(speciesId?: number): Promise<VaccinationSchemeResponseDto[]> {
    const qb = this.schemeRepo
      .createQueryBuilder('scheme')
      .innerJoinAndSelect('scheme.species', 'species')
      .leftJoinAndSelect('scheme.versions', 'version', 'version.deleted_at IS NULL')
      .leftJoinAndSelect('version.doses', 'dose', 'dose.deleted_at IS NULL')
      .leftJoinAndSelect('dose.vaccine', 'vaccine')
      .where('scheme.deleted_at IS NULL')
      .orderBy('scheme.name', 'ASC')
      .addOrderBy('version.version', 'DESC')
      .addOrderBy('dose.dose_order', 'ASC');

    if (speciesId) {
      await this.ensureSpeciesExists(speciesId);
      qb.andWhere('scheme.species_id = :speciesId', { speciesId });
    }

    const schemes = await qb.getMany();
    return schemes.map((scheme) => this.toSchemeResponse(scheme));
  }

  async getScheme(schemeId: number): Promise<VaccinationSchemeResponseDto> {
    const scheme = await this.schemeRepo.findOne({
      where: {
        id: schemeId,
        deletedAt: IsNull(),
      } as never,
      relations: ['species', 'versions', 'versions.doses', 'versions.doses.vaccine'],
      order: {
        versions: { version: 'DESC' },
      },
    });

    if (!scheme) {
      throw new NotFoundException('Esquema vacunal no encontrado.');
    }

    return this.toSchemeResponse(scheme);
  }

  async createScheme(dto: CreateVaccinationSchemeDto): Promise<VaccinationSchemeResponseDto> {
    await this.ensureSpeciesExists(dto.speciesId);

    const duplicate = await this.schemeRepo.findOne({
      where: {
        name: dto.name.trim(),
        speciesId: dto.speciesId,
        deletedAt: IsNull(),
      } as never,
    });

    if (duplicate) {
      throw new ConflictException(
        `Ya existe un esquema con el nombre "${dto.name}" para esta especie.`,
      );
    }

    const scheme = await this.dataSource.transaction(async (manager) => {
      const savedScheme = await manager.getRepository(VaccinationScheme).save(
        manager.getRepository(VaccinationScheme).create({
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          speciesId: dto.speciesId,
        }),
      );

      await this.createSchemeVersionInternal(
        savedScheme.id,
        dto.speciesId,
        dto.initialVersion,
        manager,
      );

      return savedScheme;
    });

    return this.getScheme(scheme.id);
  }

  async createSchemeVersion(
    schemeId: number,
    dto: CreateVaccinationSchemeVersionDto,
  ): Promise<VaccinationSchemeVersionResponseDto> {
    const scheme = await this.schemeRepo.findOne({
      where: {
        id: schemeId,
        deletedAt: IsNull(),
      } as never,
    });

    if (!scheme) {
      throw new NotFoundException('Esquema vacunal no encontrado.');
    }

    const version = await this.dataSource.transaction((manager) =>
      this.createSchemeVersionInternal(scheme.id, scheme.speciesId, dto, manager),
    );

    return this.getSchemeVersion(version.id);
  }

  async getSchemeVersion(versionId: number): Promise<VaccinationSchemeVersionResponseDto> {
    const version = await this.schemeVersionRepo.findOne({
      where: {
        id: versionId,
        deletedAt: IsNull(),
      } as never,
      relations: ['scheme', 'scheme.species', 'doses', 'doses.vaccine'],
    });

    if (!version) {
      throw new NotFoundException('Versión de esquema vacunal no encontrada.');
    }

    return this.toSchemeVersionResponse(version);
  }

  async updateSchemeVersionStatus(
    versionId: number,
    dto: UpdateVaccinationSchemeVersionStatusDto,
  ): Promise<VaccinationSchemeVersionResponseDto> {
    const version = await this.schemeVersionRepo.findOne({
      where: {
        id: versionId,
        deletedAt: IsNull(),
      } as never,
      relations: ['scheme'],
    });

    if (!version) {
      throw new NotFoundException('Versión de esquema vacunal no encontrada.');
    }

    version.status = dto.status;
    if (dto.validTo !== undefined) {
      version.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }
    if (dto.changeReason !== undefined) {
      version.changeReason = dto.changeReason ?? null;
    }

    await this.schemeVersionRepo.save(version);
    return this.getSchemeVersion(versionId);
  }

  async getPatientPlan(patientId: number): Promise<PatientVaccinationPlanResponseDto> {
    await this.ensurePatientExists(patientId);
    return this.vaccinationPlanService.getPatientPlanDetail(patientId);
  }

  async getPatientApplications(
    patientId: number,
  ): Promise<PatientVaccineRecordResponseDto[]> {
    await this.ensurePatientExists(patientId);
    return this.vaccinationPlanService.findApplicationsForPatient(patientId);
  }

  async addPatientApplication(
    patientId: number,
    dto: CreatePatientVaccineRecordDto,
    userId: number,
  ): Promise<PatientVaccineRecordResponseDto> {
    const patient = await this.findPatientOrFail(patientId);
    const vaccine = await this.findVaccineOrFail(dto.vaccineId);

    if (!vaccine.isActive) {
      throw new BadRequestException(
        'El producto biológico está desactivado y no puede utilizarse en nuevas aplicaciones.',
      );
    }

    this.ensureVaccineMatchesPatientSpecies(vaccine, patient);

    if (dto.encounterId) {
      const encounter = await this.encounterRepo.findOne({
        where: { id: dto.encounterId, patientId },
      });

      if (!encounter || encounter.deletedAt) {
        throw new BadRequestException(
          'El encounter referenciado no existe o no corresponde a este paciente.',
        );
      }
    }

    const applicationDate = new Date(dto.applicationDate);
    const nextDoseDate = dto.nextDoseDate ? new Date(dto.nextDoseDate) : null;

    const saved = await this.dataSource.transaction(async (manager) => {
      const record = await manager.getRepository(PatientVaccineRecord).save(
        manager.getRepository(PatientVaccineRecord).create({
          patientId,
          vaccineId: dto.vaccineId,
          applicationDate,
          administeredBy: dto.administeredBy?.trim() ?? null,
          administeredAt: dto.administeredAt?.trim() ?? null,
          isExternal: dto.encounterId ? false : (dto.isExternal ?? true),
          batchNumber: dto.batchNumber?.trim() ?? null,
          nextDoseDate,
          notes: dto.notes?.trim() ?? null,
          encounterId: dto.encounterId ?? null,
          createdByUserId: userId,
        }),
      );

      const planDoseId = await this.vaccinationPlanService.registerApplication(
        patientId,
        dto.vaccineId,
        applicationDate,
        record.id,
        manager,
      );

      return {
        recordId: record.id,
        planDoseId,
      };
    });

    const applications = await this.vaccinationPlanService.findApplicationsForPatient(patientId);
    const response = applications.find((item) => item.id === saved.recordId);
    if (!response) {
      throw new NotFoundException('No se pudo recuperar la aplicación vacunal guardada.');
    }

    response.planDoseId = saved.planDoseId;
    return response;
  }

  async updatePatientPlanDoseStatus(
    patientId: number,
    planDoseId: number,
    dto: UpdatePatientVaccinationPlanDoseDto,
  ): Promise<PatientVaccinationPlanResponseDto> {
    if (dto.status === PatientVaccinationPlanDoseStatusEnum.APLICADA) {
      throw new BadRequestException(
        'La dosis no puede marcarse como APLICADA manualmente; debe registrarse una aplicación real.',
      );
    }

    return this.vaccinationPlanService.updatePlanDoseStatus(patientId, planDoseId, dto);
  }

  private async createSchemeVersionInternal(
    schemeId: number,
    speciesId: number,
    dto: CreateVaccinationSchemeVersionDto,
    manager: EntityManager,
  ): Promise<VaccinationSchemeVersion> {
    const existingVersion = await manager.getRepository(VaccinationSchemeVersion).findOne({
      where: {
        schemeId,
        version: dto.version,
        deletedAt: IsNull(),
      } as never,
    });

    if (existingVersion) {
      throw new ConflictException(
        `La versión ${dto.version} ya existe para este esquema vacunal.`,
      );
    }

    for (const dose of dto.doses) {
      const vaccine = await manager.getRepository(Vaccine).findOne({
        where: {
          id: dose.vaccineId,
          deletedAt: IsNull(),
        } as never,
      });

      if (!vaccine) {
        throw new NotFoundException(
          `Producto biológico con id ${dose.vaccineId} no encontrado.`,
        );
      }

      if (vaccine.speciesId !== speciesId) {
        throw new BadRequestException(
          `El producto "${vaccine.name}" no corresponde a la especie del esquema.`,
        );
      }
    }

    if ((dto.status ?? VaccinationSchemeVersionStatusEnum.VIGENTE) === VaccinationSchemeVersionStatusEnum.VIGENTE) {
      const activeVersions = await manager.getRepository(VaccinationSchemeVersion).find({
        where: {
          schemeId,
          deletedAt: IsNull(),
          status: VaccinationSchemeVersionStatusEnum.VIGENTE,
        } as never,
      });

      for (const activeVersion of activeVersions) {
        activeVersion.status = VaccinationSchemeVersionStatusEnum.REEMPLAZADO;
        activeVersion.validTo = new Date(dto.validFrom);
        await manager.getRepository(VaccinationSchemeVersion).save(activeVersion);
      }
    }

    const savedVersion = await manager.getRepository(VaccinationSchemeVersion).save(
      manager.getRepository(VaccinationSchemeVersion).create({
        schemeId,
        version: dto.version,
        status: dto.status ?? VaccinationSchemeVersionStatusEnum.VIGENTE,
        validFrom: new Date(dto.validFrom),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        changeReason: dto.changeReason?.trim() ?? null,
        revaccinationRule: dto.revaccinationRule?.trim() ?? null,
        generalIntervalDays: dto.generalIntervalDays ?? null,
      }),
    );

    const usedOrders = new Set<number>();
    for (const dose of dto.doses) {
      if (usedOrders.has(dose.doseOrder)) {
        throw new ConflictException('No se permiten órdenes de dosis duplicados en una versión.');
      }
      usedOrders.add(dose.doseOrder);

      await manager.getRepository(VaccinationSchemeVersionDose).save(
        manager.getRepository(VaccinationSchemeVersionDose).create({
          schemeVersionId: savedVersion.id,
          vaccineId: dose.vaccineId,
          doseOrder: dose.doseOrder,
          ageStartWeeks: dose.ageStartWeeks ?? null,
          ageEndWeeks: dose.ageEndWeeks ?? null,
          intervalDays: dose.intervalDays ?? null,
          isRequired: dose.isRequired ?? true,
          notes: dose.notes?.trim() ?? null,
        }),
      );
    }

    return savedVersion;
  }

  private async ensurePatientExists(patientId: number): Promise<void> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }
  }

  private async findPatientOrFail(patientId: number): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
      relations: ['species'],
    });

    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    return patient;
  }

  private async ensureSpeciesExists(speciesId: number): Promise<void> {
    const species = await this.speciesRepo.findOne({ where: { id: speciesId } });
    if (!species || species.deletedAt) {
      throw new NotFoundException('Especie no encontrada.');
    }
  }

  private async findVaccineOrFail(vaccineId: number): Promise<Vaccine> {
    const vaccine = await this.vaccineRepo.findOne({
      where: {
        id: vaccineId,
        deletedAt: IsNull(),
      } as never,
      relations: ['species'],
    });

    if (!vaccine) {
      throw new NotFoundException('Producto biológico no encontrado.');
    }

    return vaccine;
  }

  private ensureVaccineMatchesPatientSpecies(vaccine: Vaccine, patient: Patient): void {
    if (vaccine.speciesId !== patient.speciesId) {
      throw new BadRequestException(
        `El producto "${vaccine.name}" no corresponde a la especie del paciente.`,
      );
    }
  }

  private toProductResponse(vaccine: Vaccine): VaccineCatalogItemDto {
    return {
      id: vaccine.id,
      name: vaccine.name,
      species: {
        id: vaccine.species.id,
        name: vaccine.species.name,
      },
      isRevaccination: vaccine.isRevaccination,
      isActive: vaccine.isActive,
    };
  }

  private toSchemeResponse(scheme: VaccinationScheme): VaccinationSchemeResponseDto {
    const versions = [...(scheme.versions ?? [])]
      .filter((version) => !version.deletedAt)
      .sort((a, b) => b.version - a.version);
    const activeVersion = versions.find(
      (version) => version.status === VaccinationSchemeVersionStatusEnum.VIGENTE,
    );

    return {
      id: scheme.id,
      name: scheme.name,
      description: scheme.description ?? null,
      species: {
        id: scheme.species.id,
        name: scheme.species.name,
      },
      activeVersionId: activeVersion?.id ?? null,
      versions: versions.map((version) => this.toSchemeVersionResponse(version)),
    };
  }

  private toSchemeVersionResponse(
    version: VaccinationSchemeVersion,
  ): VaccinationSchemeVersionResponseDto {
    return {
      id: version.id,
      version: version.version,
      status: version.status,
      validFrom: version.validFrom.toISOString().split('T')[0],
      validTo: version.validTo ? version.validTo.toISOString().split('T')[0] : null,
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
}
