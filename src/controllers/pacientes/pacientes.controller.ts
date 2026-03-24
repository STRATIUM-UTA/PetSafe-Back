import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { PacientesService } from '../../services/pacientes/pacientes.service.js';
import { CreatePacienteDto } from '../../dto/pacientes/create-paciente.dto.js';
import { UpdatePacienteDto } from '../../dto/pacientes/update-paciente.dto.js';
import { CreateCondicionDto } from '../../dto/pacientes/create-condicion.dto.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { RoleEnum } from '../../common/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  // ── Paciente CRUD ───────────────────────────────────

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA)
  @Post()
  create(
    @Body() dto: CreatePacienteDto,
    @Request() req: { user: { userId: string; roles?: string[] } },
  ) {
    return this.pacientesService.create(dto, req.user.userId, req.user.roles ?? []);
  }

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get()
  findAll(
    @Paginate() query: PaginateQuery,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.findAllByUser(query, req.user.userId);
  }

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.findOne(id, req.user.userId);
  }

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA)
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePacienteDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.update(id, dto, req.user.userId);
  }

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.softDelete(id, req.user.userId);
  }

  // ── Condiciones ─────────────────────────────────────

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Post(':id/condiciones')
  addCondicion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCondicionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.addCondicion(id, dto, req.user.userId);
  }

  @Roles(RoleEnum.CLIENTE_APP, RoleEnum.ADMIN, RoleEnum.MVZ)
  @Delete(':id/condiciones/:condicionId')
  removeCondicion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('condicionId', ParseUUIDPipe) condicionId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pacientesService.removeCondicion(id, condicionId, req.user.userId);
  }
}
