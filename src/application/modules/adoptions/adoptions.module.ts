import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdoptionsService } from '../../services/adoptions/adoptions.service.js';
import { AdoptionTagsService } from '../../services/adoptions/adoption-tags.service.js';
import { AdoptionsController } from '../../../presentation/controllers/adoptions/adoptions.controller.js';
import { AdoptionTagsController } from '../../../presentation/controllers/adoptions/adoption-tags.controller.js';
import { PatientsModule } from '../patients/patients.module.js';

import { Adoption } from '../../../domain/entities/adoptions/adoption.entity.js';
import { AdoptionTag } from '../../../domain/entities/adoptions/adoption-tag.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Adoption, AdoptionTag, MediaFile, Patient, Client, UserRole]),
    PatientsModule,
  ],
  controllers: [AdoptionsController, AdoptionTagsController],
  providers: [AdoptionsService, AdoptionTagsService],
  exports: [AdoptionsService, AdoptionTagsService],
})
export class AdoptionsModule {}
