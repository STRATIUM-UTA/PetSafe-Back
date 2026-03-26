import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { Paginate, type PaginateQuery } from 'nestjs-paginate';

import { PatientsService } from '../../../application/services/patients/patients.service.js';
import { CreatePatientDto } from '../../dto/patients/create-patient.dto.js';
import { UpdatePatientDto } from '../../dto/patients/update-patient.dto.js';
import { CreateConditionDto } from '../../dto/patients/create-condition.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Post()
  create(
    @Body() dto: CreatePatientDto,
    @Request() req: { user: { userId: number; roles: string[] } },
  ) {
    return this.patientsService.create(dto, req.user.userId, req.user.roles);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get()
  findAll(
    @Paginate() query: PaginateQuery,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.findAllByUser(query, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.findOne(id, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.update(id, dto, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.softDelete(id, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Post(':id/conditions')
  addCondition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateConditionDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.addCondition(id, dto, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Delete(':id/conditions/:conditionId')
  removeCondition(
    @Param('id', ParseIntPipe) id: number,
    @Param('conditionId', ParseIntPipe) conditionId: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.patientsService.removeCondition(id, conditionId, req.user.userId);
  }
}
