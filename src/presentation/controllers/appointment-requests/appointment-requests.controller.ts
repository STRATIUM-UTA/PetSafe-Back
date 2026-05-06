import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';
import { AppointmentRequestsService } from '../../../application/services/appointment-requests/appointment-requests.service.js';
import { CreateAppointmentRequestDto } from '../../dto/appointment-requests/create-appointment-request.dto.js';
import { UpdateAppointmentRequestStatusDto } from '../../dto/appointment-requests/update-appointment-request-status.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointment-requests')
export class AppointmentRequestsController {
  constructor(private readonly service: AppointmentRequestsService) {}

  /** Cliente crea solicitud de cita */
  @Roles(RoleEnum.CLIENTE_APP)
  @Post()
  create(
    @Body() dto: CreateAppointmentRequestDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.service.create(dto, req.user.userId);
  }

  /** Cliente ve sus propias solicitudes */
  @Roles(RoleEnum.CLIENTE_APP)
  @Get('my')
  findMine(@Request() req: { user: { userId: number } }) {
    return this.service.findByClient(req.user.userId);
  }

  /** Staff ve todas las solicitudes */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** Staff: count de solicitudes pendientes para badge */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('pending-count')
  async pendingCount(): Promise<{ count: number }> {
    const count = await this.service.countPending();
    return { count };
  }

  /** Staff: verifica disponibilidad de horario antes de confirmar */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('check-availability')
  async checkAvailability(
    @Query('date') date: string,
    @Query('time') time: string,
    @Request() req: { user: { userId: number } },
  ): Promise<{ available: boolean; message?: string }> {
    return this.service.checkAvailability(date, time, req.user.userId);
  }

  /** Staff confirma o rechaza una solicitud */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentRequestStatusDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.service.updateStatus(+id, dto, req.user.userId);
  }
}
