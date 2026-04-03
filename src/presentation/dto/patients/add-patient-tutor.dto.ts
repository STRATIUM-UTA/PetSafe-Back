import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class AddPatientTutorDto {
  @IsInt({ message: 'El tutor seleccionado no es válido.' })
  clientId!: number;

  @IsOptional()
  @IsBoolean({ message: 'isPrimary debe ser verdadero o falso.' })
  isPrimary?: boolean;

  @IsOptional()
  @IsString({ message: 'La relación debe ser texto.' })
  relationship?: string;
}
