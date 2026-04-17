import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  type PaginateConfig,
  type PaginateQuery,
  type Paginated,
} from 'nestjs-paginate';

import { AdoptionTag } from '../../../domain/entities/adoptions/adoption-tag.entity.js';
import { AdoptionTagBasicResponse } from '../../../presentation/dto/adoptions/adoption-tag-basic-response.dto.js';
import { CreateAdoptionTagDto } from '../../../presentation/dto/adoptions/create-adoption-tag.dto.js';
import { UpdateAdoptionTagDto } from '../../../presentation/dto/adoptions/update-adoption-tag.dto.js';
import { AdoptionTagResponseDto } from '../../../presentation/dto/adoptions/adoption-tag-response.dto.js';
import { ListAdoptionTagSearchQueryDto } from '../../../presentation/dto/adoptions/list-adoption-tag-search-query.dto.js';

const PAGINATE_CONFIG: PaginateConfig<AdoptionTag> = {
  sortableColumns: ['id', 'name', 'createdAt'],
  defaultSortBy: [['name', 'ASC']],
  searchableColumns: ['name'],
  maxLimit: 50,
  defaultLimit: 20,
};

@Injectable()
export class AdoptionTagsService {
  constructor(
    @InjectRepository(AdoptionTag)
    private readonly repo: Repository<AdoptionTag>,
  ) {}

  async findAll(query: PaginateQuery): Promise<Paginated<any>> {
    const result = await paginate(query, this.repo, PAGINATE_CONFIG);
    return {
      ...result,
      data: result.data.map((tag) => this.toResponseDto(tag)),
    };
  }

  async findOne(id: number): Promise<AdoptionTagResponseDto> {
    const tag = await this.repo.findOne({ where: { id } });
    if (!tag || tag.deletedAt) throw new NotFoundException('Tag de adopcion no encontrado');
    return this.toResponseDto(tag);
  }

  async findSearchSummary(
    query: ListAdoptionTagSearchQueryDto,
  ): Promise<AdoptionTagBasicResponse[]> {
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (!search) {
      return [];
    }

    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 20);

    const tags = await this.repo
      .createQueryBuilder('tag')
      .where('tag.deleted_at IS NULL')
      .andWhere('tag.is_active = true')
      .andWhere('tag.name ILIKE :search', { search: `%${search}%` })
      .orderBy('tag.name', 'ASC')
      .take(limit)
      .getMany();

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
    }));
  }

  async create(dto: CreateAdoptionTagDto): Promise<AdoptionTagResponseDto> {
    const normalizedName = this.normalizeTagName(dto.name);
    const existing = await this.repo.findOne({ where: { name: normalizedName } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('El tag de adopcion ya existe');
    }

    const saved = await this.repo.save(
      this.repo.create({
        name: normalizedName,
      }),
    );
    return this.toResponseDto(saved);
  }

  async update(id: number, dto: UpdateAdoptionTagDto): Promise<AdoptionTagResponseDto> {
    const tag = await this.repo.findOne({ where: { id } });
    if (!tag || tag.deletedAt) throw new NotFoundException('Tag de adopcion no encontrado');

    if (dto.name !== undefined) {
      const nextName = this.normalizeTagName(dto.name);
      const existing = await this.repo.findOne({ where: { name: nextName } });
      if (existing && existing.id !== id && !existing.deletedAt) {
        throw new ConflictException('El tag de adopcion ya existe');
      }
      tag.name = nextName;
    }

    const saved = await this.repo.save(tag);
    return this.toResponseDto(saved);
  }

  async remove(id: number): Promise<{ message: string }> {
    const tag = await this.repo.findOne({ where: { id } });
    if (!tag || tag.deletedAt) throw new NotFoundException('Tag de adopcion no encontrado');

    await this.repo.softDelete(id);
    return { message: 'Tag de adopcion eliminado correctamente' };
  }

  private toResponseDto(tag: AdoptionTag): AdoptionTagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  private normalizeTagName(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\b\p{L}/gu, (char) => char.toUpperCase());
  }
}
