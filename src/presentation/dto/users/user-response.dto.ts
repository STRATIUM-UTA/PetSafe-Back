import { PersonTypeEnum, GenderEnum } from '../../../domain/enums/index.js';

export class PersonResponseDto {
  id!: number;
  personType?: PersonTypeEnum;
  firstName!: string;
  lastName!: string;
  identification?: string | null;
  phone?: string | null;
  address?: string | null;
  gender?: GenderEnum | null;
  birthDate?: Date | null;
}

export class UserProfileResponseDto {
  id!: number;
  email!: string;
  lastLoginAt?: Date | null;
  person!: PersonResponseDto;
  roles!: string[];
  employeeId!: number | null;
  isVeterinarian!: boolean;
}

export class VeterinarianListItemResponseDto {
  id!: number;
  personId!: number;
  fullName!: string;
  documentId!: string;
  code!: string | null;
  professionalRegistration!: string | null;
}
