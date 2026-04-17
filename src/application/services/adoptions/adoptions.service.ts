import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Adoption } from '../../../domain/entities/adoptions/adoption.entity.js';
import { AdoptionTag } from '../../../domain/entities/adoptions/adoption-tag.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { AdoptionStatusEnum, MediaOwnerTypeEnum, MediaTypeEnum } from '../../../domain/enums/index.js';

import { PatientsService } from '../patients/patients.service.js';
import { PatientMapper } from '../../mappers/patient.mapper.js';
import { CreateAdoptionDto } from '../../../presentation/dto/adoptions/create-adoption.dto.js';
import { UpdateAdoptionDto } from '../../../presentation/dto/adoptions/update-adoption.dto.js';
import {
  AdoptionBasicResponse,
  PaginatedAdoptionBasicResponse,
} from '../../../presentation/dto/adoptions/adoption-basic-response.dto.js';
import { AdoptionBasicDetailResponse } from '../../../presentation/dto/adoptions/adoption-basic-detail-response.dto.js';
import {
  AdoptionCatalogResponse,
  PaginatedAdoptionCatalogResponse,
} from '../../../presentation/dto/adoptions/adoption-catalog-response.dto.js';
import { ListAdoptionBasicQueryDto } from '../../../presentation/dto/adoptions/list-adoption-basic-query.dto.js';
import { ListAdoptionCatalogQueryDto } from '../../../presentation/dto/adoptions/list-adoption-catalog-query.dto.js';
import { UpdateAdoptionBasicDto } from '../../../presentation/dto/adoptions/update-adoption-basic.dto.js';

@Injectable()
export class AdoptionsService {
  constructor(
    @InjectRepository(Adoption)
    private readonly adoptionsRepo: Repository<Adoption>,
    @InjectRepository(AdoptionTag)
    private readonly adoptionTagsRepo: Repository<AdoptionTag>,
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly patientsService: PatientsService,
  ) {}

  async create(dto: CreateAdoptionDto): Promise<Adoption> {
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId, deletedAt: IsNull() },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');

    const adoption = this.adoptionsRepo.create({
      patientId: dto.patientId,
      story: dto.story,
      requirements: dto.requirements,
      notes: dto.notes,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail ?? null,
      tags: dto.tagIds?.length ? await this.findTagsByIds(dto.tagIds) : [],
    });

