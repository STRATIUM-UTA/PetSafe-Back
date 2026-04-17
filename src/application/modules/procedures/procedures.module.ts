import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProceduresService } from '../../services/procedures/procedures.service.js';
import { ProceduresController } from '../../../presentation/controllers/procedures/procedures.controller.js';

import { Procedure } from '../../../domain/entities/encounters/procedure.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { ProcedureCatalog } from '../../../domain/entities/catalogs/procedure-catalog.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Procedure, Encounter, Patient, ProcedureCatalog, UserRole])],
  controllers: [ProceduresController],
  providers: [ProceduresService],
  exports: [ProceduresService],
})
export class ProceduresModule {}
