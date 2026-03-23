import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, PaginateQuery, PaginateConfig } from 'nestjs-paginate';

import { ColorCatalogo } from '../../entities/catalogos/color-catalogo.entity.js';
import { CreateColorDto } from '../../dto/colores/create-color.dto.js';
import { UpdateColorDto } from '../../dto/colores/update-color.dto.js';

const PAGINATE_CONFIG: PaginateConfig<ColorCatalogo> = {
  sortableColumns: ['id', 'nombre', 'createdAt'],
  defaultSortBy: [['nombre', 'ASC']],
  searchableColumns: ['nombre'],
  maxLimit: 50,
  defaultLimit: 20,
};

@Injectable()
export class ColoresService {
  constructor(
    @InjectRepository(ColorCatalogo)
    private readonly repo: Repository<ColorCatalogo>,
  ) {}

  async findAll(query: PaginateQuery) {
    return paginate(query, this.repo, PAGINATE_CONFIG);
  }

  async findOne(id: string) {
    const color = await this.repo.findOne({ where: { id } });
    if (!color) throw new NotFoundException('Color no encontrado');
    return color;
  }

  async create(dto: CreateColorDto) {
    const exists = await this.repo.findOne({ where: { nombre: dto.nombre } });
    if (exists) throw new ConflictException('El color ya existe');

    const entity = this.repo.create({ nombre: dto.nombre });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateColorDto) {
    const color = await this.repo.findOne({ where: { id } });
    if (!color) throw new NotFoundException('Color no encontrado');

    if (dto.nombre !== undefined) color.nombre = dto.nombre;
    return this.repo.save(color);
  }

  async remove(id: string) {
    const color = await this.repo.findOne({ where: { id } });
    if (!color) throw new NotFoundException('Color no encontrado');
    await this.repo.softDelete(id);
    return { message: 'Color eliminado correctamente' };
  }
}
