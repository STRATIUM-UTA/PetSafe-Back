import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdoptionsService } from '../../services/adoptions/adoptions.service.js';
import { AdoptionsController } from '../../../presentation/controllers/adoptions/adoptions.controller.js';

import { Adoption } from '../../../domain/entities/adoptions/adoption.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Adoption, Patient, Client, UserRole])],
  controllers: [AdoptionsController],
  providers: [AdoptionsService],
  exports: [AdoptionsService],
})
export class AdoptionsModule {}
