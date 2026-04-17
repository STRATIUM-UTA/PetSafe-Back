import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import {
  TreatmentsService,
} from '../../../application/services/treatments/treatments.service.js';
import { ListTreatmentsQueryDto } from '../../dto/treatments/list-treatments-query.dto.js';
import {
  CreateTreatmentItemResponse,
  PaginatedTreatmentsBasicResponse,
  TreatmentDetailItemResponse,
  TreatmentDetailResponse,
  UpdateTreatmentResponse,
} from '../../dto/treatments/treatment-response.dto.js';
import { CreateTreatmentItemDto } from '../../dto/encounters/create-treatment.dto.js';
import { UpdateTreatmentDto } from '../../dto/treatments/update-treatment.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) { }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('basic')
  findAllBasic(@Query() query: ListTreatmentsQueryDto): Promise<PaginatedTreatmentsBasicResponse> {
    return this.treatmentsService.findAllBasic(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TreatmentDetailResponse> {
    return this.treatmentsService.findOne(id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTreatmentDto,
  ): Promise<UpdateTreatmentResponse> {
    return this.treatmentsService.update(id, dto);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ)
  @Post(':id/items')
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTreatmentItemDto,
  ): Promise<CreateTreatmentItemResponse> {
    return this.treatmentsService.addItem(id, dto);
  }
}
