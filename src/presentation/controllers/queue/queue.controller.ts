import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from '../../../application/services/queue/queue.service.js';
import { CreateQueueEntryDto } from '../../dto/queue/create-queue-entry.dto.js';
import { ListQueueQueryDto } from '../../dto/queue/list-queue-query.dto.js';
import { QueueEntryRecordDto, QueueListResponseDto } from '../../dto/queue/queue-response.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) { }

  /**
   * GET /queue?date=YYYY-MM-DD&status=EN_ESPERA&search=Luna&page=1&limit=15
   * Devuelve la cola del día con paginación y summary.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get()
  list(
    @Query() query: ListQueueQueryDto,
  ): Promise<QueueListResponseDto> {
    return this.queueService.list(query);
  }

  /**
   * GET /queue/by-encounter/:encounterId
   * Devuelve la entrada operativa asociada a una consulta.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('by-encounter/:encounterId')
  getByEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.findByEncounter(encounterId);
  }

  /**
   * GET /queue/:id
   * Devuelve una entrada específica de cola.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.findOne(id);
  }

  /**
   * POST /queue
   * Registra la llegada de un paciente (entrada en cola).
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Post()
  create(
    @Body() dto: CreateQueueEntryDto,
    @Request() req: { user: { userId: number } },
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.create(dto, req.user.userId);
  }

  /**
   * PATCH /queue/:id/start
   * Cambia la entrada de EN_ESPERA → EN_ATENCION.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/start')
  startAttention(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.startAttention(id);
  }

  /**
   * PATCH /queue/:id/finish
   * Cambia la entrada de EN_ATENCION → FINALIZADA.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/finish')
  finishAttention(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.finishAttention(id);
  }

  /**
   * PATCH /queue/:id/cancel
   * Cambia la entrada de EN_ESPERA → CANCELADA.
   */
  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/cancel')
  cancelEntry(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<QueueEntryRecordDto> {
    return this.queueService.cancelEntry(id);
  }
}
