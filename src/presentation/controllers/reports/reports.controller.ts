import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from '../../../application/services/reports/reports.service.js';
import {
  ReportAppointmentsQueryDto,
  ReportQueueQueryDto,
  ReportSummaryQueryDto,
} from '../../dto/reports/report-query.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/appointments/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Descarga un PDF con todas las citas del período.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('appointments/pdf')
  async appointmentsPdf(
    @Query() query: ReportAppointmentsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportsService.generateAppointmentsPdf(query.from, query.to);
    const filename = `agenda-citas-${query.from}-a-${query.to}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /reports/queue/pdf?date=YYYY-MM-DD
   * Descarga un PDF con la cola de atención del día indicado.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('queue/pdf')
  async queuePdf(
    @Query() query: ReportQueueQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const date = query.date ?? new Date().toISOString().substring(0, 10);
    const buffer = await this.reportsService.generateQueuePdf(date);
    const filename = `cola-atencion-${date}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /reports/summary/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Descarga un PDF con el resumen estadístico del período.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('summary/pdf')
  async summaryPdf(
    @Query() query: ReportSummaryQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportsService.generateSummaryPdf(query.from, query.to);
    const filename = `resumen-estadistico-${query.from}-a-${query.to}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
