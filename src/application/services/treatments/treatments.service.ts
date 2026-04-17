import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Treatment } from '../../../domain/entities/encounters/treatment.entity.js';
import { TreatmentItem } from '../../../domain/entities/encounters/treatment-item.entity.js';
import { TreatmentStatusEnum } from '../../../domain/enums/index.js';
import { ListTreatmentsQueryDto } from '../../../presentation/dto/treatments/list-treatments-query.dto.js';
import { CreateTreatmentItemDto } from '../../../presentation/dto/encounters/create-treatment.dto.js';
import { UpdateTreatmentDto } from '../../../presentation/dto/treatments/update-treatment.dto.js';
import {
  CreateTreatmentItemResponse,
  PaginatedTreatmentsBasicResponse,
  TreatmentDetailItemResponse,
  TreatmentDetailResponse,
  UpdateTreatmentResponse,
} from '../../../presentation/dto/treatments/treatment-response.dto.js';

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(TreatmentItem)
    private readonly treatmentItemRepo: Repository<TreatmentItem>,
  ) { }

  async findAllBasic(query: ListTreatmentsQueryDto): Promise<PaginatedTreatmentsBasicResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.treatmentRepo
      .createQueryBuilder('treatment')
      .innerJoinAndSelect('treatment.encounter', 'encounter')
      .innerJoinAndSelect('encounter.patient', 'patient')
      .where('treatment.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('LOWER(patient.name) LIKE LOWER(:search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      qb.andWhere('treatment.status = :status', { status: query.status });
    }

    qb.orderBy('treatment.startDate', 'DESC').addOrderBy('treatment.id', 'DESC');

    const [treatments, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: treatments.map((t) => ({
        id: t.id,
        status: t.status,
        startDate: this.formatDate(t.startDate),
        endDate: t.endDate ? this.formatDate(t.endDate) : null,
        generalInstructions: t.generalInstructions,
        patientName: t.encounter.patient.name,
        encounterId: t.encounterId,
      })),
      meta: {
        totalItems: total,
        itemCount: treatments.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<TreatmentDetailResponse> {
    const treatment = await this.treatmentRepo
      .createQueryBuilder('treatment')
      .innerJoinAndSelect('treatment.encounter', 'encounter')
      .innerJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('treatment.items', 'items')
      .where('treatment.deletedAt IS NULL')
      .andWhere('treatment.id = :id', { id })
      .orderBy('items.id', 'ASC')
      .getOne();

    if (!treatment) {
      throw new NotFoundException('Tratamiento no encontrado.');
    }

    return {
      id: treatment.id,
      status: treatment.status,
      startDate: this.formatDate(treatment.startDate),
      endDate: treatment.endDate ? this.formatDate(treatment.endDate) : null,
      generalInstructions: treatment.generalInstructions,
      patientId: treatment.encounter.patient.id,
      patientName: treatment.encounter.patient.name,
      encounterId: treatment.encounterId,
      items: (treatment.items ?? []).map((item) => ({
        id: item.id,
        medication: item.medication,
        dose: item.dose,
        frequency: item.frequency,
        durationDays: item.durationDays,
        administrationRoute: item.administrationRoute,
        notes: item.notes,
        status: item.status,
      })),
    };
  }

  async update(id: number, dto: UpdateTreatmentDto): Promise<UpdateTreatmentResponse> {
    const treatment = await this.treatmentRepo.findOne({
      where: { id, deletedAt: null as any },
    });

    if (!treatment) {
      throw new NotFoundException('Tratamiento no encontrado.');
    }

    if (treatment.status !== TreatmentStatusEnum.ACTIVO) {
      throw new BadRequestException(
        `No se puede editar un tratamiento en estado "${treatment.status}".`,
      );
    }

    if (dto.endDate !== undefined) {
      const newEndDate = this.normalizeDate(new Date(dto.endDate));
      const startDate = this.normalizeDate(new Date(treatment.startDate));

      if (newEndDate < startDate) {
        throw new BadRequestException(
          'La fecha de fin no puede ser anterior a la fecha de inicio del tratamiento.',
        );
      }
    }

    if (dto.endDate !== undefined) {
      treatment.endDate = new Date(dto.endDate);
    }
    if (dto.generalInstructions !== undefined) {
      treatment.generalInstructions = dto.generalInstructions;
    }

    await this.treatmentRepo.save(treatment);

    return {
      id: treatment.id,
      endDate: treatment.endDate ? this.formatDate(treatment.endDate) : null,
      generalInstructions: treatment.generalInstructions,
    }
  }

  async addItem(treatmentId: number, dto: CreateTreatmentItemDto): Promise<CreateTreatmentItemResponse> {
    const treatment = await this.treatmentRepo.findOne({
      where: { id: treatmentId, deletedAt: null as any },
    });

    if (!treatment) {
      throw new NotFoundException('Tratamiento no encontrado.');
    }

    if (treatment.status !== TreatmentStatusEnum.ACTIVO) {
      throw new BadRequestException(
        `No se pueden agregar ítems a un tratamiento en estado "${treatment.status}".`,
      );
    }

    if (treatment.endDate) {
      const today = this.normalizeDate(new Date());
      const itemEndDate = new Date(today);
      itemEndDate.setDate(itemEndDate.getDate() + dto.durationDays);
      const endDate = this.normalizeDate(new Date(treatment.endDate));

      if (itemEndDate > endDate) {
        throw new BadRequestException(
          `La duración del ítem (${dto.durationDays} días desde hoy) excede la fecha de fin del tratamiento (${this.formatDate(treatment.endDate)}).`,
        );
      }
    }

    const item = this.treatmentItemRepo.create({
      treatmentId,
      medication: dto.medication,
      dose: dto.dose,
      frequency: dto.frequency,
      durationDays: dto.durationDays,
      administrationRoute: dto.administrationRoute,
      notes: dto.notes ?? null,
    });

    const saved = await this.treatmentItemRepo.save(item);

    return {
      id: saved.id,
      medication: saved.medication,
      dose: saved.dose,
      frequency: saved.frequency,
      durationDays: saved.durationDays,
      administrationRoute: saved.administrationRoute,
      notes: saved.notes,
      status: saved.status,
    };
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDate(date: Date | string): string {
    if (date instanceof Date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(date).substring(0, 10);
  }
}
