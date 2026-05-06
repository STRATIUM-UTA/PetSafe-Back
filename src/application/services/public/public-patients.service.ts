import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { MediaOwnerTypeEnum, MediaTypeEnum } from '../../../domain/enums/index.js';
import { PublicPatientProfileResponse } from '../../../presentation/dto/public/public-patient-response.dto.js';

@Injectable()
export class PublicPatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(MediaFile)
    private readonly mediaFileRepo: Repository<MediaFile>,
  ) {}

  async findByQrToken(qrToken: string): Promise<PublicPatientProfileResponse> {
    const patient = await this.patientRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.species', 'species')
      .leftJoinAndSelect('p.breed', 'breed')
      .leftJoinAndSelect('p.color', 'color')
      .leftJoinAndSelect('p.tutors', 'tutors', 'tutors.deleted_at IS NULL AND tutors.is_active = true')
      .leftJoinAndSelect('tutors.client', 'client', 'client.deleted_at IS NULL')
      .leftJoinAndSelect('client.person', 'person')
      .where('p.qr_token = :qrToken', { qrToken })
      .andWhere('p.deleted_at IS NULL')
      .getOne();

    if (!patient) {
      throw new NotFoundException('Mascota no encontrada');
    }

    const image = await this.mediaFileRepo.findOne({
      where: {
        ownerType: MediaOwnerTypeEnum.PACIENTE,
        ownerId: patient.id,
        mediaType: MediaTypeEnum.IMAGEN,
        isActive: true,
      },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    const primaryTutor =
      patient.tutors?.find((t) => t.isPrimary) ?? patient.tutors?.[0] ?? null;

    const owner = primaryTutor?.client?.person
      ? {
          firstName: primaryTutor.client.person.firstName,
          lastName: primaryTutor.client.person.lastName,
          fullName: `${primaryTutor.client.person.firstName} ${primaryTutor.client.person.lastName}`.trim(),
          phone: primaryTutor.client.person.phone ?? null,
        }
      : null;

    return {
      id: patient.id,
      name: patient.name,
      species: patient.species?.name ?? null,
      breed: patient.breed?.name ?? null,
      sex: patient.sex ?? null,
      color: patient.color?.name ?? null,
      birthDate: patient.birthDate ? String(patient.birthDate) : null,
      distinguishingMarks: patient.distinguishingMarks ?? null,
      microchipCode: patient.microchipCode ?? null,
      image: image?.url ? { url: image.url } : null,
      owner,
    };
  }
}
