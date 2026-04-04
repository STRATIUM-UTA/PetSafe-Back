import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from '../../../application/services/reports/reports.service.js';
import { ReportAppointmentsQueryDto } from '../../dto/reports/report-query.dto.js';
import { AgendaReportItemDto } from '../../dto/reports/agenda-report-item.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Devuelve una agenda operativa combinada de citas y cola.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('schedule')
  async schedule(
    @Query() query: ReportAppointmentsQueryDto,
  ): Promise<AgendaReportItemDto[]> {
    return this.reportsService.listAgenda(query.from, query.to);
  }

  /**
   * GET /reports/schedule/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Descarga una agenda operativa combinada de citas y cola.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('schedule/pdf')
  async schedulePdf(
    @Query() query: ReportAppointmentsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportsService.generateAgendaPdf(query.from, query.to);
    const filename = `agenda-operativa-${query.from}-a-${query.to}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /reports/patients/:patientId/clinical-history/pdf
   * Descarga el historial clinico consolidado del paciente.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('patients/:patientId/clinical-history/pdf')
  async clinicalHistoryPdf(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportsService.generateClinicalHistoryPdf(patientId);
    const filename = `historial-clinico-paciente-${patientId}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
