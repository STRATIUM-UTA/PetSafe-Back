import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Cliente } from '../../entities/personas/cliente.entity.js';
import { Persona } from '../../entities/personas/persona.entity.js';
import { Usuario } from '../../entities/auth/usuario.entity.js';
import { UsuarioRol } from '../../entities/auth/usuario-rol.entity.js';
import { PacienteTutor } from '../../entities/pacientes/paciente-tutor.entity.js';
import { Paciente } from '../../entities/pacientes/paciente.entity.js';
import { PersonTypeEnum } from '../../common/enums/index.js';
import { CreateClienteDto } from '../../dto/clientes/create-cliente.dto.js';
import { UpdateClienteDto } from '../../dto/clientes/update-cliente.dto.js';
import { ListClientesQueryDto } from '../../dto/clientes/list-clientes-query.dto.js';
import { UpdateMyClienteDto } from '../../dto/clientes/update-my-cliente.dto.js';
import { RoleEnum } from '../../common/enums/index.js';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepo: Repository<UsuarioRol>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClienteDto) {
    return this.dataSource.transaction(async (manager) => {
      const persona = manager.create(Persona, {
        tipoPersona: PersonTypeEnum.CLIENTE,
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        cedula: dto.cedula ?? null,
        telefono: dto.telefono ?? null,
        direccion: dto.direccion ?? null,
        genero: dto.genero ?? null,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null,
      });
      const savedPersona = await manager.save(Persona, persona);

      const cliente = manager.create(Cliente, {
        personaId: savedPersona.id,
        observaciones: dto.observaciones ?? null,
      });
      const savedCliente = await manager.save(Cliente, cliente);

      const created = await this.findOneInternal(savedCliente.id, manager);
      return this.toResponse(created, null);
    });
  }

  async findAll(query: ListClientesQueryDto, actorUserId: string) {
    const roleNames = await this.getUserRoleNames(actorUserId);
    const canManageAll = this.canManageAllClientes(roleNames);

    const page = query.page ?? 1;
    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;

    const qb = this.clienteRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.persona', 'p')
      .leftJoin(Usuario, 'u', 'u.persona_id = p.id AND u.deleted_at IS NULL')
      .where('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL');

    // Ownership restriction for CLIENTE_APP (or any non-admin role)
    if (!canManageAll) {
      qb.andWhere('u.id = :actorUserId', { actorUserId });
    }

    // Filters
    if (query.nombres) {
      qb.andWhere(
        '(p.nombres ILIKE :nombres OR p.apellidos ILIKE :nombres)',
        { nombres: `%${query.nombres}%` },
      );
    }

    if (query.cedula) {
      qb.andWhere('p.cedula ILIKE :cedula', { cedula: `%${query.cedula}%` });
    }

    if (query.correo) {
      qb.andWhere('u.correo ILIKE :correo', { correo: `%${query.correo}%` });
    }

    if (query.mascotaNombre) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(PacienteTutor, 'pt')
          .innerJoin(
            Paciente,
            'pa',
            'pa.id = pt.paciente_id AND pa.deleted_at IS NULL',
          )
          .where('pt.cliente_id = c.id')
          .andWhere('pt.deleted_at IS NULL')
          .andWhere('pa.nombre ILIKE :mascotaNombre')
          .getQuery();

        return `EXISTS ${subQuery}`;
      });

      qb.setParameter('mascotaNombre', `%${query.mascotaNombre}%`);
    }

    qb.orderBy('p.apellidos', 'ASC').addOrderBy('p.nombres', 'ASC');

    // Count
    const total = await qb.clone().getCount();

    // Page data
    qb.addSelect('u.correo', 'correo');
    const { entities, raw } = await qb
      .skip(offset)
      .take(limit)
      .getRawAndEntities();

    const data = entities.map((c, idx) =>
      this.toResponse(c, (raw[idx] as any)?.correo ?? null),
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

  async findOne(id: string, actorUserId: string) {
    const roleNames = await this.getUserRoleNames(actorUserId);
    const canManageAll = this.canManageAllClientes(roleNames);

    if (!canManageAll) {
      const myClienteId = await this.getClienteIdByUserId(actorUserId);
      if (myClienteId !== id) {
        throw new ForbiddenException(
          'Solo puede consultar su propia información de cliente',
        );
      }
    }

    const qb = this.clienteRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.persona', 'p')
      .leftJoin(Usuario, 'u', 'u.persona_id = p.id AND u.deleted_at IS NULL')
      .addSelect('u.correo', 'correo')
      .where('c.id = :id', { id })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL');

    const { entities, raw } = await qb.take(1).getRawAndEntities();
    const cliente = entities[0];
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.toResponse(cliente, (raw[0] as any)?.correo ?? null);
  }

  async update(id: string, dto: UpdateClienteDto) {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await this.findOneInternal(id, manager);

      if (dto.observaciones !== undefined) {
        cliente.observaciones = dto.observaciones;
      }
      if (dto.activo !== undefined) {
        cliente.activo = dto.activo;
      }

      const persona = cliente.persona;
      if (dto.nombres !== undefined) persona.nombres = dto.nombres;
      if (dto.apellidos !== undefined) persona.apellidos = dto.apellidos;
      if (dto.cedula !== undefined) persona.cedula = dto.cedula;
      if (dto.telefono !== undefined) persona.telefono = dto.telefono;
      if (dto.direccion !== undefined) persona.direccion = dto.direccion;
      if (dto.genero !== undefined) persona.genero = dto.genero;
      if (dto.fechaNacimiento !== undefined) {
        persona.fechaNacimiento = dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null;
      }

      await manager.save(Persona, persona);
      await manager.save(Cliente, cliente);

      const updated = await this.findOneInternal(id, manager);
      const correo = await this.getCorreoByPersonaId(updated.personaId, manager);
      return this.toResponse(updated, correo);
    });
  }

  async getMyProfile(actorUserId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: actorUserId },
      relations: ['persona'],
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const cliente = await this.clienteRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.persona', 'p')
      .where('c.persona_id = :personaId', { personaId: usuario.personaId })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.toResponse(cliente, usuario.correo);
  }

  async updateMyProfile(actorUserId: string, dto: UpdateMyClienteDto) {
    return this.dataSource.transaction(async (manager) => {
      const usuario = await manager.findOne(Usuario, {
        where: { id: actorUserId },
        relations: ['persona'],
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const cliente = await manager
        .createQueryBuilder(Cliente, 'c')
        .innerJoinAndSelect('c.persona', 'p')
        .where('c.persona_id = :personaId', { personaId: usuario.personaId })
        .andWhere('c.deleted_at IS NULL')
        .andWhere('p.deleted_at IS NULL')
        .getOne();

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      // Update usuario
      if (dto.correo !== undefined) {
        usuario.correo = dto.correo;
      }

      // Update persona
      const persona = usuario.persona;
      if (dto.nombres !== undefined) persona.nombres = dto.nombres;
      if (dto.apellidos !== undefined) persona.apellidos = dto.apellidos;
      if (dto.cedula !== undefined) persona.cedula = dto.cedula;
      if (dto.telefono !== undefined) persona.telefono = dto.telefono;
      if (dto.direccion !== undefined) persona.direccion = dto.direccion;
      if (dto.genero !== undefined) persona.genero = dto.genero;
      if (dto.fechaNacimiento !== undefined) {
        persona.fechaNacimiento = dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null;
      }

      await manager.save(Persona, persona);
      await manager.save(Usuario, usuario);

      const refreshed = await manager
        .createQueryBuilder(Cliente, 'c')
        .innerJoinAndSelect('c.persona', 'p')
        .where('c.id = :id', { id: cliente.id })
        .andWhere('c.deleted_at IS NULL')
        .andWhere('p.deleted_at IS NULL')
        .getOne();

      if (!refreshed) {
        throw new NotFoundException('Cliente no encontrado');
      }

      return this.toResponse(refreshed, usuario.correo);
    });
  }

  async remove(id: string, actorUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await this.findOneInternal(id, manager);
      const now = new Date();

      // Soft-delete cliente
      cliente.activo = false;
      cliente.deletedAt = now;
      cliente.deletedByUsuarioId = actorUserId;
      await manager.save(Cliente, cliente);

      // Soft-delete persona too (keeps DB consistent for list queries)
      const persona = cliente.persona;
      persona.activo = false;
      persona.deletedAt = now;
      persona.deletedByUsuarioId = actorUserId;
      await manager.save(Persona, persona);

      return { ok: true };
    });
  }

  private async findOneInternal(id: string, manager?: EntityManager) {
    const repo: Repository<Cliente> = manager
      ? manager.getRepository(Cliente)
      : this.clienteRepo;

    const cliente = await repo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.persona', 'p')
      .where('c.id = :id', { id })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async getUserRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.usuarioRolRepo.find({
      where: { usuarioId: userId },
      relations: ['rol'],
    });
    return userRoles.map((ur) => ur.rol.nombre);
  }

  private async getClienteIdByUserId(userId: string): Promise<string> {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const cliente = await this.clienteRepo.findOne({
      where: { personaId: usuario.personaId },
    });

    if (!cliente || cliente.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente.id;
  }

  private async getCorreoByPersonaId(
    personaId: string,
    manager?: EntityManager,
  ): Promise<string | null> {
    const repo: Repository<Usuario> = manager
      ? manager.getRepository(Usuario)
      : this.usuarioRepo;

    const usuario = await repo.findOne({
      where: { personaId },
    });

    return usuario?.correo ?? null;
  }

  private canManageAllClientes(roleNames: string[]) {
    // Any privileged role → can see/manage all customers
    const privileged: string[] = [
      RoleEnum.ADMIN,
      RoleEnum.MVZ,
      RoleEnum.RECEPCIONISTA,
    ];
    return roleNames.some((r) => privileged.includes(r));
  }

  private toResponse(c: Cliente, correo?: string | null) {
    return {
      id: c.id,
      activo: c.activo,
      observaciones: c.observaciones,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      correo: correo ?? null,
      persona: {
        id: c.persona.id,
        tipoPersona: c.persona.tipoPersona,
        nombres: c.persona.nombres,
        apellidos: c.persona.apellidos,
        cedula: c.persona.cedula,
        telefono: c.persona.telefono,
        direccion: c.persona.direccion,
        genero: c.persona.genero,
        fechaNacimiento: c.persona.fechaNacimiento,
      },
    };
  }
}
