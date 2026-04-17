import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

const parseDateValue = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const sameOrLaterThan = (left: Date, right: Date): boolean => left.getTime() >= right.getTime();

const strictlyLaterThan = (left: Date, right: Date): boolean => left.getTime() > right.getTime();

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const parsed = parseDateValue(value);
          if (!parsed) {
            return true;
          }

          return parsed.getTime() <= new Date().getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser una fecha futura.`;
        },
      },
    });
  };
}

export function IsNotBeforeDate(
  minDate: string,
  validationOptions?: ValidationOptions,
) {
  const min = new Date(minDate);

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBeforeDate',
      target: object.constructor,
      propertyName,
      constraints: [minDate],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const parsed = parseDateValue(value);
          if (!parsed) {
            return true;
          }

          return parsed.getTime() >= min.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser anterior a ${args.constraints[0]}.`;
        },
      },
    });
  };
}

export function IsTodayOrLater(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTodayOrLater',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const parsed = parseDateValue(value);
          if (!parsed) {
            return true;
          }

          return parsed.getTime() >= startOfToday().getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser anterior a hoy.`;
        },
      },
    });
  };
}

export function IsNotOlderThanYears(
  years: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotOlderThanYears',
      target: object.constructor,
      propertyName,
      constraints: [years],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const parsed = parseDateValue(value);
          if (!parsed) {
            return true;
          }

          const minAllowed = startOfToday();
          minAllowed.setFullYear(minAllowed.getFullYear() - years);

          return parsed.getTime() >= minAllowed.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser anterior a hace ${args.constraints[0]} años.`;
        },
      },
    });
  };
}

export function IsSameOrAfterProperty(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSameOrAfterProperty',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const current = parseDateValue(value);
          const related = parseDateValue((args.object as Record<string, unknown>)[property]);

          if (!current || !related) {
            return true;
          }

          return sameOrLaterThan(current, related);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser anterior a ${args.constraints[0]}.`;
        },
      },
    });
  };
}

export function IsAfterProperty(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterProperty',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          const current = parseDateValue(value);
          const related = parseDateValue((args.object as Record<string, unknown>)[property]);

          if (!current || !related) {
            return true;
          }

          return strictlyLaterThan(current, related);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser posterior a ${args.constraints[0]}.`;
        },
      },
    });
  };
}
