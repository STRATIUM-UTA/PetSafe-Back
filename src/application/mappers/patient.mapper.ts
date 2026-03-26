import { Patient } from '../../domain/entities/patients/patient.entity.js';
import { PatientResponseDto, PatientConditionResponseDto } from '../../presentation/dto/patients/patient-response.dto.js';
import { PatientCondition } from '../../domain/entities/patients/patient-condition.entity.js';

export class PatientMapper {
  static toConditionDto(condition: PatientCondition): PatientConditionResponseDto {
    return {
      id: condition.id,
      type: condition.type,
      name: condition.name,
      description: condition.description ?? null,
      active: condition.isActive,
    };
  }

  static toResponseDto(patient: Patient): PatientResponseDto {
    return {
      id: patient.id,
      code: patient.code ?? '',
      name: patient.name,
      sex: patient.sex,
      birthDate: patient.birthDate ?? null,
      currentWeight: patient.currentWeight ?? null,
      sterilized: patient.isSterilized,
      microchipCode: patient.microchipCode ?? null,
      distinguishingMarks: patient.distinguishingMarks ?? null,
      generalAllergies: patient.generalAllergies ?? null,
      generalHistory: patient.generalHistory ?? null,
      species: patient.species
        ? {
            id: patient.species.id,
            name: patient.species.name,
            zootecnicalGroupId: patient.species.zootecnicalGroupId ?? null,
          }
        : null,
      breed: patient.breed
        ? {
            id: patient.breed.id,
            name: patient.breed.name,
            speciesId: patient.breed.speciesId ?? null,
          }
        : null,
      color: patient.color ? { id: patient.color.id, name: patient.color.name } : null,
      conditions: (patient.conditions || []).map((c) => this.toConditionDto(c)),
    };
  }
}
