import { User } from '../../domain/entities/auth/user.entity.js';
import { Person } from '../../domain/entities/persons/person.entity.js';
import { UserProfileResponseDto, PersonResponseDto } from '../../presentation/dto/users/user-response.dto.js';

export class UserMapper {
  static toPersonDto(person: Person): PersonResponseDto {
    return {
      id: person.id,
      personType: person.personType,
      firstName: person.firstName,
      lastName: person.lastName,
      identification: person.documentId ?? null,
      phone: person.phone ?? null,
      address: person.address ?? null,
      gender: person.gender ?? null,
      birthDate: person.birthDate ?? null,
    };
  }

  static toProfileDto(user: User): UserProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      lastLoginAt: user.lastLoginAt ?? null,
      person: user.person ? this.toPersonDto(user.person) : ({} as any),
      roles: user.userRoles?.map((ur) => ur.role.name) || [],
    };
  }
}
