import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidEcuadorianCedula } from '../../infra/utils/document-id.util.js';

export function IsCedula(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCedula',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          return typeof value === 'string' && isValidEcuadorianCedula(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser una cédula ecuatoriana válida.`;
        },
      },
    });
  };
}
