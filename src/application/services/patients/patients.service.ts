import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig, Paginated } from 'nestjs-paginate';

import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Species } from '../../../domain/entities/catalogs/species.entity.js';
import { Breed } from '../../../domain/entities/catalogs/breed.entity.js';
import { CreatePatientDto } from '../../../presentation/dto/patients/create-patient.dto.js';
import { UpdatePatientDto } from '../../../presentation/dto/patients/update-patient.dto.js';
import { CreateConditionDto } from '../../../presentation/dto/patients/create-condition.dto.js';
import { PatientResponseDto, PatientConditionResponseDto } from '../../../presentation/dto/patients/patient-response.dto.js';
import {
  PatientAdminBasicDetailResponse,
  PatientAdminBasicResponse,
  PatientBasicByClientResponse,
  PaginatedPatientsBasicForAdminResponse,
} from '../../../presentation/dto/patients/patient-basic-response.dto.js';
import { PatientMapper } from '../../mappers/patient.mapper.js';
import { RoleEnum } from '../../../domain/enums/index.js';
import { ListPatientTutorQueryDto } from 'src/presentation/dto/patients/list-patient-tutor-query.dto.js';
import { ListPatientTutorResponseDto } from 'src/presentation/dto/patients/list-patient-tutor-response.dto.js';

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
    private readonly dataSource: DataSource,
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

  async create(dto: CreatePatientDto, userId: number, roles: string[]): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
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

      const tutor = manager.create(PatientTutor, {
        patientId: saved.id,
        clientId: clientId,
        isPrimary: true,
        relationship: 'Propietario',
      });
      await manager.save(PatientTutor, tutor);

      return this.findOneInternal(saved.id, userId, manager, roles);
    });
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
    return {
      ...result,
      data: result.data.map(PatientMapper.toResponseDto),
    };
  }

  async findOne(patientId: number, userId: number): Promise<PatientResponseDto> {
    return this.findOneInternal(patientId, userId);
  }

  async update(patientId: number, dto: UpdatePatientDto, userId: number): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
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

      return this.findOneInternal(patientId, userId, manager);
    });
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

  private async findOneInternal(patientId: number, userId: number, manager?: EntityManager, roles: string[] = []): Promise<PatientResponseDto> {
    const repo = manager ? manager.getRepository(Patient) : this.patientRepo;

    if (this.canAccessAnyPatient(roles)) {
      const patient = await repo.findOne({
        where: { id: patientId },
        relations: ['species', 'breed', 'color', 'conditions'],
      });

      if (!patient || patient.deletedAt) throw new NotFoundException('Mascota no encontrada');

      patient.conditions = patient.conditions?.filter((c) => !c.deletedAt) ?? [];
      return PatientMapper.toResponseDto(patient);
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
      .where('p.id = :patientId', { patientId })
      .andWhere('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!patient) throw new NotFoundException('Mascota no encontrada');

    return PatientMapper.toResponseDto(patient);
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
      clinicalObservations: patient.conditions ?? [],
      recentActivity: null,
    };
  }

  async updateAdminBasic(patientId: number, dto: UpdatePatientDto, roles: string[]): Promise<PatientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
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

      return this.findOneInternal(patientId, 0, manager, roles);
    });
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

}
