import { IsEmail } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'Por favor, ingrese un correo electronico valido.' })
  newEmail!: string;
}
