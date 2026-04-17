import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { VaccinationService } from '../../../application/services/vaccinations/vaccination.service.js';
import { CreateVaccineDto } from '../../dto/vaccinations/create-vaccine.dto.js';
import { UpdateVaccineDto } from '../../dto/vaccinations/update-vaccine.dto.js';
import { CreatePatientVaccineRecordDto } from '../../dto/vaccinations/create-patient-vaccine-record.dto.js';
import { CreateVaccinationSchemeDto } from '../../dto/vaccinations/create-vaccination-scheme.dto.js';
import { CreateVaccinationSchemeVersionDto } from '../../dto/vaccinations/create-vaccination-scheme-version.dto.js';
import { UpdateVaccinationSchemeVersionStatusDto } from '../../dto/vaccinations/update-vaccination-scheme-version-status.dto.js';
import { UpdatePatientVaccinationPlanDoseDto } from '../../dto/vaccinations/update-patient-vaccination-plan-dose.dto.js';
import { ListVaccinationsQueryDto } from '../../dto/vaccinations/list-vaccinations-query.dto.js';
import { PaginatedVaccinationsBasicResponse } from '../../dto/vaccinations/vaccination-basic-response.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vaccinations')
export class VaccinationController {
  constructor(private readonly vaccinationService: VaccinationService) {}

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA)
  @Get('basic')
  findAllBasic(@Query() query: ListVaccinationsQueryDto): Promise<PaginatedVaccinationsBasicResponse> {
    return this.vaccinationService.findAllBasic(query);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('products')
  getProducts(
    @Query('speciesId') speciesId?: string,
    @Query('onlyActive') onlyActive?: string,
    @Query('search') search?: string,
  ) {
    return this.vaccinationService.getProducts(
      speciesId ? Number(speciesId) : undefined,
      onlyActive === undefined ? true : onlyActive === 'true',
      search,
    );
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('products/:productId')
  getProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.vaccinationService.getProduct(productId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Post('products')
  createProduct(@Body() dto: CreateVaccineDto) {
    return this.vaccinationService.createProduct(dto);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Put('products/:productId')
  updateProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateVaccineDto,
  ) {
    return this.vaccinationService.updateProduct(productId, dto);
  }

  @Roles(RoleEnum.ADMIN)
  @Delete('products/:productId')
  deactivateProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.vaccinationService.deactivateProduct(productId);
  }

  @Roles(RoleEnum.ADMIN)
  @Patch('products/:productId/reactivate')
  reactivateProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.vaccinationService.reactivateProduct(productId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('schemes/versions/:versionId')
  getSchemeVersion(@Param('versionId', ParseIntPipe) versionId: number) {
    return this.vaccinationService.getSchemeVersion(versionId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('schemes')
  getSchemes(@Query('speciesId') speciesId?: string) {
    return this.vaccinationService.getSchemes(speciesId ? Number(speciesId) : undefined);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('schemes/:schemeId')
  getScheme(@Param('schemeId', ParseIntPipe) schemeId: number) {
    return this.vaccinationService.getScheme(schemeId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Post('schemes')
  createScheme(@Body() dto: CreateVaccinationSchemeDto) {
    return this.vaccinationService.createScheme(dto);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Post('schemes/:schemeId/versions')
  createSchemeVersion(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() dto: CreateVaccinationSchemeVersionDto,
  ) {
    return this.vaccinationService.createSchemeVersion(schemeId, dto);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Patch('schemes/versions/:versionId/status')
  updateSchemeVersionStatus(
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: UpdateVaccinationSchemeVersionStatusDto,
  ) {
    return this.vaccinationService.updateSchemeVersionStatus(versionId, dto);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('patients/:patientId/plan')
  getPatientPlan(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.vaccinationService.getPatientPlan(patientId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('patients/:patientId/applications')
  getPatientApplications(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.vaccinationService.getPatientApplications(patientId);
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Post('patients/:patientId/applications')
  addPatientApplication(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreatePatientVaccineRecordDto,
    @Request() req: { user: { userId: number } },
  ) {
    return this.vaccinationService.addPatientApplication(
      patientId,
      dto,
      req.user.userId,
    );
  }

  @Roles(RoleEnum.MVZ, RoleEnum.ADMIN)
  @Patch('patients/:patientId/plan-doses/:planDoseId/status')
  updatePatientPlanDoseStatus(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('planDoseId', ParseIntPipe) planDoseId: number,
    @Body() dto: UpdatePatientVaccinationPlanDoseDto,
  ) {
    return this.vaccinationService.updatePatientPlanDoseStatus(
      patientId,
      planDoseId,
      dto,
    );
  }
}
