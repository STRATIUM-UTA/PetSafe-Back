import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../../domain/entities/auth/user.entity.js';
import { Person } from '../../../domain/entities/persons/person.entity.js';
import { Role } from '../../../domain/entities/auth/role.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { UsersService } from '../../services/users/users.service.js';
import { UsersController } from '../../../presentation/controllers/users/users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Person, Role, UserRole])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
