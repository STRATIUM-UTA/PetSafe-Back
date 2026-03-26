import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Person } from '../../../domain/entities/persons/person.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PersonTypeEnum, RoleEnum } from '../../../domain/enums/index.js';
import { CreateClientDto } from '../../../presentation/dto/clients/create-client.dto.js';
import { UpdateClientDto } from '../../../presentation/dto/clients/update-client.dto.js';
import { ListClientsQueryDto } from '../../../presentation/dto/clients/list-clients-query.dto.js';
import { ClientResponseDto, PaginatedClientsResponseDto } from '../../../presentation/dto/clients/client-response.dto.js';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(PatientTutor)
    private readonly patientTutorRepository: Repository<PatientTutor>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const person = manager.create(Person, {
        personType: PersonTypeEnum.CLIENTE,
        firstName: dto.firstName,
        lastName: dto.lastName,
        documentId: dto.documentId ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        gender: dto.gender ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      });
      const savedPerson = await manager.save(Person, person);

      const client = manager.create(Client, {
        personId: savedPerson.id,
        notes: dto.notes ?? null,
      });
      const savedClient = await manager.save(Client, client);

      const created = await this.findOneInternal(savedClient.id, manager);
      return this.toResponse(created, null);
    });
  }

  async findAll(query: ListClientsQueryDto, actorUserId: number): Promise<PaginatedClientsResponseDto> {
    const roleNames = await this.getUserRoleNames(actorUserId);
    const canManageAll = this.canManageAllClients(roleNames);

    const page = query.page ?? 1;
    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;

    const qb = this.clientRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.person', 'p')
      .leftJoin(User, 'u', 'u.person_id = p.id AND u.deleted_at IS NULL')
      .where('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL');

    if (!canManageAll) {
      qb.andWhere('u.id = :actorUserId', { actorUserId });
    }

    if (query.firstName) {
      qb.andWhere('(p.first_name ILIKE :firstName OR p.last_name ILIKE :firstName)', {
        firstName: `%${query.firstName}%`,
      });
    }

    if (query.documentId) {
      qb.andWhere('p.document_id ILIKE :documentId', {
        documentId: `%${query.documentId}%`,
      });
    }

    if (query.email) {
      qb.andWhere('u.email ILIKE :email', { email: `%${query.email}%` });
    }

    if (query.petName) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(PatientTutor, 'pt')
          .innerJoin(Patient, 'pa', 'pa.id = pt.patient_id AND pa.deleted_at IS NULL')
          .where('pt.client_id = c.id')
          .andWhere('pt.deleted_at IS NULL')
          .andWhere('pa.name ILIKE :petName')
          .getQuery();
        return `EXISTS ${subQuery}`;
      });
      qb.setParameter('petName', `%${query.petName}%`);
    }

    qb.orderBy('p.lastName', 'ASC').addOrderBy('p.firstName', 'ASC');

    const total = await qb.clone().getCount();

    qb.addSelect('u.email', 'email');
    const { entities, raw } = await qb.skip(offset).take(limit).getRawAndEntities();

    const data = entities.map((c, idx) =>
      this.toResponse(c, (raw[idx] as any)?.email ?? null),
    );

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

  async findOne(id: number, actorUserId: number): Promise<ClientResponseDto> {
    const roleNames = await this.getUserRoleNames(actorUserId);
    const canManageAll = this.canManageAllClients(roleNames);

    if (!canManageAll) {
      const myClientId = await this.getClientIdByUserId(actorUserId);
      if (myClientId !== id) {
        throw new ForbiddenException('Solo puedes consultar tu propia información de cliente');
      }
    }

    const qb = this.clientRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.person', 'p')
      .leftJoin(User, 'u', 'u.person_id = p.id AND u.deleted_at IS NULL')
      .addSelect('u.email', 'email')
      .where('c.id = :id', { id })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL');

    const { entities, raw } = await qb.take(1).getRawAndEntities();
    const client = entities[0];
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.toResponse(client, (raw[0] as any)?.email ?? null);
  }

  async update(id: number, dto: UpdateClientDto): Promise<ClientResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const client = await this.findOneInternal(id, manager);

      if (dto.notes !== undefined) {
        client.notes = dto.notes;
      }
      if (dto.active !== undefined) {
        client.isActive = dto.active;
      }

      const person = client.person;
      if (dto.firstName !== undefined) person.firstName = dto.firstName;
      if (dto.lastName !== undefined) person.lastName = dto.lastName;
      if (dto.documentId !== undefined) person.documentId = dto.documentId;
      if (dto.phone !== undefined) person.phone = dto.phone;
      if (dto.address !== undefined) person.address = dto.address;
      if (dto.gender !== undefined) person.gender = dto.gender;
      if (dto.birthDate !== undefined) {
        person.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
      }

      await manager.save(Person, person);
      await manager.save(Client, client);

      const updated = await this.findOneInternal(id, manager);
      const email = await this.getEmailByPersonId(updated.personId, manager);
      return this.toResponse(updated, email);
    });
  }

  async remove(id: number, actorUserId: number) {
    return this.dataSource.transaction(async (manager) => {
      const client = await this.findOneInternal(id, manager);
      const activeTutorCount = await manager.getRepository(PatientTutor).count({
        where: { clientId: id },
      });
      if (activeTutorCount > 0) {
        throw new ForbiddenException(
          'No se puede eliminar el cliente porque tiene mascotas activas asociadas',
        );
      }
      const now = new Date();

      client.isActive = false;
      client.deletedAt = now;
      client.deletedByUserId = actorUserId;
      await manager.save(Client, client);

      const person = client.person;
      person.isActive = false;
      person.deletedAt = now;
      person.deletedByUserId = actorUserId;
      await manager.save(Person, person);

      return { ok: true, message: 'Cliente eliminado correctamente' };
    });
  }

  private async findOneInternal(id: number, manager?: EntityManager) {
    const repo: Repository<Client> = manager ? manager.getRepository(Client) : this.clientRepository;

    const client = await repo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.person', 'p')
      .where('c.id = :id', { id })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  private async getUserRoleNames(userId: number): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId: userId },
      relations: ['role'],
    });
    return userRoles.map((ur) => ur.role.name);
  }

  private async getClientIdByUserId(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const client = await this.clientRepository.findOne({
      where: { personId: user.personId },
    });

    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client.id;
  }

  private async getEmailByPersonId(personId: number, manager?: EntityManager): Promise<string | null> {
    const repo: Repository<User> = manager ? manager.getRepository(User) : this.userRepository;
    const user = await repo.findOne({ where: { personId } });
    return user?.email ?? null;
  }

  private canManageAllClients(roleNames: string[]) {
    const privileged: string[] = [RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA];
    return roleNames.some((r) => privileged.includes(r));
  }

  private toResponse(c: Client, email?: string | null): ClientResponseDto {
    return {
      id: c.id,
      active: c.isActive,
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      email: email ?? null,
      person: {
        id: c.person.id,
        personType: c.person.personType,
        firstName: c.person.firstName,
        lastName: c.person.lastName,
        identification: c.person.documentId,
        phone: c.person.phone,
        address: c.person.address,
        gender: c.person.gender,
        birthDate: c.person.birthDate,
      },
    };
  }
}
