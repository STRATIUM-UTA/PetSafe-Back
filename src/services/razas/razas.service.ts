import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig, FilterOperator } from 'nestjs-paginate';

import { RazaCatalogo } from '../../entities/catalogos/raza-catalogo.entity.js';
import { EspecieCatalogo } from '../../entities/catalogos/especie-catalogo.entity.js';
import { CreateRazaDto } from '../../dto/razas/create-raza.dto.js';
import { UpdateRazaDto } from '../../dto/razas/update-raza.dto.js';

const PAGINATE_CONFIG: PaginateConfig<RazaCatalogo> = {
  sortableColumns: ['id', 'nombre', 'createdAt'],
  defaultSortBy: [['nombre', 'ASC']],
  searchableColumns: ['nombre'],
  filterableColumns: {
    especieId: [FilterOperator.EQ],
  },
  relations: ['especie'],
  maxLimit: 100,
  defaultLimit: 50,
};

@Injectable()
export class RazasService {
  constructor(
    @InjectRepository(RazaCatalogo)
    private readonly repo: Repository<RazaCatalogo>,
    @InjectRepository(EspecieCatalogo)
    private readonly especieRepo: Repository<EspecieCatalogo>,
  ) {}

  async findAll(query: PaginateQuery) {
    return paginate(query, this.repo, PAGINATE_CONFIG);
  }

  async findOne(id: string) {
    const raza = await this.repo.findOne({
      where: { id },
      relations: ['especie'],
    });
    if (!raza) throw new NotFoundException('Raza no encontrada');
    return raza;
  }

  async create(dto: CreateRazaDto) {
    const especie = await this.especieRepo.findOne({ where: { id: dto.especieId } });
    if (!especie) throw new NotFoundException('Especie no encontrada');

    const exists = await this.repo.findOne({
      where: { nombre: dto.nombre, especieId: dto.especieId },
    });
    if (exists) throw new ConflictException('La raza ya existe para esta especie');

    const entity = this.repo.create({
      especieId: dto.especieId,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateRazaDto) {
    const raza = await this.repo.findOne({ where: { id } });
    if (!raza) throw new NotFoundException('Raza no encontrada');

    if (dto.especieId !== undefined) {
      const especie = await this.especieRepo.findOne({ where: { id: dto.especieId } });
      if (!especie) throw new NotFoundException('Especie no encontrada');
      raza.especieId = dto.especieId;
    }
    if (dto.nombre !== undefined) raza.nombre = dto.nombre;
    if (dto.descripcion !== undefined) raza.descripcion = dto.descripcion ?? null;

    return this.repo.save(raza);
  }

  async remove(id: string) {
    const raza = await this.repo.findOne({ where: { id } });
    if (!raza) throw new NotFoundException('Raza no encontrada');
    await this.repo.softDelete(id);
    return { message: 'Raza eliminada correctamente' };
  }
}
