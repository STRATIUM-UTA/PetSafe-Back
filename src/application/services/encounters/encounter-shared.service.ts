import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  EDITABLE_ENCOUNTER_STATUSES,
  ENCOUNTER_REACTIVATION_GRACE_MINUTES,
} from '../../../domain/constants/encounter.constants.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { Vaccine } from '../../../domain/entities/catalogs/vaccine.entity.js';
import { Employee } from '../../../domain/entities/persons/employee.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { EncounterStatusEnum, RoleEnum } from '../../../domain/enums/index.js';

@Injectable()
export class EncounterSharedService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  /**
   * Carga una atenciÃ³n con todas sus relaciones clÃ­nicas principales.
   */
  async findEncounterOrFail(id: number): Promise<Encounter> {
    const encounter = await this.encounterRepo.findOne({
      where: { id },
      relations: [
        'patient',
        'patient.species',
        'patient.breed',
        'consultationReason',
        'anamnesis',
        'clinicalExam',
        'environmentalData',
        'clinicalImpression',
        'plan',
        'vaccinationEvents',
        'vaccinationEvents.vaccine',
        'vaccinationEvents.patientVaccineRecord',
        'vaccinationDrafts',
        'vaccinationDrafts.vaccine',
        'vaccinationDrafts.planDose',
        'dewormingEvents',
        'dewormingEvents.product',
        'treatments',
        'treatments.items',
        'treatmentDrafts',
        'treatmentDrafts.items',
        'surgeries',
        'procedures',
        'procedureDrafts',
        'procedureDrafts.catalog',
      ],
    });

    if (!encounter || encounter.deletedAt) {
      throw new NotFoundException('AtenciÃ³n no encontrada.');
    }

    return encounter;
  }

  /**
   * Asegura que la atenciÃ³n siga abierta para aceptar cambios clÃ­nicos.
   */
  ensureActive(encounter: Encounter): void {
    if (!this.isEditableStatus(encounter.status)) {
      throw new ConflictException(
        `La atenciÃ³n ya estÃ¡ en estado "${encounter.status}". No se puede modificar.`,
      );
    }
  }

  isEditableStatus(status: EncounterStatusEnum): boolean {
    return EDITABLE_ENCOUNTER_STATUSES.includes(status);
  }

  getReactivationGraceEndsAt(encounter: Encounter): Date | null {
    if (encounter.status !== EncounterStatusEnum.FINALIZADA || !encounter.endTime) {
      return null;
    }

    return new Date(
      encounter.endTime.getTime() + ENCOUNTER_REACTIVATION_GRACE_MINUTES * 60_000,
    );
  }

  canReactivate(encounter: Encounter, now = new Date()): boolean {
    const graceEndsAt = this.getReactivationGraceEndsAt(encounter);
    return graceEndsAt !== null && now.getTime() <= graceEndsAt.getTime();
  }

  ensureCanReactivate(encounter: Encounter, now = new Date()): void {
    if (encounter.status !== EncounterStatusEnum.FINALIZADA) {
      throw new ConflictException(
        `La atención está en estado "${encounter.status}" y no puede reactivarse.`,
      );
    }

    if (!encounter.endTime) {
      throw new ConflictException(
        'La atención no tiene una hora de finalización registrada y no puede reactivarse.',
      );
    }

    if (!this.canReactivate(encounter, now)) {
      throw new ConflictException(
        `La atención solo puede reactivarse dentro de los ${ENCOUNTER_REACTIVATION_GRACE_MINUTES} minutos posteriores a su finalización.`,
      );
    }
  }

  /**
   * Verifica que el paciente exista y no estÃ© eliminado.
   */
  async findPatientOrFail(patientId: number): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
      relations: ['species'],
    });

    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    return patient;
  }

  /**
   * Valida que el veterinario exista y, si el actor es MVZ, que solo pueda usar su propio registro.
   */
  async ensureVetCanCreateEncounter(
    vetId: number,
    userId: number,
    roles: string[],
  ): Promise<void> {
    const vet = await this.employeeRepo.findOne({ where: { id: vetId } });
    if (!vet || vet.deletedAt) {
      throw new NotFoundException('Empleado no encontrado.');
    }

    if (!vet.isVeterinarian) {
      throw new BadRequestException(
        'El empleado seleccionado existe, pero no está registrado como veterinario.',
      );
    }

    const isAdmin = roles.includes(RoleEnum.ADMIN);
    const isMvz = roles.includes(RoleEnum.MVZ);

    if (!isMvz || isAdmin) {
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (vet.personId !== user.personId) {
      throw new ConflictException(
        'No puedes crear una atenciÃ³n asignÃ¡ndola a otro veterinario.',
      );
    }
  }

  async findEmployeeById(employeeId: number): Promise<Employee | null> {
    return this.employeeRepo.findOne({ where: { id: employeeId } });
  }

  async findVeterinarianEmployeeForUser(userId: number): Promise<Employee> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const employee = await this.employeeRepo.findOne({
      where: { personId: user.personId },
    });

    if (!employee || employee.deletedAt || !employee.isVeterinarian) {
      throw new BadRequestException(
        'Tu usuario no tiene un perfil de veterinario activo asociado.',
      );
    }

    return employee;
  }

  /**
   * Impide aplicar vacunas de una especie distinta a la del paciente.
   */
  async ensureVaccineMatchesPatientSpecies(
    vaccine: Vaccine,
    patientId: number,
  ): Promise<void> {
    const patient = await this.findPatientOrFail(patientId);

    if (vaccine.speciesId !== patient.speciesId) {
      throw new BadRequestException(
        `La vacuna "${vaccine.name}" no corresponde a la especie del paciente.`,
      );
    }
  }
}
