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
import { randomUUID } from 'node:crypto';

import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Breed } from '../../../domain/entities/catalogs/breed.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { CreatePatientDto } from '../../../presentation/dto/patients/create-patient.dto.js';
import { UpdatePatientDto } from '../../../presentation/dto/patients/update-patient.dto.js';
import { CreateConditionDto } from '../../../presentation/dto/patients/create-condition.dto.js';
import { AddPatientTutorDto } from '../../../presentation/dto/patients/add-patient-tutor.dto.js';
import { InitializePatientVaccinationPlanDto } from '../../../presentation/dto/patients/initialize-patient-vaccination-plan.dto.js';
import {
  UpdatePatientVaccinationSchemeDto,
} from '../../../presentation/dto/patients/update-patient-vaccination-scheme.dto.js';
import { PatientResponseDto, PatientConditionResponseDto } from '../../../presentation/dto/patients/patient-response.dto.js';
import {
  PatientAdminBasicDetailResponse,
  PatientAdminBasicResponse,
  PatientActiveTreatmentResponse,
  PatientBasicByClientResponse,
  PaginatedPatientsBasicForAdminResponse,
  PatientTreatmentHistoryResponse,
  PatientProcedureHistoryResponse,
  PatientRecentActivityResponse,
  PatientRecentConsultationActivityResponse,
  PatientRecentProcedureActivityResponse,
  PatientRecentSurgeryActivityResponse,
  PatientSurgeryResponseDto,
} from '../../../presentation/dto/patients/patient-basic-response.dto.js';
import { PatientVaccinationPlanResponseDto } from '../../../presentation/dto/vaccinations/vaccination-response.dto.js';
import { PatientMapper } from '../../mappers/patient.mapper.js';
import {
  MediaOwnerTypeEnum,
  MediaTypeEnum,
  RoleEnum,
  StorageProviderEnum,
} from '../../../domain/enums/index.js';
import { ListPatientTutorQueryDto } from 'src/presentation/dto/patients/list-patient-tutor-query.dto.js';
import { ListPatientTutorResponseDto } from 'src/presentation/dto/patients/list-patient-tutor-response.dto.js';
import { PATIENT_UPLOADS_DIR } from '../../../infra/config/uploads.config.js';
import { VaccinationPlanService } from '../vaccinations/vaccination-plan.service.js';
import { ClinicalCasesService } from '../clinical-cases/clinical-cases.service.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { EncounterMapper } from '../../mappers/encounter.mapper.js';
import { PatientClinicalHistoryResponse } from '../../../presentation/dto/patients/patient-clinical-history-response.dto.js';
import { TreatmentStatusEnum } from '../../../domain/enums/index.js';

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
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
    private readonly dataSource: DataSource,
    private readonly vaccinationPlanService: VaccinationPlanService,
    private readonly clinicalCasesService: ClinicalCasesService,
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
          qrToken: randomUUID(),
        });
        const saved = await manager.save(Patient, patient);

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
          qrToken: randomUUID(),
        });
        const saved = await manager.save(Patient, patient);

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
          'tutors',
          'tutors.client',
          'tutors.client.person',
        ],
      });

      if (!patient || patient.deletedAt) throw new NotFoundException('Mascota no encontrada');

      patient.conditions = patient.conditions?.filter((c) => !c.deletedAt) ?? [];
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
    const recentActivity = await this.buildActivity(patientId);
    const procedures = await this.buildProcedureHistory(patientId);
    const surgeries = await this.buildSurgeryHistory(patientId);
    const activeTreatments = await this.buildActiveTreatmentHistory(patientId);
    const treatments = await this.buildTreatmentHistory(patientId);
    const clinicalCases = await this.clinicalCasesService.listByPatient(patientId);
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
      qrToken: patient.qrToken ?? null,
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
      surgeries,
      activeTreatments,
      treatments,
      procedures,
      clinicalCases,
      recentActivity,
    };
  }

  async findClinicalCases(patientId: number, roles: string[]) {
    await this.ensurePatientAccessibleForStaff(patientId, roles);
    return this.clinicalCasesService.listByPatient(patientId);
  }

  async findActivity(
    patientId: number,
    roles: string[],
    from?: string | null,
    to?: string | null,
  ): Promise<PatientRecentActivityResponse> {
    await this.ensurePatientAccessibleForStaff(patientId, roles);
    return this.buildActivity(patientId, from ?? null, to ?? null);
  }

  private async buildActivity(
    patientId: number,
    from?: string | null,
    to?: string | null,
  ): Promise<PatientRecentActivityResponse> {
    const now = new Date();
    const parsedFrom = this.parseActivityBoundary(from, 'start');
    const parsedTo = this.parseActivityBoundary(to, 'end');
    const windowEnd = parsedTo ?? now;
    const windowStart = parsedFrom ?? (() => {
      const fallback = new Date(windowEnd);
      fallback.setMonth(fallback.getMonth() - 1);
      return fallback;
    })();

    if (windowStart.getTime() > windowEnd.getTime()) {
      throw new BadRequestException('La fecha inicial no puede ser mayor que la fecha final.');
    }

    const encounterRepo = this.dataSource.getRepository(Encounter);
    const consultationNumbers = await this.buildPatientConsultationNumberMap(patientId);
    const encounters = await encounterRepo.find({
      where: { patientId, deletedAt: IsNull() },
      relations: [
        'consultationReason',
        'procedures',
        'surgeries',
        'vet',
        'vet.person',
      ],
      order: { startTime: 'DESC', id: 'DESC' },
    });

    const recentEncounters = encounters.filter((encounter) => {
      const start = encounter.startTime instanceof Date
        ? encounter.startTime
        : new Date(encounter.startTime);
      return !Number.isNaN(start.getTime()) && start >= windowStart && start <= windowEnd;
    });

    const consultations: PatientRecentConsultationActivityResponse[] = recentEncounters.map((encounter) => ({
      id: encounter.id,
      patientConsultationNumber: consultationNumbers.get(encounter.id) ?? 0,
      clinicalCaseId: encounter.clinicalCaseId ?? null,
      startTime: encounter.startTime instanceof Date
        ? encounter.startTime.toISOString()
        : String(encounter.startTime),
      status: encounter.status,
      clinicianName: this.buildEncounterClinicianName(encounter),
      consultationReason: encounter.consultationReason?.consultationReason ?? null,
    }));

    const procedures: PatientRecentProcedureActivityResponse[] = recentEncounters
      .flatMap((encounter) =>
        (encounter.procedures ?? [])
          .filter((procedure) => !procedure.deletedAt)
          .map((procedure) => ({
            id: procedure.id,
            encounterId: encounter.id,
            patientConsultationNumber: consultationNumbers.get(encounter.id) ?? 0,
            procedureType: procedure.procedureType,
            performedDate: procedure.performedDate instanceof Date
              ? procedure.performedDate.toISOString()
              : String(procedure.performedDate),
            clinicianName: this.buildEncounterClinicianName(encounter),
          })),
      )
      .sort((left, right) => right.performedDate.localeCompare(left.performedDate));

    const surgeries: PatientRecentSurgeryActivityResponse[] = recentEncounters
      .flatMap((encounter) =>
        (encounter.surgeries ?? [])
          .filter((surgery) => !surgery.deletedAt)
          .map((surgery) => ({
            id: surgery.id,
            encounterId: encounter.id,
            surgeryType: surgery.surgeryType,
            activityDate: surgery.performedDate
              ? (surgery.performedDate instanceof Date
                  ? surgery.performedDate.toISOString()
                  : String(surgery.performedDate))
              : surgery.scheduledDate
                ? (surgery.scheduledDate instanceof Date
                    ? surgery.scheduledDate.toISOString()
                    : String(surgery.scheduledDate))
                : (encounter.startTime instanceof Date
                    ? encounter.startTime.toISOString()
                    : String(encounter.startTime)),
            surgeryStatus: surgery.surgeryStatus,
            clinicianName: this.buildEncounterClinicianName(encounter),
            isExternal: false,
          })),
      )
      .sort((left, right) => right.activityDate.localeCompare(left.activityDate));

    return {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      consultations,
      procedures,
      surgeries,
      recentActivity: null,
    };
  }

  private async buildTreatmentHistory(
    patientId: number,
  ): Promise<PatientTreatmentHistoryResponse[]> {
    const treatmentRepo = this.dataSource.getRepository(Treatment);
    const consultationNumbers = await this.buildPatientConsultationNumberMap(patientId);
    const treatments = await treatmentRepo
      .createQueryBuilder('treatment')
      .innerJoinAndSelect(
        'treatment.encounter',
        'encounter',
        'encounter.patient_id = :patientId AND encounter.deleted_at IS NULL',
        { patientId },
      )
      .leftJoinAndSelect('treatment.items', 'items')
      .leftJoinAndSelect('treatment.clinicalCase', 'clinicalCase')
      .where('treatment.deleted_at IS NULL')
      .orderBy('treatment.start_date', 'DESC')
      .addOrderBy('treatment.id', 'DESC')
      .getMany();

    return treatments.map((treatment) => ({
      id: treatment.id,
      encounterId: treatment.encounterId,
      patientConsultationNumber: consultationNumbers.get(treatment.encounterId) ?? 0,
      clinicalCaseId: treatment.clinicalCaseId ?? null,
      clinicalCaseProblem: treatment.clinicalCase?.problemSummary?.trim() || null,
      status: treatment.status,
      summary: this.buildTreatmentSummary(treatment),
      startDate:
        treatment.startDate instanceof Date
          ? treatment.startDate.toISOString()
          : String(treatment.startDate),
      endDate: treatment.endDate
        ? treatment.endDate instanceof Date
          ? treatment.endDate.toISOString()
          : String(treatment.endDate)
        : null,
      generalInstructions: treatment.generalInstructions ?? null,
    }));
  }

  private async buildProcedureHistory(patientId: number): Promise<PatientProcedureHistoryResponse[]> {
    const encounterRepo = this.dataSource.getRepository(Encounter);
    const consultationNumbers = await this.buildPatientConsultationNumberMap(patientId);
    const encounters = await encounterRepo.find({
      where: { patientId, deletedAt: IsNull() },
      relations: ['procedures', 'vet', 'vet.person'],
      order: { startTime: 'DESC', id: 'DESC' },
    });

    return encounters
      .flatMap((encounter) =>
        (encounter.procedures ?? [])
          .filter((procedure) => !procedure.deletedAt)
          .map((procedure) => ({
            id: procedure.id,
            encounterId: encounter.id,
            patientConsultationNumber: consultationNumbers.get(encounter.id) ?? 0,
            procedureType: procedure.procedureType,
            performedDate: procedure.performedDate instanceof Date
              ? procedure.performedDate.toISOString()
              : String(procedure.performedDate),
            clinicianName: this.buildEncounterClinicianName(encounter),
            description: procedure.description ?? null,
            result: procedure.result ?? null,
            notes: procedure.notes ?? null,
          })),
      )
      .sort((left, right) => right.performedDate.localeCompare(left.performedDate));
  }

  private async buildActiveTreatmentHistory(
    patientId: number,
  ): Promise<PatientActiveTreatmentResponse[]> {
    const treatmentRepo = this.dataSource.getRepository(Treatment);
    const treatments = await treatmentRepo
      .createQueryBuilder('treatment')
      .innerJoinAndSelect(
        'treatment.encounter',
        'encounter',
        'encounter.patient_id = :patientId AND encounter.deleted_at IS NULL',
        { patientId },
      )
      .leftJoinAndSelect('treatment.items', 'items')
      .leftJoinAndSelect('treatment.clinicalCase', 'clinicalCase')
      .where('treatment.deleted_at IS NULL')
      .andWhere('treatment.status = :status', { status: TreatmentStatusEnum.ACTIVO })
      .orderBy('treatment.start_date', 'DESC')
      .addOrderBy('treatment.id', 'DESC')
      .getMany();

    return treatments.map((treatment) => ({
      id: treatment.id,
      encounterId: treatment.encounterId,
      clinicalCaseId: treatment.clinicalCaseId ?? null,
      clinicalCaseProblem: treatment.clinicalCase?.problemSummary?.trim() || null,
      status: treatment.status,
      summary: this.buildTreatmentSummary(treatment),
      startDate:
        treatment.startDate instanceof Date
          ? treatment.startDate.toISOString()
          : String(treatment.startDate),
      endDate: treatment.endDate
        ? treatment.endDate instanceof Date
          ? treatment.endDate.toISOString()
          : String(treatment.endDate)
        : null,
      generalInstructions: treatment.generalInstructions ?? null,
    }));
  }

  private async buildSurgeryHistory(patientId: number): Promise<PatientSurgeryResponseDto[]> {
    const encounterRepo = this.dataSource.getRepository(Encounter);
    const encounters = await encounterRepo.find({
      where: { patientId, deletedAt: IsNull() },
      relations: ['surgeries'],
      order: { startTime: 'DESC', id: 'DESC' },
    });

    return encounters
      .flatMap((encounter) =>
        (encounter.surgeries ?? [])
          .filter((surgery) => !surgery.deletedAt)
          .map((surgery) => ({
            id: surgery.id,
            encounterId: encounter.id,
            catalogId: surgery.catalogId ?? null,
            surgeryType: surgery.surgeryType,
            scheduledDate: surgery.scheduledDate
              ? (surgery.scheduledDate instanceof Date
                  ? surgery.scheduledDate.toISOString()
                  : String(surgery.scheduledDate))
              : null,
            performedDate: surgery.performedDate
              ? (surgery.performedDate instanceof Date
                  ? surgery.performedDate.toISOString()
                  : String(surgery.performedDate))
              : null,
            surgeryStatus: surgery.surgeryStatus,
            isExternal: false,
            description: surgery.description ?? null,
            postoperativeInstructions: surgery.postoperativeInstructions ?? null,
          })),
      )
      .sort((left, right) =>
        (right.performedDate ?? right.scheduledDate ?? '').localeCompare(
          left.performedDate ?? left.scheduledDate ?? '',
        ),
      );
  }

  private async buildPatientConsultationNumberMap(patientId: number): Promise<Map<number, number>> {
    const encounterRepo = this.dataSource.getRepository(Encounter);
    const encounters = await encounterRepo.find({
      where: { patientId, deletedAt: IsNull() },
      select: {
        id: true,
        startTime: true,
      },
      order: { startTime: 'ASC', id: 'ASC' },
    });

    return new Map(encounters.map((encounter, index) => [encounter.id, index + 1]));
  }

  private buildEncounterClinicianName(encounter: Encounter): string | null {
    const firstName = encounter.vet?.person?.firstName?.trim() ?? '';
    const lastName = encounter.vet?.person?.lastName?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || null;
  }

  private parseActivityBoundary(
    value: string | null | undefined,
    mode: 'start' | 'end',
  ): Date | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    const candidate = new Date(trimmed.length <= 10
      ? `${trimmed}${mode === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
      : trimmed);

    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException(`La fecha ${mode === 'start' ? 'inicial' : 'final'} no es válida.`);
    }

    return candidate;
  }

  private buildTreatmentSummary(treatment: Treatment): string {
    const medicationNames = (treatment.items ?? [])
      .filter((item) => !item.deletedAt)
      .map((item) => item.medication?.trim())
      .filter((value): value is string => Boolean(value));

    if (medicationNames.length === 1) {
      return medicationNames[0];
    }

    if (medicationNames.length > 1) {
      return `${medicationNames[0]} + ${medicationNames.length - 1} más`;
    }

    return treatment.generalInstructions?.trim() || `Tratamiento #${treatment.id}`;
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
