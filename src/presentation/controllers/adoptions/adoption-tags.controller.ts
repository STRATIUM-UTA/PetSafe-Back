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
  UseGuards,
} from '@nestjs/common';
import { Paginate, type PaginateQuery } from 'nestjs-paginate';

import { AdoptionTagsService } from '../../../application/services/adoptions/adoption-tags.service.js';
import { AdoptionTagBasicResponse } from '../../dto/adoptions/adoption-tag-basic-response.dto.js';
import { CreateAdoptionTagDto } from '../../dto/adoptions/create-adoption-tag.dto.js';
import { ListAdoptionTagSearchQueryDto } from '../../dto/adoptions/list-adoption-tag-search-query.dto.js';
import { UpdateAdoptionTagDto } from '../../dto/adoptions/update-adoption-tag.dto.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../infra/security/guards/roles.guard.js';
import { Roles } from '../../../infra/security/decorators/roles.decorator.js';
import { RoleEnum } from '../../../domain/enums/index.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('adoption-tags')
export class AdoptionTagsController {
  constructor(private readonly adoptionTagsService: AdoptionTagsService) {}

  @Roles(RoleEnum.ADMIN)
  @Post()
  create(@Body() dto: CreateAdoptionTagDto) {
    return this.adoptionTagsService.create(dto);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get()
  findAll(@Paginate() query: PaginateQuery) {
    return this.adoptionTagsService.findAll(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get('search-summary')
  findSearchSummary(
    @Query() query: ListAdoptionTagSearchQueryDto,
  ): Promise<AdoptionTagBasicResponse[]> {
    return this.adoptionTagsService.findSearchSummary(query);
  }

  @Roles(RoleEnum.ADMIN, RoleEnum.MVZ, RoleEnum.RECEPCIONISTA, RoleEnum.CLIENTE_APP)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adoptionTagsService.findOne(id);
  }

  @Roles(RoleEnum.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdoptionTagDto) {
    return this.adoptionTagsService.update(id, dto);
  }

  @Roles(RoleEnum.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adoptionTagsService.remove(id);
  }
}
