import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { AppointmentsPdfService } from './appointments-pdf.service.js';
import {
  ClinicalHistoryPdfData,
  ClinicalHistoryPdfService,
} from './clinical-history-pdf.service.js';
import { AgendaReportItemDto } from '../../../presentation/dto/reports/agenda-report-item.dto.js';

function patientSexLabel(sex: string | null | undefined): string {
  const map: Record<string, string> = {
    MACHO: 'Macho',
    HEMBRA: 'Hembra',
  };
  return sex ? (map[sex] ?? sex) : 'No se han encontrado datos.';
}

function treatmentStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    ACTIVO: 'Activo',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };
  return status ? (map[status] ?? status) : 'No se han encontrado datos.';
}

function surgeryStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    PROGRAMADA: 'Programada',
    REALIZADA: 'Realizada',
    CANCELADA: 'Cancelada',
  };
  return status ? (map[status] ?? status) : 'No se han encontrado datos.';
}

function boolLabel(value: boolean | null | undefined): string {
  if (value === true) return 'Si';
  if (value === false) return 'No';
  return 'No se han encontrado datos.';
}

function noData(value: string | null | undefined): string {
  if (typeof value !== 'string') return 'No se han encontrado datos.';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'No se han encontrado datos.';
}

function toMillis(value: string | Date | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function fullName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length === 0) return 'N/A';
  return parts.join(' ').trim();
}

function formatDateValue(raw: string | Date | null | undefined): string {
  if (!raw) return 'N/A';
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw).substring(0, 10);
}

function formatTimeValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return String(raw).substring(0, 5);
}

function formatClockTime(raw: Date | string | null | undefined): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    const hours = String(raw.getHours()).padStart(2, '0');
    const minutes = String(raw.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return formatTimeValue(raw);
}

