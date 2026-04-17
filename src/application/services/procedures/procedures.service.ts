import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { ListProceduresQueryDto } from '../../../presentation/dto/procedures/list-procedures-query.dto.js';
import { PaginatedProceduresBasicResponse } from '../../../presentation/dto/procedures/procedure-basic-response.dto.js';
import { ProcedureDetailResponse } from '../../../presentation/dto/procedures/procedure-detail-response.dto.js';

@Injectable()
export class ProceduresService {
  constructor(
    @InjectRepository(Procedure)
    private readonly procedureRepo: Repository<Procedure>,
  ) {}

  async findAllBasic(query: ListProceduresQueryDto): Promise<PaginatedProceduresBasicResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.procedureRepo
      .createQueryBuilder('procedure')
      .innerJoinAndSelect('procedure.encounter', 'encounter')
      .innerJoinAndSelect('encounter.patient', 'patient')
      .where('procedure.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('LOWER(patient.name) LIKE LOWER(:search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('procedure.performedDate', 'DESC').addOrderBy('procedure.id', 'DESC');

    const [procedures, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: procedures.map((p) => ({
        id: p.id,
        procedureType: p.procedureType,
        performedDate: p.performedDate.toISOString(),
        patientName: p.encounter.patient.name,
        encounterId: p.encounterId,
      })),
      meta: {
        totalItems: total,
        itemCount: procedures.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<ProcedureDetailResponse> {
    const procedure = await this.procedureRepo
      .createQueryBuilder('procedure')
      .innerJoinAndSelect('procedure.encounter', 'encounter')
      .innerJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('procedure.catalog', 'catalog')
      .where('procedure.deletedAt IS NULL')
      .andWhere('procedure.id = :id', { id })
      .getOne();

    if (!procedure) {
      throw new NotFoundException('Procedimiento no encontrado.');
    }

    return {
      id: procedure.id,
      procedureType: procedure.procedureType,
      performedDate: procedure.performedDate.toISOString(),
      description: procedure.description,
      result: procedure.result,
      notes: procedure.notes,
      catalog: procedure.catalog
        ? { id: procedure.catalog.id, name: procedure.catalog.name }
        : null,
      patientId: procedure.encounter.patient.id,
      patientName: procedure.encounter.patient.name,
      encounterId: procedure.encounterId,
    };
  }
}
