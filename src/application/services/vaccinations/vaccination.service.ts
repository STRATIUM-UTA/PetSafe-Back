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
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
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
import { ListVaccinationsQueryDto } from '../../../presentation/dto/vaccinations/list-vaccinations-query.dto.js';
import { PaginatedVaccinationsBasicResponse } from '../../../presentation/dto/vaccinations/vaccination-basic-response.dto.js';

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
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(VaccinationScheme)
    private readonly schemeRepo: Repository<VaccinationScheme>,
    @InjectRepository(VaccinationSchemeVersion)
    private readonly schemeVersionRepo: Repository<VaccinationSchemeVersion>,
    @InjectRepository(VaccinationSchemeVersionDose)
    private readonly schemeDoseRepo: Repository<VaccinationSchemeVersionDose>,
    private readonly dataSource: DataSource,
    private readonly vaccinationPlanService: VaccinationPlanService,
  ) { }

  async findAllBasic(query: ListVaccinationsQueryDto): Promise<PaginatedVaccinationsBasicResponse> {
    console.log("ListVaccinationsQueryDto", query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.recordRepo
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.vaccine', 'vaccine')
      .innerJoinAndSelect('record.patient', 'patient')
      .where('record.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('LOWER(patient.name) LIKE LOWER(:search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.isExternal === 'true') {
      qb.andWhere('record.isExternal IS TRUE');
    } else if (query.isExternal === 'false') {
      qb.andWhere('record.isExternal IS NOT TRUE');
    }


    qb.orderBy('record.applicationDate', 'DESC').addOrderBy('record.id', 'DESC');

    const [records, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: records.map((r) => ({
        id: r.id,
        vaccineName: r.vaccine.name,
        applicationDate: this.toDateStringFindAllBasic(r.applicationDate),
        nextDoseDate: r.nextDoseDate ? this.toDateStringFindAllBasic(r.nextDoseDate) : null,
        isExternal: r.isExternal,
        notes: r.notes,
        patientId: r.patientId,
        patientName: r.patient.name,
        encounterId: r.encounterId ?? null,
      })),
      meta: {
        totalItems: total,
        itemCount: records.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  private toDateStringFindAllBasic(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return String(value).substring(0, 10);
  }

  async getProducts(
    speciesId?: number,
    onlyActive = true,
    search?: string,
  ): Promise<VaccineCatalogItemDto[]> {
    if (speciesId) {
      await this.ensureSpeciesExists(speciesId);
    }

    const qb = this.vaccineRepo
      .createQueryBuilder('vaccine')
      .innerJoinAndSelect('vaccine.species', 'species')
      .where('vaccine.deleted_at IS NULL')
      .orderBy('vaccine.name', 'ASC');

    if (speciesId) {
      qb.andWhere('vaccine.species_id = :speciesId', { speciesId });
    }

    if (onlyActive) {
      qb.andWhere('vaccine.is_active = true');
    }

    if (search?.trim()) {
      qb.andWhere('vaccine.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    const vaccines = await qb.getMany();

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

  async deactivateProduct(productId: number): Promise<{ message: string }> {
    const vaccine = await this.findVaccineOrFail(productId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Vaccine).update(productId, {
        isActive: false,
      });
      await this.vaccinationPlanService.blockPendingDosesForInactiveProduct(
        productId,
        manager,
      );
    });

    return { message: `Producto biológico "${vaccine.name}" desactivado correctamente.` };
  }

  async reactivateProduct(productId: number): Promise<{ message: string }> {
    const vaccine = await this.findVaccineOrFail(productId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Vaccine).update(productId, {
        isActive: true,
      });
      await this.vaccinationPlanService.unblockPendingDosesForReactivatedProduct(
        productId,
        manager,
      );
    });

    return { message: `Producto biológico "${vaccine.name}" reactivado correctamente.` };
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
    await this.dataSource.transaction(async (manager) => {
      const versionRepo = manager.getRepository(VaccinationSchemeVersion);
      const version = await versionRepo.findOne({
        where: {
          id: versionId,
          deletedAt: IsNull(),
        } as never,
        relations: ['scheme'],
      });

      if (!version) {
        throw new NotFoundException('Versión de esquema vacunal no encontrada.');
      }

      if (
        version.status === VaccinationSchemeVersionStatusEnum.SUSPENDIDO &&
        dto.status !== VaccinationSchemeVersionStatusEnum.SUSPENDIDO
      ) {
        throw new BadRequestException(
          'Una versión suspendida no puede reactivarse ni cambiar a otro estado.',
        );
      }

      const currentValidFrom = this.asDateOnly(version.validFrom)!;
      const requestedValidFrom =
        dto.validFrom !== undefined
          ? this.parseDateOnly(dto.validFrom)
          : dto.status === VaccinationSchemeVersionStatusEnum.VIGENTE
            ? version.status === VaccinationSchemeVersionStatusEnum.VIGENTE
              ? currentValidFrom
              : this.todayDateOnly()
            : currentValidFrom;
      const requestedValidTo =
        dto.validTo !== undefined
          ? dto.validTo
            ? this.parseDateOnly(dto.validTo)
            : null
          : undefined;

      if (dto.status === VaccinationSchemeVersionStatusEnum.VIGENTE) {
        if (requestedValidFrom > this.todayDateOnly()) {
          throw new BadRequestException(
            'Una versión VIGENTE no puede iniciar en una fecha futura. Si aún no debe entrar en vigor, no la actives todavía.',
          );
        }

        if (requestedValidTo) {
          throw new BadRequestException(
            'Una versión VIGENTE no debe cerrarse con validTo. Déjalo vacío para mantenerla abierta.',
          );
        }

        const otherActiveVersions = await versionRepo.find({
          where: {
            schemeId: version.schemeId,
            deletedAt: IsNull(),
            status: VaccinationSchemeVersionStatusEnum.VIGENTE,
          } as never,
        });

        for (const otherVersion of otherActiveVersions) {
          if (otherVersion.id === version.id) {
            continue;
          }

          const otherValidFrom = this.asDateOnly(otherVersion.validFrom)!;
          if (requestedValidFrom <= otherValidFrom) {
            throw new BadRequestException(
              'La nueva vigencia debe iniciar después de la versión vigente actual para cerrar correctamente la anterior.',
            );
          }

          const previousDay = this.addDays(requestedValidFrom, -1);
          if (previousDay < otherValidFrom) {
            throw new BadRequestException(
              'No se pudo cerrar la versión vigente anterior porque el rango de fechas quedaría inválido.',
            );
          }

          otherVersion.status = VaccinationSchemeVersionStatusEnum.REEMPLAZADO;
          otherVersion.validTo = previousDay;
          await versionRepo.save(otherVersion);
        }

        version.status = VaccinationSchemeVersionStatusEnum.VIGENTE;
        version.validFrom = requestedValidFrom;
        version.validTo = null;
      } else {
        const effectiveValidTo = requestedValidTo ?? this.todayDateOnly();
        if (effectiveValidTo < currentValidFrom) {
          throw new BadRequestException('validTo no puede ser anterior a validFrom.');
        }

        if (this.isVersionUsableToday(version)) {
          const hasOtherUsableVersionForSpecies =
            await this.hasOtherUsableVersionForSpecies(
              version.scheme.speciesId,
              version.id,
              manager,
            );

          if (!hasOtherUsableVersionForSpecies) {
            throw new BadRequestException(
              'No puedes cerrar esta versión porque dejarías a la especie sin una versión vigente utilizable.',
            );
          }
        }

        version.status = dto.status;
        version.validTo = effectiveValidTo;
      }

      if (dto.changeReason !== undefined) {
        version.changeReason = dto.changeReason?.trim() ?? null;
      }

      await versionRepo.save(version);
    });

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

    const isExternal = dto.encounterId ? false : (dto.isExternal ?? true);

    if (dto.encounterId) {
      const encounter = await this.encounterRepo.findOne({
        where: { id: dto.encounterId, patientId },
      });

      if (!encounter || encounter.deletedAt) {
        throw new BadRequestException(
          'El encounter referenciado no existe o no corresponde a este paciente.',
        );
      }

      if (!dto.administeredByEmployeeId) {
        throw new BadRequestException(
          'administeredByEmployeeId es obligatorio cuando la aplicación está ligada a un encounter.',
        );
      }

      if (encounter.vetId !== dto.administeredByEmployeeId) {
        throw new BadRequestException(
          'El veterinario administrador debe coincidir con el veterinario responsable del encounter.',
        );
      }
    }

    const applicationDate = new Date(dto.applicationDate);
    const nextDoseDate = dto.nextDoseDate ? new Date(dto.nextDoseDate) : null;
    if (!isExternal && !dto.administeredByEmployeeId) {
      throw new BadRequestException(
        'administeredByEmployeeId es obligatorio cuando la aplicación no es externa.',
      );
    }

    const veterinarian = dto.administeredByEmployeeId
      ? await this.findVeterinarianEmployeeOrFail(dto.administeredByEmployeeId)
      : null;

    const saved = await this.dataSource.transaction(async (manager) => {
      const record = await manager.getRepository(PatientVaccineRecord).save(
        manager.getRepository(PatientVaccineRecord).create({
          patientId,
          vaccineId: dto.vaccineId,
          applicationDate,
          administeredBy: veterinarian ? this.formatEmployeeName(veterinarian) : null,
          administeredByEmployeeId: veterinarian?.id ?? null,
          administeredAt: dto.administeredAt?.trim() ?? null,
          isExternal,
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
    const requestedStatus =
      dto.status ?? VaccinationSchemeVersionStatusEnum.VIGENTE;
    if (requestedStatus !== VaccinationSchemeVersionStatusEnum.VIGENTE) {
      throw new BadRequestException(
        'Una nueva versión debe crearse como VIGENTE.',
      );
    }

    if (dto.validTo) {
      throw new BadRequestException(
        'Una nueva versión VIGENTE no debe cerrarse con validTo. Déjalo vacío para mantenerla abierta.',
      );
    }

    const validFrom = this.parseDateOnly(dto.validFrom);
    if (validFrom > this.todayDateOnly()) {
      throw new BadRequestException(
        'Una nueva versión VIGENTE no puede iniciar en una fecha futura. Crea la versión cuando realmente entre en vigor.',
      );
    }

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

    const activeVersions = await manager.getRepository(VaccinationSchemeVersion).find({
      where: {
        schemeId,
        deletedAt: IsNull(),
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      } as never,
    });

    for (const activeVersion of activeVersions) {
      const activeValidFrom = this.asDateOnly(activeVersion.validFrom)!;
      if (validFrom <= activeValidFrom) {
        throw new BadRequestException(
          'La nueva versión debe iniciar después de la versión vigente actual para cerrar correctamente la anterior.',
        );
      }

      const previousDay = this.addDays(validFrom, -1);
      if (previousDay < activeValidFrom) {
        throw new BadRequestException(
          'No se pudo cerrar la versión vigente anterior porque el rango de fechas quedaría inválido.',
        );
      }

      activeVersion.status = VaccinationSchemeVersionStatusEnum.REEMPLAZADO;
      activeVersion.validTo = previousDay;
      await manager.getRepository(VaccinationSchemeVersion).save(activeVersion);
    }

    const savedVersion = await manager.getRepository(VaccinationSchemeVersion).save(
      manager.getRepository(VaccinationSchemeVersion).create({
        schemeId,
        version: dto.version,
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
        validFrom,
        validTo: null,
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

  private async findVeterinarianEmployeeOrFail(employeeId: number): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: ['person'],
    });

    if (!employee || employee.deletedAt) {
      throw new NotFoundException('Empleado administrador de vacuna no encontrado.');
    }

    if (!employee.isVeterinarian) {
      throw new BadRequestException(
        'El empleado seleccionado no está habilitado como veterinario.',
      );
    }

    return employee;
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

  private formatEmployeeName(employee: Employee): string {
    return employee.person
      ? `${employee.person.firstName} ${employee.person.lastName}`.trim()
      : employee.code ?? `Empleado ${employee.id}`;
  }

  private toSchemeResponse(scheme: VaccinationScheme): VaccinationSchemeResponseDto {
    const versions = [...(scheme.versions ?? [])]
      .filter((version) => !version.deletedAt)
      .sort((a, b) => b.version - a.version);
    const activeVersion = versions.find(
      (version) => this.isVersionUsableToday(version),
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

  private toDateString(value: Date | string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    return String(value).split('T')[0];
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private asDateOnly(value: Date | string | null | undefined): Date | null {
    const normalized = this.toDateString(value);
    return normalized ? this.parseDateOnly(normalized) : null;
  }

  private todayDateOnly(): Date {
    return this.parseDateOnly(this.toDateString(new Date())!);
  }

  private addDays(value: Date, days: number): Date {
    const adjusted = new Date(value);
    adjusted.setUTCDate(adjusted.getUTCDate() + days);
    return adjusted;
  }

  private isVersionUsableToday(version: VaccinationSchemeVersion): boolean {
    if (version.status !== VaccinationSchemeVersionStatusEnum.VIGENTE) {
      return false;
    }

    const today = this.todayDateOnly();
    const validFrom = this.asDateOnly(version.validFrom);
    const validTo = this.asDateOnly(version.validTo);

    if (!validFrom) {
      return false;
    }

    return validFrom <= today && (!validTo || validTo >= today);
  }

  private async hasOtherUsableVersionForSpecies(
    speciesId: number,
    excludedVersionId: number,
    manager: EntityManager,
  ): Promise<boolean> {
    const count = await manager
      .getRepository(VaccinationSchemeVersion)
      .createQueryBuilder('version')
      .innerJoin('version.scheme', 'scheme')
      .where('scheme.species_id = :speciesId', { speciesId })
      .andWhere('scheme.deleted_at IS NULL')
      .andWhere('scheme.is_active = true')
      .andWhere('version.deleted_at IS NULL')
      .andWhere('version.is_active = true')
      .andWhere('version.status = :status', {
        status: VaccinationSchemeVersionStatusEnum.VIGENTE,
      })
      .andWhere('version.id <> :excludedVersionId', { excludedVersionId })
      .andWhere('version.valid_from <= CURRENT_DATE')
      .andWhere('(version.valid_to IS NULL OR version.valid_to >= CURRENT_DATE)')
      .getCount();

    return count > 0;
  }
}
