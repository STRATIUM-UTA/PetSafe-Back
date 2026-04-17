import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';

import { ProceduresService } from '../../../application/services/procedures/procedures.service.js';
import { ListProceduresQueryDto } from '../../dto/procedures/list-procedures-query.dto.js';
import { PaginatedProceduresBasicResponse } from '../../dto/procedures/procedure-basic-response.dto.js';
import { ProcedureDetailResponse } from '../../dto/procedures/procedure-detail-response.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('basic')
  findAllBasic(@Query() query: ListProceduresQueryDto): Promise<PaginatedProceduresBasicResponse> {
    return this.proceduresService.findAllBasic(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProcedureDetailResponse> {
    return this.proceduresService.findOne(id);
  }
}
