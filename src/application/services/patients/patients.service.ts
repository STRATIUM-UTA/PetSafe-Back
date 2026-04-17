import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig, Paginated } from 'nestjs-paginate';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Breed } from '../../../domain/entities/catalogs/breed.entity.js';
import { SurgeryCatalog } from '../../../domain/entities/catalogs/surgery-catalog.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { Surgery } from '../../../domain/entities/encounters/surgery.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { CreatePatientDto } from '../../../presentation/dto/patients/create-patient.dto.js';
import { UpdatePatientDto } from '../../../presentation/dto/patients/update-patient.dto.js';
import { CreateConditionDto } from '../../../presentation/dto/patients/create-condition.dto.js';
import { AddPatientTutorDto } from '../../../presentation/dto/patients/add-patient-tutor.dto.js';
import { UpsertPatientSurgeryDto } from '../../../presentation/dto/patients/upsert-patient-surgery.dto.js';
import { InitializePatientVaccinationPlanDto } from '../../../presentation/dto/patients/initialize-patient-vaccination-plan.dto.js';
import {
  UpdatePatientVaccinationSchemeDto,
} from '../../../presentation/dto/patients/update-patient-vaccination-scheme.dto.js';
import { PatientResponseDto, PatientConditionResponseDto } from '../../../presentation/dto/patients/patient-response.dto.js';
import {
  PatientAdminBasicDetailResponse,
  PatientAdminBasicResponse,
  PatientBasicByClientResponse,
  PatientRecentActivityResponse,
  PatientRecentConsultationActivityResponse,
  PatientProcedureHistoryResponse,
  PatientRecentProcedureActivityResponse,
  PatientRecentSurgeryActivityResponse,
  PaginatedPatientsBasicForAdminResponse,
} from '../../../presentation/dto/patients/patient-basic-response.dto.js';
import { PatientVaccinationPlanResponseDto } from '../../../presentation/dto/vaccinations/vaccination-response.dto.js';
import { PatientMapper } from '../../mappers/patient.mapper.js';
import {
  MediaOwnerTypeEnum,
  MediaTypeEnum,
  RoleEnum,
  SurgeryStatusEnum,
  StorageProviderEnum,
} from '../../../domain/enums/index.js';
import { ListPatientTutorQueryDto } from 'src/presentation/dto/patients/list-patient-tutor-query.dto.js';
import { ListPatientTutorResponseDto } from 'src/presentation/dto/patients/list-patient-tutor-response.dto.js';
import { PATIENT_UPLOADS_DIR } from '../../../infra/config/uploads.config.js';
import { VaccinationPlanService } from '../vaccinations/vaccination-plan.service.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { EncounterMapper } from '../../mappers/encounter.mapper.js';
import { PatientClinicalHistoryResponse } from '../../../presentation/dto/patients/patient-clinical-history-response.dto.js';

