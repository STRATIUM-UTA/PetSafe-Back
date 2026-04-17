import {
  HydrationStatusEnum,
  MucosaStatusEnum,
  WaterIntakeStatusEnum,
} from '../../../domain/enums/index.js';

const normalizeTextEnum = (value: unknown): string | unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : value;
};

const WATER_INTAKE_ALIASES: Readonly<Record<string, WaterIntakeStatusEnum>> = {
  NORMAL: WaterIntakeStatusEnum.NORMAL,
  AUMENTADO: WaterIntakeStatusEnum.AUMENTADO,
  DISMINUIDO: WaterIntakeStatusEnum.DISMINUIDO,
  POLIDIPSIA: WaterIntakeStatusEnum.AUMENTADO,
  ADIPSIA: WaterIntakeStatusEnum.DISMINUIDO,
};

const MUCOSA_ALIASES: Readonly<Record<string, MucosaStatusEnum>> = {
  NORMAL: MucosaStatusEnum.NORMAL,
  ROSADAS: MucosaStatusEnum.NORMAL,
  PALIDA: MucosaStatusEnum.PALIDA,
  PALIDAS: MucosaStatusEnum.PALIDA,
  ICTERICA: MucosaStatusEnum.ICTERICA,
  ICTERICAS: MucosaStatusEnum.ICTERICA,
  CIANOTICA: MucosaStatusEnum.CIANOTICA,
  CIANOTICAS: MucosaStatusEnum.CIANOTICA,
  HIPEREMICA: MucosaStatusEnum.HIPEREMICA,
  CONGESTIVAS: MucosaStatusEnum.HIPEREMICA,
};

const HYDRATION_ALIASES: Readonly<Record<string, HydrationStatusEnum>> = {
  NORMAL: HydrationStatusEnum.NORMAL,
  LEVE_DESHIDRATACION: HydrationStatusEnum.LEVE_DESHIDRATACION,
  MODERADA_DESHIDRATACION: HydrationStatusEnum.MODERADA_DESHIDRATACION,
  SEVERA_DESHIDRATACION: HydrationStatusEnum.SEVERA_DESHIDRATACION,
  DESHIDRATACION_LEVE: HydrationStatusEnum.LEVE_DESHIDRATACION,
  DESHIDRATACION_MODERADA: HydrationStatusEnum.MODERADA_DESHIDRATACION,
  DESHIDRATACION_SEVERA: HydrationStatusEnum.SEVERA_DESHIDRATACION,
};

export function normalizeWaterIntakeStatusEnum(
  value: unknown,
): WaterIntakeStatusEnum | unknown {
  const normalized = normalizeTextEnum(value);
  if (typeof normalized !== 'string') {
    return normalized;
  }

  return WATER_INTAKE_ALIASES[normalized] ?? normalized;
}

export function normalizeMucosaStatusEnum(
  value: unknown,
): MucosaStatusEnum | unknown {
  const normalized = normalizeTextEnum(value);
  if (typeof normalized !== 'string') {
    return normalized;
  }

  return MUCOSA_ALIASES[normalized] ?? normalized;
}

export function normalizeHydrationStatusEnum(
  value: unknown,
): HydrationStatusEnum | unknown {
  const normalized = normalizeTextEnum(value);
  if (typeof normalized !== 'string') {
    return normalized;
  }

  return HYDRATION_ALIASES[normalized] ?? normalized;
}