    return this.adoptionsRepo.save(adoption);
  }

  async findAll(): Promise<Adoption[]> {
    return this.adoptionsRepo.find({
      where: { deletedAt: IsNull(), isActive: true },
      relations: [
        'patient',
        'patient.species',
        'patient.breed',
        'adopterClient',
        'adopterClient.person',
        'tags',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findCatalog(
    query: ListAdoptionCatalogQueryDto,
  ): Promise<PaginatedAdoptionCatalogResponse> {
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const page = query.page ?? 1;
    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;

    const adoptions = await this.adoptionsRepo.find({
      where: {
        deletedAt: IsNull(),
        isActive: true,
        status: AdoptionStatusEnum.DISPONIBLE,
      },
      relations: ['patient', 'patient.species', 'patient.breed', 'tags'],
      order: { createdAt: 'DESC' },
    });

    const filtered = search
      ? adoptions.filter((adoption) => {
          const terms = [
            adoption.patient?.name,
            adoption.patient?.species?.name,
            adoption.contactPhone,
          ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return terms.some((value) => value.includes(search));
        })
      : adoptions;

    const imagesByPatientId = await this.findImagesByPatientIds(
      filtered.slice(offset, offset + limit).map((adoption) => adoption.patientId),
    );

    const total = filtered.length;
    const data: AdoptionCatalogResponse[] = filtered.slice(offset, offset + limit).map((adoption) => ({
      id: adoption.id,
      patientId: adoption.patientId,
      image: PatientMapper.toImageDto(imagesByPatientId.get(adoption.patientId)),
      petName: adoption.patient.name,
      speciesName: adoption.patient.species?.name ?? null,
      breedName: adoption.patient.breed?.name ?? null,
      contactPhone: adoption.contactPhone ?? null,
      story: adoption.story ?? null,
      tags: (adoption.tags ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
      })),
    }));

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

  async findAllBasic(
    query: ListAdoptionBasicQueryDto,
  ): Promise<PaginatedAdoptionBasicResponse> {
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const page = query.page ?? 1;
    const limitRaw = query.limit ?? 10;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;

    const adoptions = await this.adoptionsRepo.find({
      where: { deletedAt: IsNull(), isActive: true },
      relations: ['patient', 'patient.species', 'patient.breed', 'tags'],
      order: { createdAt: 'DESC' },
    });

    const filtered = search
      ? adoptions.filter((adoption) => {
          const terms = [
            adoption.patient?.name,
            adoption.patient?.species?.name,
            adoption.patient?.breed?.name,
            adoption.notes,
            adoption.status,
            adoption.contactName,
            adoption.contactPhone,
            adoption.contactEmail,
            ...(adoption.tags ?? []).map((tag) => tag.name),
          ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return terms.some((value) => value.includes(search));
        })
      : adoptions;

    const total = filtered.length;
    const data = filtered
      .slice(offset, offset + limit)
      .map((adoption) => this.toBasicResponse(adoption));

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

  async findOne(id: number): Promise<Adoption> {
    const adoption = await this.adoptionsRepo.findOne({
      where: { id, deletedAt: IsNull(), isActive: true },
      relations: [
        'patient',
        'patient.species',
        'patient.breed',
        'adopterClient',
        'adopterClient.person',
        'tags',
      ],
    });
    if (!adoption) throw new NotFoundException('Adopcion no encontrada');
    return adoption;
  }

  async update(id: number, dto: UpdateAdoptionDto): Promise<Adoption> {
    const adoption = await this.findOne(id);

    if (dto.adopterClientId) {
      const client = await this.clientRepo.findOne({
        where: { id: dto.adopterClientId },
      });
      if (!client) throw new NotFoundException('Cliente adoptante no encontrado');
      adoption.adopterClientId = dto.adopterClientId;
    }

    if (dto.status && dto.status !== adoption.status) {
      adoption.status = dto.status;
      if (dto.status === AdoptionStatusEnum.ADOPTADO) {
        adoption.adoptionDate = new Date();
      }
    }

    if (dto.story !== undefined) adoption.story = dto.story;
    if (dto.requirements !== undefined) adoption.requirements = dto.requirements;
    if (dto.notes !== undefined) adoption.notes = dto.notes;
    if (dto.contactName !== undefined) adoption.contactName = dto.contactName ?? null;
    if (dto.contactPhone !== undefined) adoption.contactPhone = dto.contactPhone ?? null;
    if (dto.contactEmail !== undefined) adoption.contactEmail = dto.contactEmail ?? null;
    if (dto.tagIds !== undefined) {
      adoption.tags = dto.tagIds.length ? await this.findTagsByIds(dto.tagIds) : [];
    }

    return this.adoptionsRepo.save(adoption);
  }

  async updateBasic(
    id: number,
    dto: UpdateAdoptionBasicDto,
    userId: number,
    roles: string[],
    imageFile?: any,
    imageBaseUrl?: string,
  ): Promise<AdoptionBasicDetailResponse> {
    const adoption = await this.findOne(id);

    if (dto.story !== undefined) adoption.story = dto.story;
    if (dto.requirements !== undefined) adoption.requirements = dto.requirements;
    if (dto.notes !== undefined) adoption.notes = dto.notes;
    if (dto.contactName !== undefined) adoption.contactName = dto.contactName ?? null;
    if (dto.contactPhone !== undefined) adoption.contactPhone = dto.contactPhone ?? null;
    if (dto.contactEmail !== undefined) adoption.contactEmail = dto.contactEmail ?? null;
    if (dto.tagIds !== undefined) {
      adoption.tags = dto.tagIds.length ? await this.findTagsByIds(dto.tagIds) : [];
    }

    const saved = await this.adoptionsRepo.save(adoption);

    if (imageFile) {
      await this.patientsService.updateAdminBasic(
        saved.patientId,
        {},
        userId,
        roles,
        imageFile,
        imageBaseUrl,
      );
    }

    const patient = await this.patientsService.findAdminBasic(saved.patientId, roles);

    return {
      id: saved.id,
      patientId: saved.patientId,
      story: saved.story ?? null,
      requirements: saved.requirements ?? null,
      notes: saved.notes ?? null,
      contactName: saved.contactName ?? null,
      contactPhone: saved.contactPhone ?? null,
      contactEmail: saved.contactEmail ?? null,
      tags: (saved.tags ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
      })),
      patient: {
        id: patient.id,
        name: patient.name,
        image: patient.image ?? null,
      },
    };
  }

  async remove(id: number): Promise<void> {
    const adoption = await this.findOne(id);
    adoption.deletedAt = new Date();
    adoption.isActive = false;
    await this.adoptionsRepo.save(adoption);
  }

  private calculateAgeYears(birthDate: Date): number {
    const now = new Date();
    let years = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      years -= 1;
    }

    return Math.max(years, 0);
  }

  private toBasicResponse(adoption: Adoption): AdoptionBasicResponse {
    const birthDate = adoption.patient.birthDate ?? null;
    const birthDateValue = birthDate ? new Date(birthDate as any) : null;
    const ageYears =
      birthDateValue && !Number.isNaN(birthDateValue.getTime())
        ? this.calculateAgeYears(birthDateValue)
        : null;

    return {
      id: adoption.id,
      patientId: adoption.patientId,
      patientName: adoption.patient.name,
      speciesName: adoption.patient.species?.name ?? null,
      breedName: adoption.patient.breed?.name ?? null,
      currentWeight: adoption.patient.currentWeight ?? null,
      birthDate,
      ageYears,
      adopterClientId: adoption.adopterClientId ?? null,
      status: adoption.status,
      notes: adoption.notes ?? null,
      contactName: adoption.contactName ?? null,
      contactPhone: adoption.contactPhone ?? null,
      contactEmail: adoption.contactEmail ?? null,
      tags: (adoption.tags ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
      })),
    };
  }

  private async findTagsByIds(tagIds: number[]): Promise<AdoptionTag[]> {
    const uniqueTagIds = Array.from(new Set(tagIds));
    if (uniqueTagIds.length === 0) {
      return [];
    }

    const tags = await this.adoptionTagsRepo.find({
      where: uniqueTagIds.map((id) => ({ id, deletedAt: IsNull(), isActive: true })),
    });

    if (tags.length !== uniqueTagIds.length) {
      throw new NotFoundException('Uno o mas tags de adopcion no existen');
    }

    return uniqueTagIds
      .map((id) => tags.find((tag) => tag.id === id))
      .filter((tag): tag is AdoptionTag => Boolean(tag));
  }

  private async findImagesByPatientIds(patientIds: number[]): Promise<Map<number, MediaFile>> {
    const imagesByPatientId = new Map<number, MediaFile>();

    if (patientIds.length === 0) {
      return imagesByPatientId;
    }

    const uniquePatientIds = Array.from(new Set(patientIds));
    const images = await this.mediaFileRepo
      .createQueryBuilder('media')
      .where('media.owner_type = :ownerType', { ownerType: MediaOwnerTypeEnum.PACIENTE })
      .andWhere('media.media_type = :mediaType', { mediaType: MediaTypeEnum.IMAGEN })
      .andWhere('media.is_active = true')
      .andWhere('media.owner_id IN (:...patientIds)', { patientIds: uniquePatientIds })
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
}
