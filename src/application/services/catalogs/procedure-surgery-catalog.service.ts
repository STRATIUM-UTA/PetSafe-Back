import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProcedureCatalog } from '../../../domain/entities/catalogs/procedure-catalog.entity.js';
import { SurgeryCatalog } from '../../../domain/entities/catalogs/surgery-catalog.entity.js';

import { CreateProcedureCatalogDto } from '../../../presentation/dto/catalogs/create-procedure-catalog.dto.js';
import { UpdateProcedureCatalogDto } from '../../../presentation/dto/catalogs/update-procedure-catalog.dto.js';
import { ProcedureCatalogResponseDto } from '../../../presentation/dto/catalogs/procedure-catalog-response.dto.js';

import { CreateSurgeryCatalogDto } from '../../../presentation/dto/catalogs/create-surgery-catalog.dto.js';
import { UpdateSurgeryCatalogDto } from '../../../presentation/dto/catalogs/update-surgery-catalog.dto.js';
import { SurgeryCatalogResponseDto } from '../../../presentation/dto/catalogs/surgery-catalog-response.dto.js';

@Injectable()
export class ProcedureSurgeryCatalogService {
  constructor(
    @InjectRepository(ProcedureCatalog)
    private readonly procedureCatalogRepo: Repository<ProcedureCatalog>,
    @InjectRepository(SurgeryCatalog)
    private readonly surgeryCatalogRepo: Repository<SurgeryCatalog>,
  ) { }

  // ── PROCEDURES CATALOG ──────────────────────────────────────────────────
  async createProcedureItem(
    userId: number,
    dto: CreateProcedureCatalogDto,
  ): Promise<ProcedureCatalogResponseDto> {
    const name = this.normalizeName(dto.name, 'procedimiento');
    await this.checkProcedureNameConflict(name);

    const item = this.procedureCatalogRepo.create({
      name,
      description: this.normalizeDescription(dto.description),
    });
    const saved = await this.procedureCatalogRepo.save(item);
    return new ProcedureCatalogResponseDto(saved);
  }

  async findAllProcedures(includeInactive = false): Promise<ProcedureCatalogResponseDto[]> {
    const query = this.procedureCatalogRepo.createQueryBuilder('p').orderBy('p.name', 'ASC');
    if (!includeInactive) {
      query.andWhere('p.isActive = :isActive', { isActive: true });
    }
    const items = await query.getMany();
    return items.map((i) => new ProcedureCatalogResponseDto(i));
  }

  async findProcedureById(id: number): Promise<ProcedureCatalogResponseDto> {
    const item = await this.getProcedureOrFail(id);
    return new ProcedureCatalogResponseDto(item);
  }

  async updateProcedureItem(
    id: number,
    userId: number,
    dto: UpdateProcedureCatalogDto,
  ): Promise<ProcedureCatalogResponseDto> {
    const item = await this.getProcedureOrFail(id);

    if (dto.name !== undefined) {
      const normalizedName = this.normalizeName(dto.name, 'procedimiento');
      if (normalizedName !== item.name) {
        await this.checkProcedureNameConflict(normalizedName, id);
      }
      item.name = normalizedName;
    }

    if (dto.description !== undefined) {
      item.description = this.normalizeDescription(dto.description);
    }

    if (dto.isActive !== undefined) {
      item.isActive = dto.isActive;
    }

    const updated = await this.procedureCatalogRepo.save(item);
    return new ProcedureCatalogResponseDto(updated);
  }

  async deactivateProcedureItem(id: number): Promise<ProcedureCatalogResponseDto> {
    return this.setProcedureActiveStatus(id, false);
  }

  async reactivateProcedureItem(id: number): Promise<ProcedureCatalogResponseDto> {
    return this.setProcedureActiveStatus(id, true);
  }

  async softDeleteProcedureItem(id: number, userId: number): Promise<void> {
    const item = await this.getProcedureOrFail(id);
    item.deletedAt = new Date();
    item.deletedByUserId = userId;
    item.isActive = false;
    await this.procedureCatalogRepo.save(item);
  }

  // ── SURGERIES CATALOG ───────────────────────────────────────────────────
  async createSurgeryItem(
    userId: number,
    dto: CreateSurgeryCatalogDto,
  ): Promise<SurgeryCatalogResponseDto> {
    const name = this.normalizeName(dto.name, 'cirugía');
    await this.checkSurgeryNameConflict(name);

    const item = this.surgeryCatalogRepo.create({
      name,
      description: this.normalizeDescription(dto.description),
      requiresAnesthesia: dto.requiresAnesthesia ?? false,
    });
    const saved = await this.surgeryCatalogRepo.save(item);
    return new SurgeryCatalogResponseDto(saved);
  }

