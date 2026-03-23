import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig } from 'nestjs-paginate';

import { EspecieCatalogo } from '../../entities/catalogos/especie-catalogo.entity.js';
import { CreateEspecieDto } from '../../dto/especies/create-especie.dto.js';
import { UpdateEspecieDto } from '../../dto/especies/update-especie.dto.js';

const PAGINATE_CONFIG: PaginateConfig<EspecieCatalogo> = {
  sortableColumns: ['id', 'nombre', 'createdAt'],
  defaultSortBy: [['nombre', 'ASC']],
  searchableColumns: ['nombre'],
  maxLimit: 50,
  defaultLimit: 20,
};

@Injectable()
export class EspeciesService {
  constructor(
    @InjectRepository(EspecieCatalogo)
    private readonly repo: Repository<EspecieCatalogo>,
  ) {}

  async findAll(query: PaginateQuery) {
    return paginate(query, this.repo, PAGINATE_CONFIG);
  }

  async findOne(id: string) {
    const especie = await this.repo.findOne({
      where: { id },
      relations: ['razas'],
    });
    if (!especie) throw new NotFoundException('Especie no encontrada');
    return especie;
  }

  async create(dto: CreateEspecieDto) {
    const exists = await this.repo.findOne({ where: { nombre: dto.nombre } });
    if (exists) throw new ConflictException('La especie ya existe');

    const entity = this.repo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateEspecieDto) {
    const especie = await this.repo.findOne({ where: { id } });
    if (!especie) throw new NotFoundException('Especie no encontrada');

    if (dto.nombre !== undefined) especie.nombre = dto.nombre;
    if (dto.descripcion !== undefined) especie.descripcion = dto.descripcion ?? null;

    return this.repo.save(especie);
  }

  async remove(id: string) {
    const especie = await this.repo.findOne({ where: { id } });
    if (!especie) throw new NotFoundException('Especie no encontrada');
    await this.repo.softDelete(id);
    return { message: 'Especie eliminada correctamente' };
  }
}
