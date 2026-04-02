import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Adoption } from '../../../domain/entities/adoptions/adoption.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Client } from '../../../domain/entities/persons/client.entity.js';
import { CreateAdoptionDto } from '../../../presentation/dto/adoptions/create-adoption.dto.js';
import { UpdateAdoptionDto } from '../../../presentation/dto/adoptions/update-adoption.dto.js';
import { AdoptionStatusEnum } from '../../../domain/enums/index.js';

@Injectable()
export class AdoptionsService {
  constructor(
    @InjectRepository(Adoption) private readonly adoptionsRepo: Repository<Adoption>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateAdoptionDto): Promise<Adoption> {
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId, deletedAt: IsNull() },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');

    const adoption = this.adoptionsRepo.create({
      patientId: dto.patientId,
      story: dto.story,
      requirements: dto.requirements,
      notes: dto.notes,
    });

    return this.adoptionsRepo.save(adoption);
  }

  async findAll(): Promise<Adoption[]> {
    return this.adoptionsRepo.find({
      where: { deletedAt: IsNull(), isActive: true },
      relations: ['patient', 'patient.species', 'patient.breed', 'adopterClient', 'adopterClient.person'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Adoption> {
    const adoption = await this.adoptionsRepo.findOne({
      where: { id, deletedAt: IsNull(), isActive: true },
      relations: ['patient', 'patient.species', 'patient.breed', 'adopterClient', 'adopterClient.person'],
    });
    if (!adoption) throw new NotFoundException('Adopción no encontrada');
    return adoption;
  }

  async update(id: number, dto: UpdateAdoptionDto): Promise<Adoption> {
    const adoption = await this.findOne(id);

    if (dto.adopterClientId) {
      const client = await this.clientRepo.findOne({
        where: { id: dto.adopterClientId },
      });
      if (!client) throw new NotFoundException('Cliente adoptante no encontrado');
      adoption.adopterClientId = dto.adopterClientId;
    }

    if (dto.status && dto.status !== adoption.status) {
      adoption.status = dto.status;
      if (dto.status === AdoptionStatusEnum.ADOPTADO) {
        adoption.adoptionDate = new Date();
      }
    }

    if (dto.story !== undefined) adoption.story = dto.story;
    if (dto.requirements !== undefined) adoption.requirements = dto.requirements;
    if (dto.notes !== undefined) adoption.notes = dto.notes;

    return this.adoptionsRepo.save(adoption);
  }

  async remove(id: number): Promise<void> {
    const adoption = await this.findOne(id);
    adoption.deletedAt = new Date();
    adoption.isActive = false;
    await this.adoptionsRepo.save(adoption);
  }
}
