import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsService } from '../../services/clients/clients.service.js';
import { ClientsController } from '../../../presentation/controllers/clients/clients.controller.js';

import { Client } from '../../../domain/entities/persons/client.entity.js';
import { Person } from '../../../domain/entities/persons/person.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { PatientTutor } from '../../../domain/entities/patients/patient-tutor.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Person, User, UserRole, PatientTutor])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
