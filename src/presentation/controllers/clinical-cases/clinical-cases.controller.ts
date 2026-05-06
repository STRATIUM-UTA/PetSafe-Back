import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  UseGuards,
  Post,
  Request,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';
import { ClinicalCasesService } from '../../../application/services/clinical-cases/clinical-cases.service.js';
import { UpdateClinicalCaseStatusDto } from '../../dto/clinical-cases/update-clinical-case-status.dto.js';
import { ScheduleControlAppointmentDto } from '../../dto/encounters/schedule-control-appointment.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinical-cases')
export class ClinicalCasesController {
  constructor(private readonly clinicalCasesService: ClinicalCasesService) {}

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clinicalCasesService.findOne(id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id/follow-ups')
  findFollowUps(@Param('id', ParseIntPipe) id: number) {
    return this.clinicalCasesService.findFollowUps(id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ)
  @Post(':id/follow-ups')
  scheduleFollowUp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ScheduleControlAppointmentDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.clinicalCasesService.scheduleFollowUpForCase(id, dto, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClinicalCaseStatusDto,
  ) {
    return this.clinicalCasesService.updateStatus(id, dto.status);
  }
}