  async findAllSurgeries(includeInactive = false): Promise<SurgeryCatalogResponseDto[]> {
    const query = this.surgeryCatalogRepo.createQueryBuilder('s').orderBy('s.name', 'ASC');
    if (!includeInactive) {
      query.andWhere('s.isActive = :isActive', { isActive: true });
    }
    const items = await query.getMany();
    return items.map((i) => new SurgeryCatalogResponseDto(i));
  }

  async findSurgeryById(id: number): Promise<SurgeryCatalogResponseDto> {
    const item = await this.getSurgeryOrFail(id);
    return new SurgeryCatalogResponseDto(item);
  }

  async updateSurgeryItem(
    id: number,
    userId: number,
    dto: UpdateSurgeryCatalogDto,
  ): Promise<SurgeryCatalogResponseDto> {
    const item = await this.getSurgeryOrFail(id);

    if (dto.name !== undefined) {
      const normalizedName = this.normalizeName(dto.name, 'cirugía');
      if (normalizedName !== item.name) {
        await this.checkSurgeryNameConflict(normalizedName, id);
      }
      item.name = normalizedName;
    }

    if (dto.description !== undefined) {
      item.description = this.normalizeDescription(dto.description);
    }

    if (dto.requiresAnesthesia !== undefined) {
      item.requiresAnesthesia = dto.requiresAnesthesia;
    }

    if (dto.isActive !== undefined) {
      item.isActive = dto.isActive;
    }

    const updated = await this.surgeryCatalogRepo.save(item);
    return new SurgeryCatalogResponseDto(updated);
  }

  async deactivateSurgeryItem(id: number): Promise<SurgeryCatalogResponseDto> {
    return this.setSurgeryActiveStatus(id, false);
  }

  async reactivateSurgeryItem(id: number): Promise<SurgeryCatalogResponseDto> {
    return this.setSurgeryActiveStatus(id, true);
  }

  async softDeleteSurgeryItem(id: number, userId: number): Promise<void> {
    const item = await this.getSurgeryOrFail(id);
    item.deletedAt = new Date();
    item.deletedByUserId = userId;
    item.isActive = false;
    await this.surgeryCatalogRepo.save(item);
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────
  private async getProcedureOrFail(id: number): Promise<ProcedureCatalog> {
    const item = await this.procedureCatalogRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Elemento del catálogo de procedimientos no encontrado');
    return item;
  }

  private async getSurgeryOrFail(id: number): Promise<SurgeryCatalog> {
    const item = await this.surgeryCatalogRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Elemento del catálogo de cirugías no encontrado');
    return item;
  }

  private async setProcedureActiveStatus(
    id: number,
    isActive: boolean,
  ): Promise<ProcedureCatalogResponseDto> {
    const item = await this.getProcedureOrFail(id);
    item.isActive = isActive;
    const updated = await this.procedureCatalogRepo.save(item);
    return new ProcedureCatalogResponseDto(updated);
  }

  private async setSurgeryActiveStatus(
    id: number,
    isActive: boolean,
  ): Promise<SurgeryCatalogResponseDto> {
    const item = await this.getSurgeryOrFail(id);
    item.isActive = isActive;
    const updated = await this.surgeryCatalogRepo.save(item);
    return new SurgeryCatalogResponseDto(updated);
  }

  private normalizeName(value: string, label: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new BadRequestException(`El nombre de ${label} no puede quedar vacío.`);
    }
    return normalized;
  }

  private normalizeDescription(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async checkProcedureNameConflict(name: string, ignoreId?: number): Promise<void> {
    const existing = await this.procedureCatalogRepo
      .createQueryBuilder('procedure')
      .withDeleted()
      .where('LOWER(TRIM(procedure.name)) = LOWER(TRIM(:name))', { name })
      .getOne();

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Ya existe un procedimiento con el nombre "${name}"`);
    }
  }

  private async checkSurgeryNameConflict(name: string, ignoreId?: number): Promise<void> {
    const existing = await this.surgeryCatalogRepo
      .createQueryBuilder('surgery')
      .withDeleted()
      .where('LOWER(TRIM(surgery.name)) = LOWER(TRIM(:name))', { name })
      .getOne();

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Ya existe una cirugía con el nombre "${name}"`);
    }
  }
}
