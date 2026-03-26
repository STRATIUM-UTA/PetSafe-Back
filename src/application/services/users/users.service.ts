import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../../domain/entities/auth/user.entity.js';
import { Person } from '../../../domain/entities/persons/person.entity.js';
import { Role } from '../../../domain/entities/auth/role.entity.js';
import { UserRole } from '../../../domain/entities/auth/user-role.entity.js';
import { PersonTypeEnum, RoleEnum } from '../../../domain/enums/index.js';
import { RegisterDto } from '../../../presentation/dto/auth/register.dto.js';
import { UpdateProfileDto } from '../../../presentation/dto/auth/update-profile.dto.js';
import { UserProfileResponseDto } from '../../../presentation/dto/users/user-response.dto.js';
import { UserMapper } from '../../mappers/user.mapper.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async createUserWithRole(
    dto: RegisterDto,
    personType: PersonTypeEnum,
    roleName: RoleEnum,
    manager: EntityManager,
  ): Promise<{ savedUser: User; savedPerson: Person; savedUserRole: UserRole | null }> {
    const existingUser = await manager
      .createQueryBuilder(User, 'u')
      .setLock('pessimistic_write')
      .where('u.email = :correo', { correo: dto.email })
      .andWhere('u.deletedAt IS NULL')
      .getOne();

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const person = manager.create(Person, {
      personType: personType,
      firstName: dto.firstName,
      lastName: dto.lastName,
      documentId: dto.documentId ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      gender: dto.gender ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
    });
    const savedPerson = await manager.save(Person, person);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = manager.create(User, {
      personId: savedPerson.id,
      email: dto.email,
      passwordHash,
    });
    const savedUser = await manager.save(User, user);

    const targetRole = await manager.findOne(Role, {
      where: { name: roleName },
    });

    let savedUserRole: UserRole | null = null;
    if (targetRole) {
      const userRole = manager.create(UserRole, {
        userId: savedUser.id,
        roleId: targetRole.id,
      });
      savedUserRole = await manager.save(UserRole, userRole);
      
      savedUser.userRoles = savedUser.userRoles || [];
      savedUser.userRoles.push(userRole);
      userRole.role = targetRole; 
    }

    return { savedUser, savedPerson, savedUserRole };
  }

  async findProfile(userId: number): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person', 'userRoles', 'userRoles.role'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return UserMapper.toProfileDto(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const person = user.person;

    if (dto.firstName !== undefined) person.firstName = dto.firstName;
    if (dto.lastName !== undefined) person.lastName = dto.lastName;
    if (dto.documentId !== undefined) person.documentId = dto.documentId ?? null;
    if (dto.phone !== undefined) person.phone = dto.phone ?? null;
    if (dto.address !== undefined) person.address = dto.address ?? null;
    if (dto.gender !== undefined) person.gender = dto.gender ?? null;
    if (dto.birthDate !== undefined) {
      person.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }

    await this.personRepository.save(person);

    return { message: 'Perfil actualizado correctamente' };
  }
}
