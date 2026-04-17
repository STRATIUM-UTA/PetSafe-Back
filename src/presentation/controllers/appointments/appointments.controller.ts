import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from '../../../application/services/appointments/appointments.service.js';
import { CreateAppointmentDto } from '../../dto/appointments/create-appointment.dto.js';
import { ListAppointmentsQueryDto } from '../../dto/appointments/list-appointments-query.dto.js';
import { AppointmentCalendarItemDto } from '../../dto/appointments/appointment-calendar-item.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * GET /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Devuelve las citas del veterinario autenticado en el rango dado.
   * El front ya sabe cómo agruparlas para semana o mes.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get()
  listByRange(
    @Query() query: ListAppointmentsQueryDto,
    @Request() req: { user: { userId: number } },
  ): Promise<AppointmentCalendarItemDto[]> {
    return this.appointmentsService.listByRange(query, req.user.userId);
  }

  /**
   * POST /appointments
   * Crea una nueva cita. El front envía { patientId, scheduledDate, scheduledTime, endTime, reason, notes? }.
   * El veterinario (vet_id) se resuelve a partir del usuario autenticado.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Post()
  create(
    @Body() dto: CreateAppointmentDto,
    @Request() req: { user: { userId: number } },
  ): Promise<AppointmentCalendarItemDto> {
    return this.appointmentsService.create(dto, req.user.userId);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/confirm')
  confirm(@Param('id') id: string): Promise<AppointmentCalendarItemDto> {
    return this.appointmentsService.confirm(+id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string): Promise<AppointmentCalendarItemDto> {
    return this.appointmentsService.cancel(+id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/no-show')
  markNoShow(@Param('id') id: string): Promise<AppointmentCalendarItemDto> {
    return this.appointmentsService.markNoShow(+id);
  }
}
