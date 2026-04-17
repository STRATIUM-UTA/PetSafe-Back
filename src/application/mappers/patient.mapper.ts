import { Patient } from '../../domain/entities/patients/patient.entity.js';
import {
  PatientResponseDto,
  PatientConditionResponseDto,
  PatientTutorResponseDto,
} from '../../presentation/dto/patients/patient-response.dto.js';
import { PatientCondition } from '../../domain/entities/patients/patient-condition.entity.js';
import { MediaFile } from '../../domain/entities/media/media-file.entity.js';
import { PatientImageResponseDto } from '../../presentation/dto/patients/patient-image.dto.js';
import { PatientTutor } from '../../domain/entities/patients/patient-tutor.entity.js';

export class PatientMapper {
  static toImageDto(image: MediaFile | null | undefined): PatientImageResponseDto | null {
    if (!image) {
      return null;
    }

    return {
      id: image.id,
      url: image.url,
      originalName: image.originalName,
      mimeType: image.mimeType ?? null,
      sizeBytes: image.sizeBytes ?? null,
      width: image.width ?? null,
      height: image.height ?? null,
      storageKey: image.storageKey ?? null,
      provider: image.provider,
    };
  }

  static toConditionDto(condition: PatientCondition): PatientConditionResponseDto {
    return {
      id: condition.id,
      type: condition.type,
      name: condition.name,
      description: condition.description ?? null,
      active: condition.isActive,
    };
  }

  static toTutorDto(tutor: PatientTutor): PatientTutorResponseDto {
    const person = tutor.client?.person;
    const firstName = person?.firstName ?? '';
    const lastName = person?.lastName ?? '';

    return {
      clientId: tutor.clientId,
      personId: tutor.client?.personId ?? 0,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      documentId: person?.documentId ?? '',
      phone: person?.phone ?? null,
      relationship: tutor.relationship ?? null,
      isPrimary: tutor.isPrimary,
    };
  }

  static toResponseDto(patient: Patient, image?: MediaFile | null): PatientResponseDto {
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
      image: this.toImageDto(image),
      tutors: (patient.tutors || [])
        .filter((tutor) => !tutor.deletedAt)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((tutor) => this.toTutorDto(tutor)),
      conditions: (patient.conditions || []).map((c) => this.toConditionDto(c)),
    };
  }
}