const PAGINATE_CONFIG: PaginateConfig<Patient> = {
  sortableColumns: ['id', 'name', 'code', 'createdAt'],
  defaultSortBy: [['name', 'ASC']],
  searchableColumns: ['name', 'code', 'microchipCode'],
  relations: ['species', 'breed', 'color'],
  maxLimit: 50,
  defaultLimit: 20,
};

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientTutor)
    private readonly patientTutorRepo: Repository<PatientTutor>,
    @InjectRepository(PatientCondition)
    private readonly conditionRepo: Repository<PatientCondition>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Species)
    private readonly speciesRepo: Repository<Species>,
    @InjectRepository(Breed)
    private readonly breedRepo: Repository<Breed>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Procedure)
    private readonly procedureRepo: Repository<Procedure>,
    @InjectRepository(SurgeryCatalog)
    private readonly surgeryCatalogRepo: Repository<SurgeryCatalog>,
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
    private readonly dataSource: DataSource,
    private readonly vaccinationPlanService: VaccinationPlanService,
  ) { }

  private async resolveClientId(userId: number, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(Client) : this.clientRepo;

    const client = await repo
      .createQueryBuilder('c')
      .innerJoin('persons', 'p', 'p.id = c.person_id')
      .innerJoin('users', 'u', 'u.person_id = p.id')
      .where('u.id = :userId', { userId })
      .andWhere('c.deleted_at IS NULL')
      .select('c.id')
      .getOne();

    if (!client) {
      throw new NotFoundException('No se encontró un perfil de cliente para este usuario');
    }
    return client.id;
  }

  private async verifyOwnership(patientId: number, userId: number, manager?: EntityManager): Promise<Patient> {
    const repo = manager ? manager.getRepository(Patient) : this.patientRepo;

    const patient = await repo
      .createQueryBuilder('p')
      .innerJoin('patient_tutors', 'pt', 'pt.patient_id = p.id AND pt.deleted_at IS NULL')
      .innerJoin('clients', 'c', 'c.id = pt.client_id AND c.deleted_at IS NULL')
      .innerJoin('persons', 'per', 'per.id = c.person_id')
      .innerJoin('users', 'u', 'u.person_id = per.id AND u.deleted_at IS NULL')
      .where('p.id = :patientId', { patientId })
      .andWhere('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!patient) {
      throw new NotFoundException('Mascota no encontrada');
    }
    return patient;
  }

  async create(
    dto: CreatePatientDto,
    userId: number,
    roles: string[],
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    return this.createWithOptionalImage(dto, userId, roles, imageFile, imageBaseUrl);
  }

  async createWithoutTutor(
    dto: CreatePatientDto,
    userId: number,
    roles: string[],
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (!this.canAccessAnyPatient(roles)) {
          throw new NotFoundException('Mascota no encontrada');
        }

        await this.ensurePatientTaxonomyIsValid(dto.speciesId, dto.breedId ?? null, manager);

        const patient = manager.create(Patient, {
          name: dto.name,
          speciesId: dto.speciesId,
          sex: dto.sex as any,
          breedId: dto.breedId ?? null,
          colorId: dto.colorId ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          currentWeight: dto.currentWeight ?? null,
          isSterilized: dto.sterilized ?? false,
          microchipCode: dto.microchipCode ?? null,
          distinguishingMarks: dto.distinguishingMarks ?? null,
          generalAllergies: dto.generalAllergies ?? null,
          generalHistory: dto.generalHistory ?? null,
        });
        const saved = await manager.save(Patient, patient);

        await this.syncExternalPatientSurgeries(
          saved.id,
          dto.surgeries,
          userId,
          manager,
        );
        await this.upsertPatientImage(saved.id, imageFile, imageBaseUrl, userId, manager);

        return this.findOneInternal(saved.id, userId, manager, roles);
      });
    } catch (error) {
      await this.deleteStoredFileIfExists(imageFile?.filename);
      throw error;
    }
  }

  async createWithOptionalImage(
    dto: CreatePatientDto,
    userId: number,
    roles: string[],
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const clientId = await this.resolveTargetClientId(dto, userId, roles, manager);
        await this.ensurePatientTaxonomyIsValid(dto.speciesId, dto.breedId ?? null, manager);

        const patient = manager.create(Patient, {
          name: dto.name,
          speciesId: dto.speciesId,
          sex: dto.sex as any,
          breedId: dto.breedId ?? null,
          colorId: dto.colorId ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          currentWeight: dto.currentWeight ?? null,
          isSterilized: dto.sterilized ?? false,
          microchipCode: dto.microchipCode ?? null,
          distinguishingMarks: dto.distinguishingMarks ?? null,
          generalAllergies: dto.generalAllergies ?? null,
          generalHistory: dto.generalHistory ?? null,
        });
        const saved = await manager.save(Patient, patient);

        await this.syncExternalPatientSurgeries(
          saved.id,
          dto.surgeries,
          userId,
          manager,
        );
        await this.upsertPatientImage(saved.id, imageFile, imageBaseUrl, userId, manager);

        const tutor = manager.create(PatientTutor, {
          patientId: saved.id,
          clientId: clientId,
          isPrimary: true,
          relationship: 'Propietario',
        });
        await manager.save(PatientTutor, tutor);
        const shouldInitializeVaccinationPlan =
          dto.vaccinationSchemeId !== undefined ||
          (await this.vaccinationPlanService.hasUsableSchemeForSpecies(
            saved.speciesId,
            manager,
          ));

        if (shouldInitializeVaccinationPlan) {
          await this.vaccinationPlanService.initializePlanForPatient(
            saved.id,
            saved.speciesId,
            saved.birthDate ?? null,
            dto.vaccinationSchemeId ?? null,
            manager,
          );
        }

        return this.findOneInternal(saved.id, userId, manager, roles);
      });
    } catch (error) {
      await this.deleteStoredFileIfExists(imageFile?.filename);
      throw error;
    }
  }

  async findAllByUser(query: PaginateQuery, userId: number): Promise<Paginated<any>> {
    const qb = this.patientRepo
      .createQueryBuilder('p')
      .innerJoin('patient_tutors', 'pt', 'pt.patient_id = p.id AND pt.deleted_at IS NULL')
      .innerJoin('clients', 'c', 'c.id = pt.client_id AND c.deleted_at IS NULL')
      .innerJoin('persons', 'per', 'per.id = c.person_id')
      .innerJoin('users', 'u', 'u.person_id = per.id AND u.deleted_at IS NULL')
      .leftJoinAndSelect('p.species', 'species')
      .leftJoinAndSelect('p.breed', 'breed')
      .leftJoinAndSelect('p.color', 'color')
      .where('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL');

    const result = await paginate(query, qb, PAGINATE_CONFIG);
    const imagesByPatientId = await this.findImagesByPatientIds(
      result.data.map((patient) => patient.id),
    );
    return {
      ...result,
      data: result.data.map((patient) =>
        PatientMapper.toResponseDto(patient, imagesByPatientId.get(patient.id)),
      ),
    };
  }

  async findOne(patientId: number, userId: number): Promise<PatientResponseDto> {
    return this.findOneInternal(patientId, userId);
  }

  async update(
    patientId: number,
    dto: UpdatePatientDto,
    userId: number,
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    return this.updateWithOptionalImage(patientId, dto, userId, imageFile, imageBaseUrl);
  }

  async updateWithOptionalImage(
    patientId: number,
    dto: UpdatePatientDto,
    userId: number,
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    let previousImage: MediaFile | null = null;

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const existingPatient = await this.verifyOwnership(patientId, userId, manager);

        const targetSpeciesId = dto.speciesId ?? existingPatient.speciesId;
        const targetBreedId = dto.breedId !== undefined ? (dto.breedId ?? null) : existingPatient.breedId;
        await this.ensurePatientTaxonomyIsValid(targetSpeciesId, targetBreedId, manager);

        const updateData: Partial<Patient> = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.speciesId !== undefined) updateData.speciesId = dto.speciesId;
        if (dto.sex !== undefined) updateData.sex = dto.sex as any;
        if (dto.breedId !== undefined) updateData.breedId = dto.breedId ?? null;
        if (dto.colorId !== undefined) updateData.colorId = dto.colorId ?? null;
        if (dto.birthDate !== undefined) {
          updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
        }
        if (dto.currentWeight !== undefined) updateData.currentWeight = dto.currentWeight ?? null;
        if (dto.sterilized !== undefined) updateData.isSterilized = dto.sterilized;
        if (dto.microchipCode !== undefined) updateData.microchipCode = dto.microchipCode ?? null;
        if (dto.distinguishingMarks !== undefined) updateData.distinguishingMarks = dto.distinguishingMarks ?? null;
        if (dto.generalAllergies !== undefined) updateData.generalAllergies = dto.generalAllergies ?? null;
        if (dto.generalHistory !== undefined) updateData.generalHistory = dto.generalHistory ?? null;

        await manager.update(Patient, patientId, updateData);
        await this.syncExternalPatientSurgeries(patientId, dto.surgeries, userId, manager);
        previousImage = imageFile ? await this.findPatientImage(patientId, manager) : null;
        await this.upsertPatientImage(patientId, imageFile, imageBaseUrl, userId, manager);
        if (dto.speciesId !== undefined || dto.birthDate !== undefined) {
          await this.vaccinationPlanService.syncPatientPlanAfterPatientUpdate(
            patientId,
            targetSpeciesId,
            updateData.birthDate !== undefined
              ? (updateData.birthDate ?? null)
              : (existingPatient.birthDate ?? null),
            manager,
          );
        }

        return this.findOneInternal(patientId, userId, manager);
      });

      await this.deleteMediaPhysicalFile(previousImage);
      return result;
    } catch (error) {
      await this.deleteStoredFileIfExists(imageFile?.filename);
      throw error;
    }
  }

  async softDelete(patientId: number, userId: number): Promise<{ message: string }> {
    await this.verifyOwnership(patientId, userId);
    await this.patientRepo.softDelete(patientId);
    return { message: 'Mascota eliminada correctamente' };
  }

  async addCondition(patientId: number, dto: CreateConditionDto, userId: number): Promise<PatientConditionResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.verifyOwnership(patientId, userId, manager);

      const condition = manager.create(PatientCondition, {
        patientId: patientId,
        type: dto.type,
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.active ?? true,
      });
      const saved = await manager.save(PatientCondition, condition);

      return PatientMapper.toConditionDto(saved);
    });
  }

  async removeCondition(patientId: number, conditionId: number, userId: number): Promise<{ message: string }> {
    await this.verifyOwnership(patientId, userId);

    const condition = await this.conditionRepo.findOne({
      where: { id: conditionId, patientId: patientId },
    });
    if (!condition) {
      throw new NotFoundException('Condición no encontrada');
    }

    await this.conditionRepo.softDelete(conditionId);
    return { message: 'Condición eliminada correctamente' };
  }

  async addTutor(
    patientId: number,
    dto: AddPatientTutorDto,
    roles: string[],
  ): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      await this.ensureClientExists(dto.clientId, manager);

      const tutorRepo = manager.getRepository(PatientTutor);
      const existingTutor = await tutorRepo.findOne({
        where: { patientId, clientId: dto.clientId },
        withDeleted: true,
      });

      if (existingTutor && !existingTutor.deletedAt) {
        throw new BadRequestException('Ese tutor ya está relacionado con la mascota.');
      }

      if (dto.isPrimary) {
        await this.clearPrimaryTutor(patientId, manager);
      }

      if (existingTutor) {
        existingTutor.deletedAt = null;
        existingTutor.deletedByUserId = null;
        existingTutor.isActive = true;
        existingTutor.isPrimary = dto.isPrimary ?? false;
        existingTutor.relationship = dto.relationship ?? existingTutor.relationship ?? 'Responsable';
        await tutorRepo.save(existingTutor);
      } else {
        const tutor = tutorRepo.create({
          patientId,
          clientId: dto.clientId,
          isPrimary: dto.isPrimary ?? false,
          relationship: dto.relationship ?? 'Responsable',
          isActive: true,
        });
        await tutorRepo.save(tutor);
      }

      await this.ensurePrimaryTutorExists(patientId, manager);
      return this.findOneInternal(patientId, 0, manager, roles);
    });
  }

  async setPrimaryTutor(
    patientId: number,
    clientId: number,
    roles: string[],
  ): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      const tutorRepo = manager.getRepository(PatientTutor);
      const tutor = await tutorRepo.findOne({
        where: { patientId, clientId },
      });

      if (!tutor || tutor.deletedAt) {
        throw new NotFoundException('Relación tutor-mascota no encontrada');
      }

      await this.clearPrimaryTutor(patientId, manager);
      tutor.isPrimary = true;
      await tutorRepo.save(tutor);

      return this.findOneInternal(patientId, 0, manager, roles);
    });
  }

  async removeTutor(
    patientId: number,
    clientId: number,
    userId: number,
    roles: string[],
  ): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      const tutorRepo = manager.getRepository(PatientTutor);
      const tutors = await tutorRepo.find({
        where: { patientId },
        order: { createdAt: 'ASC' },
      });

      const activeTutors = tutors.filter((tutor) => !tutor.deletedAt);
      const tutorToRemove = activeTutors.find((tutor) => tutor.clientId === clientId);

      if (!tutorToRemove) {
        throw new NotFoundException('Relación tutor-mascota no encontrada');
      }

      if (activeTutors.length <= 1) {
        throw new BadRequestException('La mascota debe tener al menos un tutor activo.');
      }

      const wasPrimary = tutorToRemove.isPrimary;
      tutorToRemove.deletedAt = new Date();
      tutorToRemove.deletedByUserId = userId;
      tutorToRemove.isActive = false;
      tutorToRemove.isPrimary = false;
      await tutorRepo.save(tutorToRemove);

      if (wasPrimary) {
        const replacement = activeTutors.find((tutor) => tutor.clientId !== clientId);
        if (replacement) {
          replacement.isPrimary = true;
          await tutorRepo.save(replacement);
        }
      }

      await this.ensurePrimaryTutorExists(patientId, manager);
      return this.findOneInternal(patientId, 0, manager, roles);
    });
  }

  async updateVaccinationScheme(
    patientId: number,
    dto: UpdatePatientVaccinationSchemeDto,
    roles: string[],
  ): Promise<PatientVaccinationPlanResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      return this.vaccinationPlanService.reassignOrRefreshPatientPlan(
        patientId,
        dto.mode,
        dto.vaccinationSchemeId ?? null,
        dto.notes ?? null,
        manager,
      );
    });
  }

  async initializeVaccinationPlan(
    patientId: number,
    dto: InitializePatientVaccinationPlanDto,
    roles: string[],
  ): Promise<PatientVaccinationPlanResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      await this.vaccinationPlanService.initializePlanForExistingPatient(
        patientId,
        dto.vaccinationSchemeId ?? null,
        manager,
      );
      return this.vaccinationPlanService.getPatientPlanDetail(patientId, manager);
    });
  }

  async createAdminSurgery(
    patientId: number,
    dto: UpsertPatientSurgeryDto,
    userId: number,
    roles: string[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      const surgery = await this.upsertAdminSurgeryEntity(patientId, dto, userId, manager);
      return PatientMapper.toSurgeryDto(surgery);
    });
  }

  async updateAdminSurgery(
    patientId: number,
    surgeryId: number,
    dto: UpsertPatientSurgeryDto,
    userId: number,
    roles: string[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      const surgeryRepo = manager.getRepository(Surgery);
      const surgery = await surgeryRepo.findOne({ where: { id: surgeryId, patientId } });

      if (!surgery || surgery.deletedAt) {
        throw new NotFoundException('Cirugía no encontrada para esta mascota.');
      }

      if (!surgery.isExternal || surgery.encounterId !== null) {
        throw new BadRequestException(
          'Solo puedes editar desde el perfil cirugías externas no vinculadas a una atención.',
        );
      }

      const saved = await this.upsertAdminSurgeryEntity(patientId, dto, userId, manager, surgery);
      return PatientMapper.toSurgeryDto(saved);
    });
  }

  async removeAdminSurgery(
    patientId: number,
    surgeryId: number,
    userId: number,
    roles: string[],
  ): Promise<{ message: string }> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensurePatientAccessibleForStaff(patientId, roles, manager);
      const surgeryRepo = manager.getRepository(Surgery);
      const surgery = await surgeryRepo.findOne({ where: { id: surgeryId, patientId } });

      if (!surgery || surgery.deletedAt) {
        throw new NotFoundException('Cirugía no encontrada para esta mascota.');
      }

      if (!surgery.isExternal || surgery.encounterId !== null) {
        throw new BadRequestException(
          'Solo puedes eliminar desde el perfil cirugías externas no vinculadas a una atención.',
        );
      }

      surgery.deletedAt = new Date();
      surgery.deletedByUserId = userId;
      surgery.isActive = false;
      await surgeryRepo.save(surgery);

      return { message: 'Cirugía eliminada correctamente.' };
    });
  }

  private async upsertAdminSurgeryEntity(
    patientId: number,
    dto: UpsertPatientSurgeryDto,
    _userId: number,
    manager: EntityManager,
    surgery?: Surgery,
  ): Promise<Surgery> {
    const normalizedType = dto.surgeryType?.trim() || null;
    let catalogId: number | null = null;
    let surgeryType = normalizedType;

    if (dto.catalogId !== undefined) {
      const catalog = await this.findSurgeryCatalogOrFail(dto.catalogId, manager);
      catalogId = catalog.id;
      surgeryType = surgeryType || catalog.name;
    }

    if (!surgeryType) {
      throw new BadRequestException(
        'Debes seleccionar una cirugía del catálogo o escribir el nombre manual.',
      );
    }

    const target = surgery ?? manager.getRepository(Surgery).create();
    target.patientId = patientId;
    target.encounterId = null;
    target.catalogId = catalogId;
    target.surgeryType = surgeryType;
    target.scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
    target.performedDate = dto.performedDate ? new Date(dto.performedDate) : null;
    target.surgeryStatus = dto.surgeryStatus ?? SurgeryStatusEnum.FINALIZADA;
    target.isExternal = true;
    target.description = dto.description?.trim() || null;
    target.postoperativeInstructions = dto.postoperativeInstructions?.trim() || null;
    target.deletedAt = null;
    target.deletedByUserId = null;
    target.isActive = true;

    return manager.getRepository(Surgery).save(target);
  }

  private async syncExternalPatientSurgeries(
    patientId: number,
    surgeries: UpsertPatientSurgeryDto[] | undefined,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (surgeries === undefined) {
      return;
    }

    const surgeryRepo = manager.getRepository(Surgery);
    const existingExternal = await surgeryRepo.find({
      where: {
        patientId,
        isExternal: true,
      },
      withDeleted: true,
    });

    const activeExternal = existingExternal.filter((item) => !item.deletedAt);
    const retainedIds = new Set<number>();

    for (const input of surgeries) {
      const normalizedType = input.surgeryType?.trim() || null;
      let catalogId: number | null = null;
      let surgeryType = normalizedType;

      if (input.catalogId !== undefined) {
        const catalog = await this.findSurgeryCatalogOrFail(input.catalogId, manager);
        catalogId = catalog.id;
        surgeryType = surgeryType || catalog.name;
      }

      if (!surgeryType) {
        throw new BadRequestException(
          'Cada cirugía debe tener una opción del catálogo o un nombre manual.',
        );
      }

      let entity: Surgery | null = null;

      if (input.id !== undefined) {
        entity =
          activeExternal.find((item) => item.id === input.id)
          ?? null;

        if (!entity) {
          throw new NotFoundException('No se encontró una cirugía externa de la mascota para actualizar.');
        }
      }

      const surgery = entity ?? surgeryRepo.create();
      surgery.patientId = patientId;
      surgery.encounterId = null;
      surgery.catalogId = catalogId;
      surgery.surgeryType = surgeryType;
      surgery.scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : null;
      surgery.performedDate = input.performedDate ? new Date(input.performedDate) : null;
      surgery.surgeryStatus = input.surgeryStatus ?? SurgeryStatusEnum.FINALIZADA;
      surgery.isExternal = true;
      surgery.description = input.description?.trim() || null;
      surgery.postoperativeInstructions = input.postoperativeInstructions?.trim() || null;
      surgery.deletedAt = null;
      surgery.deletedByUserId = null;
      surgery.isActive = true;

      const saved = await surgeryRepo.save(surgery);
      retainedIds.add(saved.id);
    }

    const staleSurgeries = activeExternal.filter((item) => !retainedIds.has(item.id));
    for (const surgery of staleSurgeries) {
      surgery.deletedAt = new Date();
      surgery.deletedByUserId = userId;
      surgery.isActive = false;
      await surgeryRepo.save(surgery);
    }
  }

  private async findSurgeryCatalogOrFail(
    catalogId: number,
    manager?: EntityManager,
  ): Promise<SurgeryCatalog> {
    const repo = manager ? manager.getRepository(SurgeryCatalog) : this.surgeryCatalogRepo;
    const catalog = await repo.findOne({ where: { id: catalogId } });

    if (!catalog || catalog.deletedAt) {
      throw new NotFoundException('La cirugía seleccionada no existe en el catálogo.');
    }

    return catalog;
  }

  private async findOneInternal(patientId: number, userId: number, manager?: EntityManager, roles: string[] = []): Promise<PatientResponseDto> {
    const repo = manager ? manager.getRepository(Patient) : this.patientRepo;

    if (this.canAccessAnyPatient(roles)) {
      const patient = await repo.findOne({
        where: { id: patientId },
        relations: [
          'species',
          'breed',
          'color',
          'conditions',
          'surgeries',
          'tutors',
          'tutors.client',
          'tutors.client.person',
        ],
      });

      if (!patient || patient.deletedAt) throw new NotFoundException('Mascota no encontrada');

      patient.conditions = patient.conditions?.filter((c) => !c.deletedAt) ?? [];
      patient.surgeries = patient.surgeries?.filter((surgery) => !surgery.deletedAt) ?? [];
      const image = await this.findPatientImage(patient.id, manager);
      return PatientMapper.toResponseDto(patient, image);
    }

    const patient = await repo
      .createQueryBuilder('p')
      .innerJoin('patient_tutors', 'pt', 'pt.patient_id = p.id AND pt.deleted_at IS NULL')
      .innerJoin('clients', 'c', 'c.id = pt.client_id AND c.deleted_at IS NULL')
      .innerJoin('persons', 'per', 'per.id = c.person_id')
      .innerJoin('users', 'u', 'u.person_id = per.id AND u.deleted_at IS NULL')
      .leftJoinAndSelect('p.species', 'species')
      .leftJoinAndSelect('p.breed', 'breed')
      .leftJoinAndSelect('p.color', 'color')
      .leftJoinAndSelect('p.conditions', 'conditions', 'conditions.deleted_at IS NULL')
      .leftJoinAndSelect('p.surgeries', 'surgeries', 'surgeries.deleted_at IS NULL')
      .leftJoinAndSelect('p.tutors', 'tutors', 'tutors.deleted_at IS NULL')
      .leftJoinAndSelect('tutors.client', 'tutorClient')
      .leftJoinAndSelect('tutorClient.person', 'tutorPerson')
      .where('p.id = :patientId', { patientId })
      .andWhere('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!patient) throw new NotFoundException('Mascota no encontrada');

    const image = await this.findPatientImage(patient.id, manager);
    return PatientMapper.toResponseDto(patient, image);
  }

  private activityWindowStart(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 30);
    return date;
  }

  private buildPatientConsultationSequenceSql(encounterAlias: string): string {
    return `(
      SELECT COUNT(*)::int
      FROM encounters enc_sequence
      WHERE enc_sequence.patient_id = ${encounterAlias}.patient_id
        AND enc_sequence.deleted_at IS NULL
        AND (
          enc_sequence.start_time < ${encounterAlias}.start_time
          OR (
            enc_sequence.start_time = ${encounterAlias}.start_time
            AND enc_sequence.id <= ${encounterAlias}.id
          )
        )
    )`;
  }

  private async buildProcedureHistory(
    patientId: number,
    manager?: EntityManager,
  ): Promise<PatientProcedureHistoryResponse[]> {
    const repoContext = manager ?? this.dataSource.manager;
    const patientConsultationSequenceSql = this.buildPatientConsultationSequenceSql('enc');

    const procedureRows = await repoContext
      .getRepository(Procedure)
      .createQueryBuilder('procedure')
      .innerJoin('procedure.encounter', 'enc')
      .leftJoin('enc.vet', 'vet')
      .leftJoin('vet.person', 'person')
      .where('enc.patient_id = :patientId', { patientId })
      .andWhere('enc.deleted_at IS NULL')
      .andWhere('procedure.deleted_at IS NULL')
      .select([
        'procedure.id AS id',
        'procedure.encounter_id AS "encounterId"',
        `${patientConsultationSequenceSql} AS "patientConsultationNumber"`,
        'procedure.procedure_type AS "procedureType"',
        'procedure.performed_date AS "performedDate"',
        "TRIM(CONCAT(COALESCE(person.first_name, ''), ' ', COALESCE(person.last_name, ''))) AS \"clinicianName\"",
        'procedure.description AS description',
        'procedure.result AS result',
        'procedure.notes AS notes',
      ])
      .orderBy('procedure.performed_date', 'DESC')
      .addOrderBy('procedure.id', 'DESC')
      .getRawMany<PatientProcedureHistoryResponse>();

    return procedureRows.map((row) => ({
      ...row,
      clinicianName: row.clinicianName?.trim() || null,
      description: row.description?.trim() || null,
      result: row.result?.trim() || null,
      notes: row.notes?.trim() || null,
    }));
  }

  private async buildRecentActivity(
    patientId: number,
    manager?: EntityManager,
  ): Promise<PatientRecentActivityResponse> {
    const repoContext = manager ?? this.dataSource.manager;
    const since = this.activityWindowStart();
    const now = new Date();
    const patientConsultationSequenceSql = this.buildPatientConsultationSequenceSql('enc');

    const consultationRows = await repoContext
      .getRepository(Encounter)
      .createQueryBuilder('enc')
      .leftJoin('enc.consultationReason', 'reason')
      .leftJoin('enc.vet', 'vet')
      .leftJoin('vet.person', 'person')
      .where('enc.patient_id = :patientId', { patientId })
      .andWhere('enc.deleted_at IS NULL')
      .andWhere('enc.start_time >= :since', { since })
      .select([
        'enc.id AS id',
        `${patientConsultationSequenceSql} AS "patientConsultationNumber"`,
        'enc.start_time AS "startTime"',
        'enc.status AS status',
        "TRIM(CONCAT(COALESCE(person.first_name, ''), ' ', COALESCE(person.last_name, ''))) AS \"clinicianName\"",
        'reason.consultation_reason AS "consultationReason"',
      ])
      .orderBy('enc.start_time', 'DESC')
      .limit(5)
      .getRawMany<PatientRecentConsultationActivityResponse>();

    const procedureRows = await repoContext
      .getRepository(Procedure)
      .createQueryBuilder('procedure')
      .innerJoin('procedure.encounter', 'enc')
      .leftJoin('enc.vet', 'vet')
      .leftJoin('vet.person', 'person')
      .where('enc.patient_id = :patientId', { patientId })
      .andWhere('enc.deleted_at IS NULL')
      .andWhere('procedure.deleted_at IS NULL')
      .andWhere('procedure.performed_date >= :since', { since })
      .select([
        'procedure.id AS id',
        'procedure.encounter_id AS "encounterId"',
        `${patientConsultationSequenceSql} AS "patientConsultationNumber"`,
        'procedure.procedure_type AS "procedureType"',
        'procedure.performed_date AS "performedDate"',
        "TRIM(CONCAT(COALESCE(person.first_name, ''), ' ', COALESCE(person.last_name, ''))) AS \"clinicianName\"",
      ])
      .orderBy('procedure.performed_date', 'DESC')
      .limit(5)
      .getRawMany<PatientRecentProcedureActivityResponse>();

    const surgeryRows = await repoContext
      .getRepository(Surgery)
      .createQueryBuilder('surgery')
      .leftJoin('surgery.encounter', 'enc')
      .leftJoin('enc.vet', 'vet')
      .leftJoin('vet.person', 'person')
      .where('surgery.patient_id = :patientId', { patientId })
      .andWhere('surgery.deleted_at IS NULL')
      .andWhere('COALESCE(surgery.performed_date, surgery.scheduled_date, surgery.created_at) >= :since', {
        since,
      })
      .select([
        'surgery.id AS id',
        'surgery.encounter_id AS "encounterId"',
        'surgery.surgery_type AS "surgeryType"',
        'COALESCE(surgery.performed_date, surgery.scheduled_date, surgery.created_at) AS "activityDate"',
        'surgery.surgery_status AS "surgeryStatus"',
        'surgery.is_external AS "isExternal"',
        "TRIM(CONCAT(COALESCE(person.first_name, ''), ' ', COALESCE(person.last_name, ''))) AS \"clinicianName\"",
      ])
      .orderBy('COALESCE(surgery.performed_date, surgery.scheduled_date, surgery.created_at)', 'DESC')
      .limit(5)
      .getRawMany<PatientRecentSurgeryActivityResponse>();

    return {
      windowStart: since.toISOString(),
      windowEnd: now.toISOString(),
      consultations: consultationRows.map((row) => ({
        ...row,
        clinicianName: row.clinicianName?.trim() || null,
        consultationReason: row.consultationReason?.trim() || null,
      })),
      procedures: procedureRows.map((row) => ({
        ...row,
        clinicianName: row.clinicianName?.trim() || null,
      })),
      surgeries: surgeryRows.map((row) => ({
        ...row,
        clinicianName: row.clinicianName?.trim() || null,
        isExternal: Boolean(row.isExternal),
      })),
    };
  }

  private async resolveTargetClientId(dto: CreatePatientDto, userId: number, roles: string[], manager?: EntityManager): Promise<number> {
    if (this.canAssignPatientToAnyClient(roles)) {
      if (!dto.clientId) throw new BadRequestException('El campo clientId es obligatorio para administradores y recepcionistas');
      return this.ensureClientExists(dto.clientId, manager);
    }
    return this.resolveClientId(userId, manager);
  }

  private async ensureClientExists(clientId: number, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(Client) : this.clientRepo;
    const client = await repo.findOne({ where: { id: clientId } });
    if (!client || client.deletedAt) throw new NotFoundException('Cliente no encontrado');
    return client.id;
  }

  private canAssignPatientToAnyClient(roles: string[]): boolean {
    return roles.includes(RoleEnum.ADMIN) || roles.includes(RoleEnum.RECEPCIONISTA);
  }

  private canAccessAnyPatient(roles: string[]): boolean {
    return roles.includes(RoleEnum.ADMIN) || roles.includes(RoleEnum.RECEPCIONISTA) || roles.includes(RoleEnum.MVZ);
  }

  private async ensurePatientAccessibleForStaff(
    patientId: number,
    roles: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!this.canAccessAnyPatient(roles)) {
      throw new NotFoundException('Mascota no encontrada');
    }

    const repo = manager ? manager.getRepository(Patient) : this.patientRepo;
    const patient = await repo.findOne({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Mascota no encontrada');
    }
  }

  private async clearPrimaryTutor(patientId: number, manager: EntityManager): Promise<void> {
    await manager.getRepository(PatientTutor).update(
      {
        patientId,
        isPrimary: true,
      },
      { isPrimary: false },
    );
  }

  private async ensurePrimaryTutorExists(
    patientId: number,
    manager: EntityManager,
  ): Promise<void> {
    const tutorRepo = manager.getRepository(PatientTutor);
    const activeTutors = await tutorRepo.find({
      where: { patientId },
      order: { createdAt: 'ASC' },
    });

    const liveTutors = activeTutors.filter((tutor) => !tutor.deletedAt);
    if (liveTutors.length === 0) {
      throw new BadRequestException('La mascota debe tener al menos un tutor activo.');
    }

    if (!liveTutors.some((tutor) => tutor.isPrimary)) {
      liveTutors[0].isPrimary = true;
      await tutorRepo.save(liveTutors[0]);
    }
  }

  private async ensurePatientTaxonomyIsValid(
    speciesId: number,
    breedId: number | null,
    manager?: EntityManager,
  ): Promise<void> {
    const speciesRepo: Repository<Species> = manager ? manager.getRepository(Species) : this.speciesRepo;
    const breedRepo: Repository<Breed> = manager ? manager.getRepository(Breed) : this.breedRepo;

    const species = await speciesRepo.findOne({ where: { id: speciesId } });
    if (!species || species.deletedAt) {
      throw new NotFoundException('Especie no encontrada');
    }

    if (breedId === null) return;

    const breed = await breedRepo.findOne({ where: { id: breedId } });
    if (!breed || breed.deletedAt) {
      throw new NotFoundException('Raza no encontrada');
    }

    if (breed.speciesId !== speciesId) {
      throw new BadRequestException('La raza seleccionada no pertenece a la especie seleccionada');
    }
  }


  async findAllByClientId(
    clientId: number,
    userId: number,
    roles: string[],
  ): Promise<PatientBasicByClientResponse[]> {
    if (this.canAccessAnyPatient(roles)) {
      await this.ensureClientExists(clientId);
    } else {
      const myClientId = await this.resolveClientId(userId);
      if (myClientId !== clientId) {
        throw new NotFoundException('Cliente no encontrado');
      }
    }

    const patients = await this.patientRepo
      .createQueryBuilder('p')
      .innerJoin('patient_tutors', 'pt', 'pt.patient_id = p.id AND pt.deleted_at IS NULL')
      .innerJoin('clients', 'c', 'c.id = pt.client_id AND c.deleted_at IS NULL')
      .leftJoinAndSelect('p.species', 'species')
      .leftJoinAndSelect('p.breed', 'breed')
      .leftJoinAndSelect('p.color', 'color')
      .where('c.id = :clientId', { clientId })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.name', 'ASC')
      .getMany();

    const imagesByPatientId = await this.findImagesByPatientIds(
      patients.map((patient) => patient.id),
    );

    return patients.map((patient) => ({
      id: patient.id,
      name: patient.name,
      birthDate: patient.birthDate ?? null,
      species: patient.species
        ? {
          id: patient.species.id,
          name: patient.species.name,
        }
        : null,
      breed: patient.breed
        ? {
          id: patient.breed.id,
          name: patient.breed.name,
        }
        : null,
      color: patient.color
        ? {
          id: patient.color.id,
          name: patient.color.name,
        }
        : null,
      image: PatientMapper.toImageDto(imagesByPatientId.get(patient.id)),
    }));
  }

  async findAllBasic(query: PaginateQuery): Promise<PaginatedPatientsBasicForAdminResponse> {
    const page = Number(query.page ?? 1);
    const limitRaw = Number(query.limit ?? 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const search = typeof query.search === 'string' ? query.search.trim() : '';

    const qb = this.patientRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.species', 'species')
      .leftJoinAndSelect('p.breed', 'breed')
      .leftJoinAndSelect('p.tutors', 'pt', 'pt.is_primary = true AND pt.deleted_at IS NULL')
      .leftJoinAndSelect('pt.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .where('p.deleted_at IS NULL');

    if (search) {
      qb.andWhere(
        '(p.name ILIKE :search OR species.name ILIKE :search OR tutorPerson.first_name ILIKE :search OR tutorPerson.last_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('p.name', 'ASC');

    const total = await qb.clone().getCount();
    const patients = await qb.skip(offset).take(limit).getMany();
    const imagesByPatientId = await this.findImagesByPatientIds(
      patients.map((patient) => patient.id),
    );

    const getAgeYears = (birthDate: Date) => {
      const now = new Date();
      let years = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        years -= 1;
      }
      return Math.max(years, 0);
    };

    const data = patients.map((patient) => {
      const primaryTutor = patient.tutors?.[0];
      const tutorPerson = primaryTutor?.client?.person;
      const birthDate = patient.birthDate ?? null;
      const birthDateValue = birthDate ? new Date(birthDate as any) : null;
      const ageYears =
        birthDateValue && !Number.isNaN(birthDateValue.getTime())
          ? getAgeYears(birthDateValue)
          : null;

      return {
        id: patient.id,
        name: patient.name,
        species: patient.species
          ? {
            id: patient.species.id,
            name: patient.species.name,
          }
          : null,
        breed: patient.breed
          ? {
            id: patient.breed.id,
            name: patient.breed.name,
          }
          : null,
        tutorName: tutorPerson
          ? `${tutorPerson.firstName} ${tutorPerson.lastName}`.trim()
          : null,
        tutorContact: tutorPerson?.phone ?? null,
        birthDate,
        ageYears,
        sex: patient.sex,
        currentWeight: patient.currentWeight ?? null,
        image: PatientMapper.toImageDto(imagesByPatientId.get(patient.id)),
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const currentPage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage,
        hasNextPage: totalPages === 0 ? false : currentPage < totalPages,
        hasPrevPage: totalPages === 0 ? false : currentPage > 1,
      },
    };
  }

  async findAdminBasic(patientId: number, roles: string[]): Promise<PatientAdminBasicDetailResponse> {
    const patient = await this.findOneInternal(patientId, 0, undefined, roles);
    const recentActivity = await this.buildRecentActivity(patientId);
    const procedures = await this.buildProcedureHistory(patientId);
    const birthDate = patient.birthDate ?? null;
    const birthDateValue = birthDate ? new Date(birthDate as any) : null;

    const getAgeYears = (date: Date) => {
      const now = new Date();
      let years = now.getFullYear() - date.getFullYear();
      const monthDiff = now.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
        years -= 1;
      }
      return Math.max(years, 0);
    };

    const ageYears =
      birthDateValue && !Number.isNaN(birthDateValue.getTime())
        ? getAgeYears(birthDateValue)
        : null;

    return {
      id: patient.id,
      name: patient.name,
      species: patient.species
        ? {
          id: patient.species.id,
          name: patient.species.name,
        }
        : null,
      breed: patient.breed
        ? {
          id: patient.breed.id,
          name: patient.breed.name,
        }
        : null,
      sex: patient.sex,
      currentWeight: patient.currentWeight ?? null,
      birthDate,
      ageYears,
      color: patient.color
        ? {
          id: patient.color.id,
          name: patient.color.name,
        }
        : null,
      sterilized: patient.sterilized,
      generalAllergies: patient.generalAllergies ?? null,
      generalHistory: patient.generalHistory ?? null,
      image: patient.image ?? null,
      tutors: patient.tutors ?? [],
      clinicalObservations: patient.conditions ?? [],
      surgeries: patient.surgeries ?? [],
      procedures,
      recentActivity,
    };
  }

  async updateAdminBasic(
    patientId: number,
    dto: UpdatePatientDto,
    userId: number,
    roles: string[],
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<PatientResponseDto> {
    let previousImage: MediaFile | null = null;

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        if (!this.canAccessAnyPatient(roles)) {
          throw new NotFoundException('Mascota no encontrada');
        }

        const repo = manager.getRepository(Patient);
        const existingPatient = await repo.findOne({ where: { id: patientId } });

        if (!existingPatient || existingPatient.deletedAt) {
          throw new NotFoundException('Mascota no encontrada');
        }

        const targetSpeciesId = dto.speciesId ?? existingPatient.speciesId;
        const targetBreedId =
          dto.breedId !== undefined ? (dto.breedId ?? null) : existingPatient.breedId;
        await this.ensurePatientTaxonomyIsValid(targetSpeciesId, targetBreedId, manager);

        const updateData: Partial<Patient> = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.speciesId !== undefined) updateData.speciesId = dto.speciesId;
        if (dto.breedId !== undefined) updateData.breedId = dto.breedId ?? null;
        if (dto.sex !== undefined) updateData.sex = dto.sex as any;
        if (dto.birthDate !== undefined) {
          updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
        }
        if (dto.currentWeight !== undefined) updateData.currentWeight = dto.currentWeight ?? null;
        if (dto.colorId !== undefined) updateData.colorId = dto.colorId ?? null;
        if (dto.sterilized !== undefined) updateData.isSterilized = dto.sterilized;
        if (dto.generalAllergies !== undefined) {
          updateData.generalAllergies = dto.generalAllergies ?? null;
        }
        if (dto.generalHistory !== undefined) {
          updateData.generalHistory = dto.generalHistory ?? null;
        }

        await manager.update(Patient, patientId, updateData);
        await this.syncExternalPatientSurgeries(patientId, dto.surgeries, userId, manager);
        previousImage = imageFile ? await this.findPatientImage(patientId, manager) : null;
        await this.upsertPatientImage(patientId, imageFile, imageBaseUrl, userId, manager);
        if (dto.speciesId !== undefined || dto.birthDate !== undefined) {
          await this.vaccinationPlanService.syncPatientPlanAfterPatientUpdate(
            patientId,
            targetSpeciesId,
            updateData.birthDate !== undefined
              ? (updateData.birthDate ?? null)
              : (existingPatient.birthDate ?? null),
            manager,
          );
        }

        return this.findOneInternal(patientId, 0, manager, roles);
      });

      await this.deleteMediaPhysicalFile(previousImage);
      return result;
    } catch (error) {
      await this.deleteStoredFileIfExists(imageFile?.filename);
      throw error;
    }
  }

  async findSearchSummary(query: ListPatientTutorQueryDto, roles: string[]): Promise<ListPatientTutorResponseDto[]> {
    if (!this.canAccessAnyPatient(roles)) {
      throw new NotFoundException('No tienes permiso para acceder a esta información');
    }
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (!search) {
      return [];
    }

    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 20);

    const queryBuilder = this.patientRepo
      .createQueryBuilder('p')
      .innerJoin('patient_tutors', 'pt', 'pt.patient_id = p.id AND pt.deleted_at IS NULL')
      .innerJoin('clients', 'c', 'c.id = pt.client_id AND c.deleted_at IS NULL')
      .innerJoin('persons', 'per', 'per.id = c.person_id')
      .select('p.id', 'patientId')
      .addSelect('p.name', 'patientName')
      .addSelect('c.id', 'tutorId')
      .addSelect("TRIM(CONCAT(per.first_name, ' ', per.last_name))", 'tutorName')
      .addSelect('per.document_id', 'documentId')
      .where('p.deleted_at IS NULL')

    queryBuilder.andWhere(
      `(
        p.name ILIKE :search
        OR per.first_name ILIKE :search
        OR per.last_name ILIKE :search
        OR CONCAT(per.first_name, ' ', per.last_name) ILIKE :search
        OR CONCAT(per.last_name, ' ', per.first_name) ILIKE :search
        OR per.document_id ILIKE :search
      )`,
      { search: `%${search}%` },
    );

    queryBuilder.orderBy('p.name', 'ASC').addOrderBy('per.first_name', 'ASC').addOrderBy('per.last_name', 'ASC').take(limit);

    return queryBuilder.getRawMany<ListPatientTutorResponseDto>();
  }

  private async findPatientImage(
    patientId: number,
    manager?: EntityManager,
  ): Promise<MediaFile | null> {
    const repo = manager ? manager.getRepository(MediaFile) : this.mediaFileRepo;

    return repo.findOne({
      where: {
        ownerType: MediaOwnerTypeEnum.PACIENTE,
        ownerId: patientId,
        mediaType: MediaTypeEnum.IMAGEN,
        isActive: true,
      },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  private async findImagesByPatientIds(patientIds: number[]): Promise<Map<number, MediaFile>> {
    const imagesByPatientId = new Map<number, MediaFile>();

    if (patientIds.length === 0) {
      return imagesByPatientId;
    }

    const images = await this.mediaFileRepo
      .createQueryBuilder('media')
      .where('media.owner_type = :ownerType', { ownerType: MediaOwnerTypeEnum.PACIENTE })
      .andWhere('media.media_type = :mediaType', { mediaType: MediaTypeEnum.IMAGEN })
      .andWhere('media.is_active = true')
      .andWhere('media.owner_id IN (:...patientIds)', { patientIds })
      .andWhere('media.deleted_at IS NULL')
      .orderBy('media.owner_id', 'ASC')
      .addOrderBy('media.created_at', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .getMany();

    for (const image of images) {
      if (!imagesByPatientId.has(image.ownerId)) {
        imagesByPatientId.set(image.ownerId, image);
      }
    }

    return imagesByPatientId;
  }

  private async upsertPatientImage(
    patientId: number,
    imageFile: any,
    imageBaseUrl: string | undefined,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!imageFile) {
      return;
    }

    const mediaRepo = manager.getRepository(MediaFile);

    await mediaRepo.update(
      {
        ownerType: MediaOwnerTypeEnum.PACIENTE,
        ownerId: patientId,
        mediaType: MediaTypeEnum.IMAGEN,
        isActive: true,
      },
      {
        isActive: false,
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    );

    const mediaFile = mediaRepo.create({
      ownerType: MediaOwnerTypeEnum.PACIENTE,
      ownerId: patientId,
      mediaType: MediaTypeEnum.IMAGEN,
      provider: StorageProviderEnum.LOCAL,
      url: this.buildPatientImageUrl(imageBaseUrl, imageFile.filename),
      storageKey: `uploads/patients/${imageFile.filename}`,
      originalName: imageFile.originalname,
      mimeType: imageFile.mimetype ?? null,
      sizeBytes: imageFile.size ?? null,
      width: null,
      height: null,
      metadata: {},
      createdByUserId: userId,
    });

    await mediaRepo.save(mediaFile);
  }

  async findClinicalHistory(patientId: number, roles: string[]): Promise<PatientClinicalHistoryResponse> {
    const patient = await this.findAdminBasic(patientId, roles);

    const toDateStr = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      return d instanceof Date ? d.toISOString() : String(d);
    };

    const encounterRepo = this.dataSource.getRepository(Encounter);
    const encounters = await encounterRepo.find({
      where: { patientId, deletedAt: IsNull() },
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
        'vet',
        'vet.person',
      ],
      order: { startTime: 'DESC' },
    });

    const planRepo = this.dataSource.getRepository(PatientVaccinationPlan);
    const plan = await planRepo.findOne({
      where: { patientId, deletedAt: IsNull() },
      relations: [
        'schemeVersion',
        'schemeVersion.scheme',
        'doses',
        'doses.vaccine',
      ],
      order: { assignedAt: 'DESC' },
    });

    return {
      patient,
      encounters: encounters.map((enc) => ({
        id: enc.id,
        startTime: toDateStr(enc.startTime)!,
        endTime: enc.endTime ? toDateStr(enc.endTime) : null,
        status: enc.status,
        generalNotes: enc.generalNotes ?? null,
        vetName: enc.vet?.person
          ? `${enc.vet.person.firstName} ${enc.vet.person.lastName}`.trim()
          : null,
        consultationReason: enc.consultationReason
          ? EncounterMapper.toConsultationReasonDto(enc.consultationReason)
          : null,
        anamnesis: enc.anamnesis ? EncounterMapper.toAnamnesisDto(enc.anamnesis) : null,
        clinicalExam: enc.clinicalExam ? EncounterMapper.toClinicalExamDto(enc.clinicalExam) : null,
        environmentalData: enc.environmentalData
          ? EncounterMapper.toEnvironmentalDataDto(enc.environmentalData)
          : null,
        clinicalImpression: enc.clinicalImpression
          ? EncounterMapper.toClinicalImpressionDto(enc.clinicalImpression)
          : null,
        plan: enc.plan ? EncounterMapper.toPlanDto(enc.plan) : null,
        vaccinationEvents: (enc.vaccinationEvents ?? []).map((v) =>
          EncounterMapper.toVaccinationEventDto(v),
        ),
        dewormingEvents: (enc.dewormingEvents ?? []).map((d) =>
          EncounterMapper.toDewormingEventDto(d),
        ),
        treatments: (enc.treatments ?? []).map((t) => EncounterMapper.toTreatmentDto(t)),
        surgeries: (enc.surgeries ?? []).map((s) => EncounterMapper.toSurgeryDto(s)),
        procedures: (enc.procedures ?? []).map((p) => EncounterMapper.toProcedureDto(p)),
      })),
      vaccinationPlan: plan
        ? {
            status: plan.status,
            schemeName: plan.schemeVersion?.scheme?.name ?? 'Esquema desconocido',
            schemeVersion: plan.schemeVersion?.version ?? 0,
            notes: plan.notes ?? null,
            doses: (plan.doses ?? [])
              .sort((a, b) => a.doseOrder - b.doseOrder)
              .map((dose) => ({
                doseOrder: dose.doseOrder,
                vaccineName: dose.vaccine?.name ?? null,
                status: dose.status,
                expectedDate: dose.expectedDate ? toDateStr(dose.expectedDate) : null,
                appliedAt: dose.appliedAt ? toDateStr(dose.appliedAt) : null,
              })),
          }
        : null,
    };
  }

  private buildPatientImageUrl(imageBaseUrl: string | undefined, fileName: string): string {
    const baseUrl = imageBaseUrl?.replace(/\/+$/, '') || '/assets/uploads/patients';
    return `${baseUrl}/${fileName}`;
  }

  private async deleteMediaPhysicalFile(image: MediaFile | null): Promise<void> {
    if (!image?.storageKey) {
      return;
    }

    if (!image.storageKey.startsWith('uploads/patients/')) {
      return;
    }

    const fileName = image.storageKey.replace('uploads/patients/', '');
    await this.deleteStoredFileIfExists(fileName);
  }

  private async deleteStoredFileIfExists(fileName?: string): Promise<void> {
    if (!fileName) {
      return;
    }

    try {
      await unlink(join(PATIENT_UPLOADS_DIR, fileName));
    } catch {
      return;
    }
  }

}
