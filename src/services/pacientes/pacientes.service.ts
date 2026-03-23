import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig } from 'nestjs-paginate';

import { Paciente } from '../../entities/pacientes/paciente.entity.js';
import { PacienteTutor } from '../../entities/pacientes/paciente-tutor.entity.js';
import { PacienteCondicion } from '../../entities/pacientes/paciente-condicion.entity.js';
import { Cliente } from '../../entities/personas/cliente.entity.js';
import { CreatePacienteDto } from '../../dto/pacientes/create-paciente.dto.js';
import { UpdatePacienteDto } from '../../dto/pacientes/update-paciente.dto.js';
import { CreateCondicionDto } from '../../dto/pacientes/create-condicion.dto.js';

const PAGINATE_CONFIG: PaginateConfig<Paciente> = {
  sortableColumns: ['id', 'nombre', 'codigo', 'createdAt'],
  defaultSortBy: [['nombre', 'ASC']],
  searchableColumns: ['nombre', 'codigo', 'microchipCodigo'],
  relations: ['especie', 'raza', 'color'],
  maxLimit: 50,
  defaultLimit: 20,
};

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente)
    private readonly pacienteRepo: Repository<Paciente>,
    @InjectRepository(PacienteTutor)
    private readonly pacienteTutorRepo: Repository<PacienteTutor>,
    @InjectRepository(PacienteCondicion)
    private readonly condicionRepo: Repository<PacienteCondicion>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Helpers ─────────────────────────────────────────

  /** Resolves the client ID from a user ID (user→persona→cliente) */
  private async resolveClienteId(
    userId: string,
    manager?: any,
  ): Promise<string> {
    const repo = manager
      ? manager.getRepository(Cliente)
      : this.clienteRepo;

    const cliente = await repo
      .createQueryBuilder('c')
      .innerJoin('personas', 'p', 'p.id = c.persona_id')
      .innerJoin('usuarios', 'u', 'u.persona_id = p.id')
      .where('u.id = :userId', { userId })
      .andWhere('c.deleted_at IS NULL')
      .select('c.id')
      .getOne();

    if (!cliente) {
      throw new NotFoundException(
        'No se encontró perfil de cliente para este usuario',
      );
    }
    return cliente.id;
  }

  /** Verifies the user owns the patient, returns the Paciente */
  private async verifyOwnership(
    pacienteId: string,
    userId: string,
    manager?: any,
  ): Promise<Paciente> {
    const repo = manager
      ? manager.getRepository(Paciente)
      : this.pacienteRepo;

    const paciente = await repo
      .createQueryBuilder('p')
      .innerJoin(
        'pacientes_tutores',
        'pt',
        'pt.paciente_id = p.id AND pt.deleted_at IS NULL',
      )
      .innerJoin(
        'clientes',
        'c',
        'c.id = pt.cliente_id AND c.deleted_at IS NULL',
      )
      .innerJoin('personas', 'per', 'per.id = c.persona_id')
      .innerJoin(
        'usuarios',
        'u',
        'u.persona_id = per.id AND u.deleted_at IS NULL',
      )
      .where('p.id = :pacienteId', { pacienteId })
      .andWhere('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return paciente;
  }

  // ── CREATE ──────────────────────────────────────────

  async create(dto: CreatePacienteDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const clienteId = await this.resolveClienteId(userId, manager);

      const paciente = manager.create(Paciente, {
        nombre: dto.nombre,
        especieId: dto.especieId,
        sexo: dto.sexo,
        razaId: dto.razaId ?? null,
        colorId: dto.colorId ?? null,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null,
        pesoActual: dto.pesoActual ?? null,
        esterilizado: dto.esterilizado ?? false,
        microchipCodigo: dto.microchipCodigo ?? null,
        senasParticulares: dto.senasParticulares ?? null,
        alergiasGenerales: dto.alergiasGenerales ?? null,
        antecedentesGenerales: dto.antecedentesGenerales ?? null,
      });
      const saved = await manager.save(Paciente, paciente);

      const tutor = manager.create(PacienteTutor, {
        pacienteId: saved.id,
        clienteId,
        esPrincipal: true,
        parentescoORelacion: 'Dueño',
      });
      await manager.save(PacienteTutor, tutor);

      return this.findOneInternal(saved.id, userId, manager);
    });
  }

  // ── READ ────────────────────────────────────────────

  async findAllByUser(query: PaginateQuery, userId: string) {
    const qb = this.pacienteRepo
      .createQueryBuilder('p')
      .innerJoin(
        'pacientes_tutores',
        'pt',
        'pt.paciente_id = p.id AND pt.deleted_at IS NULL',
      )
      .innerJoin(
        'clientes',
        'c',
        'c.id = pt.cliente_id AND c.deleted_at IS NULL',
      )
      .innerJoin('personas', 'per', 'per.id = c.persona_id')
      .innerJoin(
        'usuarios',
        'u',
        'u.persona_id = per.id AND u.deleted_at IS NULL',
      )
      .leftJoinAndSelect('p.especie', 'especie')
      .leftJoinAndSelect('p.raza', 'raza')
      .leftJoinAndSelect('p.color', 'color')
      .where('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL');

    return paginate(query, qb, PAGINATE_CONFIG);
  }

  async findOne(pacienteId: string, userId: string) {
    return this.findOneInternal(pacienteId, userId);
  }

  // ── UPDATE ──────────────────────────────────────────

  async update(pacienteId: string, dto: UpdatePacienteDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.verifyOwnership(pacienteId, userId, manager);

      const updateData: Partial<Paciente> = {};
      if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
      if (dto.especieId !== undefined) updateData.especieId = dto.especieId;
      if (dto.sexo !== undefined) updateData.sexo = dto.sexo;
      if (dto.razaId !== undefined) updateData.razaId = dto.razaId ?? null;
      if (dto.colorId !== undefined) updateData.colorId = dto.colorId ?? null;
      if (dto.fechaNacimiento !== undefined) {
        updateData.fechaNacimiento = dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null;
      }
      if (dto.pesoActual !== undefined)
        updateData.pesoActual = dto.pesoActual ?? null;
      if (dto.esterilizado !== undefined)
        updateData.esterilizado = dto.esterilizado;
      if (dto.microchipCodigo !== undefined)
        updateData.microchipCodigo = dto.microchipCodigo ?? null;
      if (dto.senasParticulares !== undefined)
        updateData.senasParticulares = dto.senasParticulares ?? null;
      if (dto.alergiasGenerales !== undefined)
        updateData.alergiasGenerales = dto.alergiasGenerales ?? null;
      if (dto.antecedentesGenerales !== undefined)
        updateData.antecedentesGenerales = dto.antecedentesGenerales ?? null;

      await manager.update(Paciente, pacienteId, updateData);

      return this.findOneInternal(pacienteId, userId, manager);
    });
  }

  // ── SOFT DELETE ─────────────────────────────────────

  async softDelete(pacienteId: string, userId: string) {
    await this.verifyOwnership(pacienteId, userId);
    await this.pacienteRepo.softDelete(pacienteId);
    return { message: 'Paciente eliminado correctamente' };
  }

  // ── CONDICIONES ─────────────────────────────────────

  async addCondicion(
    pacienteId: string,
    dto: CreateCondicionDto,
    userId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.verifyOwnership(pacienteId, userId, manager);

      const condicion = manager.create(PacienteCondicion, {
        pacienteId,
        tipo: dto.tipo,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        activa: dto.activa ?? true,
      });
      const saved = await manager.save(PacienteCondicion, condicion);

      return {
        id: saved.id,
        tipo: saved.tipo,
        nombre: saved.nombre,
        descripcion: saved.descripcion,
        activa: saved.activa,
      };
    });
  }

  async removeCondicion(
    pacienteId: string,
    condicionId: string,
    userId: string,
  ) {
    await this.verifyOwnership(pacienteId, userId);

    const condicion = await this.condicionRepo.findOne({
      where: { id: condicionId, pacienteId },
    });
    if (!condicion) {
      throw new NotFoundException('Condición no encontrada');
    }

    await this.condicionRepo.softDelete(condicionId);
    return { message: 'Condición eliminada correctamente' };
  }

  // ── Private ─────────────────────────────────────────

  private async findOneInternal(
    pacienteId: string,
    userId: string,
    manager?: any,
  ) {
    const repo = manager ? manager.getRepository(Paciente) : this.pacienteRepo;

    const paciente = await repo
      .createQueryBuilder('p')
      .innerJoin(
        'pacientes_tutores',
        'pt',
        'pt.paciente_id = p.id AND pt.deleted_at IS NULL',
      )
      .innerJoin(
        'clientes',
        'c',
        'c.id = pt.cliente_id AND c.deleted_at IS NULL',
      )
      .innerJoin('personas', 'per', 'per.id = c.persona_id')
      .innerJoin(
        'usuarios',
        'u',
        'u.persona_id = per.id AND u.deleted_at IS NULL',
      )
      .leftJoinAndSelect('p.especie', 'especie')
      .leftJoinAndSelect('p.raza', 'raza')
      .leftJoinAndSelect('p.color', 'color')
      .leftJoinAndSelect(
        'p.condiciones',
        'condiciones',
        'condiciones.deleted_at IS NULL',
      )
      .where('p.id = :pacienteId', { pacienteId })
      .andWhere('u.id = :userId', { userId })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return this.toResponse(paciente);
  }

  private toResponse(p: Paciente) {
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      sexo: p.sexo,
      fechaNacimiento: p.fechaNacimiento,
      pesoActual: p.pesoActual,
      esterilizado: p.esterilizado,
      microchipCodigo: p.microchipCodigo,
      senasParticulares: p.senasParticulares,
      alergiasGenerales: p.alergiasGenerales,
      antecedentesGenerales: p.antecedentesGenerales,
      especie: p.especie
        ? { id: p.especie.id, nombre: p.especie.nombre }
        : null,
      raza: p.raza ? { id: p.raza.id, nombre: p.raza.nombre } : null,
      color: p.color ? { id: p.color.id, nombre: p.color.nombre } : null,
      condiciones:
        p.condiciones?.map((c) => ({
          id: c.id,
          tipo: c.tipo,
          nombre: c.nombre,
          descripcion: c.descripcion,
          activa: c.activa,
        })) ?? [],
    };
  }
}
