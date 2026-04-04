import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAdoptionTagDto {
  @IsNotEmpty({ message: 'El nombre del tag es obligatorio.' })
  @IsString({ message: 'El nombre del tag debe ser texto.' })
  @MaxLength(80, { message: 'El nombre del tag no puede exceder 80 caracteres.' })
  name!: string;
}
