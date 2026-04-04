import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdoptionsService } from '../../../application/services/adoptions/adoptions.service.js';
import { CreateAdoptionDto } from '../../dto/adoptions/create-adoption.dto.js';
import { UpdateAdoptionDto } from '../../dto/adoptions/update-adoption.dto.js';
import {
  PaginatedAdoptionBasicResponse,
} from '../../dto/adoptions/adoption-basic-response.dto.js';
import { AdoptionBasicDetailResponse } from '../../dto/adoptions/adoption-basic-detail-response.dto.js';
import { PaginatedAdoptionCatalogResponse } from '../../dto/adoptions/adoption-catalog-response.dto.js';
import { ListAdoptionBasicQueryDto } from '../../dto/adoptions/list-adoption-basic-query.dto.js';
import { ListAdoptionCatalogQueryDto } from '../../dto/adoptions/list-adoption-catalog-query.dto.js';
import { UpdateAdoptionBasicDto } from '../../dto/adoptions/update-adoption-basic.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';
import {
  PATIENT_UPLOADS_URL_PREFIX,
  patientImageUploadOptions,
} from '../../../infra/config/uploads.config.js';

type PatientImageRequest = {
  user: { userId: number; roles?: string[] };
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
};

@Controller('adoptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdoptionsController {
  constructor(private readonly adoptionsService: AdoptionsService) {}

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Post()
  create(@Body() dto: CreateAdoptionDto) {
    return this.adoptionsService.create(dto);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get()
  findAll() {
    return this.adoptionsService.findAll();
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('basic')
  findAllBasic(
    @Query() query: ListAdoptionBasicQueryDto,
  ): Promise<PaginatedAdoptionBasicResponse> {
    return this.adoptionsService.findAllBasic(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('catalog')
  findCatalog(
    @Query() query: ListAdoptionCatalogQueryDto,
  ): Promise<PaginatedAdoptionCatalogResponse> {
    return this.adoptionsService.findCatalog(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adoptionsService.findOne(id);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id/basic')
  @UseInterceptors(FileInterceptor('image', patientImageUploadOptions))
  updateBasic(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdoptionBasicDto,
    @UploadedFile() imageFile: any,
    @Request() req: PatientImageRequest,
  ): Promise<AdoptionBasicDetailResponse> {
    return this.adoptionsService.updateBasic(
      id,
      dto,
      req.user.userId,
      req.user.roles ?? [],
      imageFile,
      this.buildPatientImageBaseUrl(req),
    );
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdoptionDto) {
    return this.adoptionsService.update(id, dto);
  }

  @Roles(RoleEnum.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adoptionsService.remove(id);
  }

  private buildPatientImageBaseUrl(req: {
    protocol?: string;
    headers?: Record<string, string | string[] | undefined>;
    get?: (name: string) => string | undefined;
  }): string {
    const forwardedProto = req.headers?.['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || req.protocol || 'http';
    const host = req.get?.('host') || 'localhost:3000';
    return `${protocol}://${host}${PATIENT_UPLOADS_URL_PREFIX}`;
  }
}