function queueEntryTypeLabel(type: string | null | undefined): string {
  const map: Record<string, string> = {
    CON_CITA: 'Con cita',
    SIN_CITA: 'Sin cita',
    EMERGENCIA: 'Emergencia',
  };
  return type ? (map[type] ?? type) : 'N/A';
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(PatientVaccineRecord)
    private readonly patientVaccineRecordRepo: Repository<PatientVaccineRecord>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly appointmentsPdfService: AppointmentsPdfService,
    private readonly clinicalHistoryPdfService: ClinicalHistoryPdfService,
  ) {}

  private async buildAgendaRows(from: string, to: string): Promise<AgendaReportItemDto[]> {
    const appointments = await this.appointmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.patient', 'patient')
      .innerJoinAndSelect('a.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .leftJoinAndSelect(
        'patient.tutors',
        'tutor',
        'tutor.is_primary = true AND tutor.deleted_at IS NULL',
      )
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .where('a.scheduled_date >= :from', { from })
      .andWhere('a.scheduled_date <= :to', { to })
      .andWhere('a.deleted_at IS NULL')
      .orderBy('a.scheduled_date', 'ASC')
      .addOrderBy('a.scheduled_time', 'ASC')
      .getMany();

    const queueEntries = await this.queueRepo
      .createQueryBuilder('q')
      .innerJoinAndSelect('q.patient', 'patient')
      .leftJoinAndSelect(
        'patient.tutors',
        'tutor',
        'tutor.is_primary = true AND tutor.deleted_at IS NULL',
      )
      .leftJoinAndSelect('tutor.client', 'client')
      .leftJoinAndSelect('client.person', 'tutorPerson')
      .innerJoinAndSelect('q.veterinarian', 'vet')
      .innerJoinAndSelect('vet.person', 'vetPerson')
      .leftJoinAndSelect('q.appointment', 'appointment')
      .where('q.date >= :from', { from })
      .andWhere('q.date <= :to', { to })
      .andWhere('q.deleted_at IS NULL')
      .orderBy('q.date', 'ASC')
      .addOrderBy('q.arrival_time', 'ASC')
      .addOrderBy('q.id', 'DESC')
      .getMany();

    const queueByAppointmentId = new Map<number, QueueEntry>();
    [...queueEntries]
      .sort((a, b) => b.id - a.id)
      .forEach((entry) => {
        if (!entry.appointmentId || queueByAppointmentId.has(entry.appointmentId)) {
          return;
        }
        queueByAppointmentId.set(entry.appointmentId, entry);
      });

    const appointmentIds = new Set(appointments.map((appointment) => appointment.id));

    const appointmentRows: AgendaReportItemDto[] = appointments.map((appointment) => {
      const queueEntry = queueByAppointmentId.get(appointment.id);
      const scheduledTime = formatTimeValue(appointment.scheduledTime);
      const endTime = formatTimeValue(appointment.endTime);
      const queueArrival = queueEntry ? formatClockTime(queueEntry.arrivalTime) : null;
      const queueScheduled = queueEntry ? formatTimeValue(queueEntry.scheduledTime) : null;

      const row = new AgendaReportItemDto();
      row.date = formatDateValue(appointment.scheduledDate);
      row.timeLabel = queueEntry
        ? [queueScheduled ? `Prog ${queueScheduled}` : null, queueArrival ? `Lleg ${queueArrival}` : null]
            .filter(Boolean)
            .join(' | ')
        : `${scheduledTime ?? 'N/A'} - ${endTime ?? 'N/A'}`;
      row.patientName = appointment.patient?.name ?? 'N/A';
      row.tutorName = fullName(
        appointment.patient?.tutors?.[0]?.client?.person?.firstName,
        appointment.patient?.tutors?.[0]?.client?.person?.lastName,
      );
      row.veterinarianName = fullName(
        appointment.veterinarian?.person?.firstName,
        appointment.veterinarian?.person?.lastName,
      );
      row.detail = `${queueEntry ? queueEntryTypeLabel(queueEntry.entryType) : 'Cita'} | ${appointment.reason ?? 'N/A'}`;
      row.status = queueEntry?.status ?? appointment.status;
      row.sourceType = queueEntry?.entryType ?? 'CON_CITA';
      row.appointmentId = appointment.id;
      row.queueEntryId = queueEntry?.id ?? null;
      row.hasAppointment = true;
      row.hasQueueEntry = Boolean(queueEntry);
      return row;
    });

    const queueOnlyRows: AgendaReportItemDto[] = queueEntries
      .filter((entry) => !entry.appointmentId || !appointmentIds.has(entry.appointmentId))
      .map((entry) => {
        const row = new AgendaReportItemDto();
        const arrivalTime = formatClockTime(entry.arrivalTime);
        const scheduledTime = formatTimeValue(entry.scheduledTime);

        row.date = formatDateValue(entry.date);
        row.timeLabel = scheduledTime
          ? `Prog ${scheduledTime} | Lleg ${arrivalTime ?? 'N/A'}`
          : `Lleg ${arrivalTime ?? 'N/A'}`;
        row.patientName = entry.patient?.name ?? 'N/A';
        row.tutorName = fullName(
          entry.patient?.tutors?.[0]?.client?.person?.firstName,
          entry.patient?.tutors?.[0]?.client?.person?.lastName,
        );
        row.veterinarianName = fullName(
          entry.veterinarian?.person?.firstName,
          entry.veterinarian?.person?.lastName,
        );
        row.detail = `${queueEntryTypeLabel(entry.entryType)} | ${entry.notes ?? 'N/A'}`;
        row.status = entry.status;
        row.sourceType = entry.entryType;
        row.appointmentId = entry.appointmentId ?? null;
        row.queueEntryId = entry.id;
        row.hasAppointment = Boolean(entry.appointmentId);
        row.hasQueueEntry = true;
        return row;
      });

    return [...appointmentRows, ...queueOnlyRows].sort((left, right) => {
      const dateCompare = left.date.localeCompare(right.date);
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = left.timeLabel.localeCompare(right.timeLabel);
      if (timeCompare !== 0) return timeCompare;
      return left.patientName.localeCompare(right.patientName);
    });
  }

  async listAgenda(from: string, to: string): Promise<AgendaReportItemDto[]> {
    return this.buildAgendaRows(from, to);
  }

  async generateAgendaPdf(from: string, to: string): Promise<Buffer> {
    const appointments = await this.buildAgendaRows(from, to);
    return this.appointmentsPdfService.render({
      from,
      to,
      appointments,
    });
  }

  async generateClinicalHistoryPdf(patientId: number): Promise<Buffer> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
      relations: ['species', 'breed', 'color', 'tutors', 'tutors.client', 'tutors.client.person'],
    });

    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    const encounters = await this.encounterRepo.find({
      where: { patientId },
      relations: ['treatments', 'treatments.items', 'surgeries', 'surgeries.catalog'],
      order: { startTime: 'ASC' },
    });

    const vaccineRecords = await this.patientVaccineRecordRepo.find({
      where: { patientId },
      relations: ['vaccine'],
      order: { applicationDate: 'ASC', createdAt: 'ASC' },
    });

    const tutors = (patient.tutors ?? [])
      .filter((tutor) => tutor.isActive && !tutor.deletedAt)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    const tutorPersonIds = tutors
      .map((tutor) => tutor.client?.personId)
      .filter((personId): personId is number => typeof personId === 'number');
    const tutorUsers = tutorPersonIds.length
      ? await this.userRepo.find({ where: { personId: In(tutorPersonIds) } })
      : [];
    const tutorEmailByPersonId = new Map<number, string>();
    tutorUsers
      .filter((user) => user.isActive && !user.deletedAt)
      .forEach((user) => {
        if (!tutorEmailByPersonId.has(user.personId)) {
          tutorEmailByPersonId.set(user.personId, user.email);
        }
      });

    const activeEncounters = encounters
      .filter((encounter) => encounter.isActive && !encounter.deletedAt)
      .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime));

    const activeVaccineRecords = vaccineRecords
      .filter((record) => record.isActive && !record.deletedAt)
      .sort((a, b) => toMillis(a.applicationDate) - toMillis(b.applicationDate));

    const allTreatments = activeEncounters.flatMap((encounter) =>
      (encounter.treatments ?? [])
        .filter((treatment) => treatment.isActive && !treatment.deletedAt)
        .map((treatment) => treatment),
    );

    const allSurgeries = activeEncounters.flatMap((encounter) =>
      (encounter.surgeries ?? [])
        .filter((surgery) => surgery.isActive && !surgery.deletedAt)
        .map((surgery) => surgery),
    );

    const payload: ClinicalHistoryPdfData = {
      patient: {
        name: noData(patient.name),
        species: noData(patient.species?.name),
        breed: noData(patient.breed?.name),
        color: noData(patient.color?.name),
        sex: patientSexLabel(patient.sex),
        birthDate: patient.birthDate ?? null,
        currentWeight: patient.currentWeight
          ? `${patient.currentWeight} kg`
          : 'No se han encontrado datos.',
        isSterilized: boolLabel(patient.isSterilized),
        microchipCode: noData(patient.microchipCode),
      },
      tutors: tutors.map((tutor) => ({
        firstName: noData(tutor.client?.person?.firstName),
        lastName: noData(tutor.client?.person?.lastName),
        documentId: noData(tutor.client?.person?.documentId),
        phone: noData(tutor.client?.person?.phone),
        email:
          tutor.client?.personId !== undefined
            ? noData(tutorEmailByPersonId.get(tutor.client.personId))
            : 'No se han encontrado datos.',
        relationship: noData(tutor.relationship),
        isPrimary: tutor.isPrimary,
      })),
      vaccines: activeVaccineRecords.map((record) => ({
        vaccineName: noData(record.vaccine?.name),
        applicationDate: record.applicationDate ?? null,
        administeredBy: noData(record.administeredBy),
        administeredAt: noData(record.administeredAt),
        origin: record.isExternal ? 'Externa' : 'Interna',
        nextDoseDate: record.nextDoseDate ?? null,
      })),
      treatments: allTreatments.map((treatment) => ({
        status: treatmentStatusLabel(treatment.status),
        startDate: treatment.startDate ?? null,
        endDate: treatment.endDate ?? null,
        generalInstructions: noData(treatment.generalInstructions),
        items: (treatment.items ?? [])
          .filter((item) => item.isActive && !item.deletedAt)
          .map((item) => ({
            medication: noData(item.medication),
            dose: noData(item.dose),
            frequency: noData(item.frequency),
            durationDays:
              item.durationDays !== null && item.durationDays !== undefined
                ? String(item.durationDays)
                : 'No se han encontrado datos.',
            notes: noData(item.notes),
            status: treatmentStatusLabel(item.status),
          })),
      })),
      surgeries: allSurgeries.map((surgery) => ({
        surgeryType: noData(surgery.catalog?.name ?? surgery.surgeryType),
        scheduledDate: surgery.scheduledDate ?? null,
        performedDate: surgery.performedDate ?? null,
        status: surgeryStatusLabel(surgery.surgeryStatus),
        description: noData(surgery.description),
        postoperativeInstructions: noData(surgery.postoperativeInstructions),
      })),
    };

    return this.clinicalHistoryPdfService.render(payload);
  }
}
