import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  AppetiteStatusEnum,
  HydrationStatusEnum,
  MucosaStatusEnum,
  WaterIntakeStatusEnum,
} from '../../../domain/enums/index.js';

// ── Tab 1: Motivo de Consulta ──
export class UpdateEncounterReasonDto {
  @IsOptional() @IsString() consultationReason?: string;
  @IsOptional() @IsString() currentIllnessHistory?: string;
  @IsOptional() @IsString() referredPreviousDiagnoses?: string;
  @IsOptional() @IsString() referredPreviousTreatments?: string;
}

// ── Tab 2: Anamnesis ──
export class UpdateEncounterAnamnesisDto {
  @IsOptional() @IsString() problemStartText?: string;
  @IsOptional() @IsString() previousSurgeriesText?: string;
  @IsOptional() @IsString() howProblemStartedText?: string;
  @IsOptional() @IsBoolean() vaccinesUpToDate?: boolean;
  @IsOptional() @IsBoolean() dewormingUpToDate?: boolean;
  @IsOptional() @IsBoolean() hasPetAtHome?: boolean;
  @IsOptional() @IsString() petAtHomeDetail?: string;
  @IsOptional() @IsString() administeredMedicationText?: string;
  
  @IsOptional() @IsEnum(AppetiteStatusEnum) appetiteStatus?: AppetiteStatusEnum;
  @IsOptional() @IsEnum(WaterIntakeStatusEnum) waterIntakeStatus?: WaterIntakeStatusEnum;
  
  @IsOptional() @IsString() fecesText?: string;
  @IsOptional() @IsString() vomitText?: string;
  
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) numberOfBowelMovements?: number;
  
  @IsOptional() @IsString() urineText?: string;
  @IsOptional() @IsString() respiratoryProblemsText?: string;
  @IsOptional() @IsString() difficultyWalkingText?: string;
  @IsOptional() @IsString() notes?: string;
}

// ── Tab 3: Examen Físico ──
export class UpdateEncounterClinicalExamDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20) @Max(50) temperatureC?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pulse?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) heartRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) respiratoryRate?: number;
  
  @IsOptional() @IsEnum(MucosaStatusEnum) mucousMembranes?: MucosaStatusEnum;
  @IsOptional() @IsString() lymphNodes?: string;
  @IsOptional() @IsEnum(HydrationStatusEnum) hydration?: HydrationStatusEnum;
  
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) crtSeconds?: number;
  @IsOptional() @IsString() examNotes?: string;
}

// ── Tab 4: Datos del entorno ──
export class UpdateEncounterEnvironmentalDataDto {
  @IsOptional() @IsString() currentDiet?: string;
  @IsOptional() @IsString() reproductiveStatus?: string;
  @IsOptional() @IsString() environmentDescription?: string;
  @IsOptional() @IsString() notes?: string;
}

// ── Tab 5: Impresión Clínica / Diagnóstico ──
export class UpdateEncounterClinicalImpressionDto {
  @IsOptional() @IsString() presumptiveDiagnosis?: string;
  @IsOptional() @IsString() differentialDiagnosis?: string;
  @IsOptional() @IsString() prognosis?: string;
  @IsOptional() @IsString() clinicalNotes?: string;
}

// ── Tab 6: Plan a seguir ──
export class UpdateEncounterPlanDto {
  @IsOptional() @IsString() clinicalPlan?: string;
  @IsOptional() @IsBoolean() requiresNextAppointment?: boolean;
  @IsOptional() @IsString() suggestedNextAppointmentDate?: string;
  @IsOptional() @IsString() planNotes?: string;
}
