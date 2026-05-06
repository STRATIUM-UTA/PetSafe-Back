import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { Appointment } from '../../../domain/entities/appointments/appointment.entity.js';
import { QueueEntry } from '../../../domain/entities/appointments/queue-entry.entity.js';
import { Encounter } from '../../../domain/entities/encounters/encounter.entity.js';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { PatientCondition } from '../../../domain/entities/patients/patient-condition.entity.js';
import { PatientVaccineRecord } from '../../../domain/entities/patients/patient-vaccine-record.entity.js';
import { PatientVaccinationPlan } from '../../../domain/entities/vaccinations/patient-vaccination-plan.entity.js';
import { User } from '../../../domain/entities/auth/user.entity.js';
import { AppointmentsPdfService } from './appointments-pdf.service.js';
import {
  ClinicalHistoryPdfData,
  ClinicalHistoryPdfService,
} from './clinical-history-pdf.service.js';
import {
  ClinicalHistoryFullPdfService,
  ClinicalHistoryFullPdfData,
} from './clinical-history-full-pdf.service.js';
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

function calculateAgeYears(raw: string | Date | null | undefined): number | null {
  if (!raw) return null;

  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    years -= 1;
  }

  return Math.max(years, 0);
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
    @InjectRepository(PatientCondition)
    private readonly patientConditionRepo: Repository<PatientCondition>,
    @InjectRepository(PatientVaccineRecord)
    private readonly patientVaccineRecordRepo: Repository<PatientVaccineRecord>,
    @InjectRepository(PatientVaccinationPlan)
    private readonly patientVaccinationPlanRepo: Repository<PatientVaccinationPlan>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly appointmentsPdfService: AppointmentsPdfService,
    private readonly clinicalHistoryPdfService: ClinicalHistoryPdfService,
    private readonly clinicalHistoryFullPdfService: ClinicalHistoryFullPdfService,
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
      relations: [
        'species', 'breed', 'color',
        'tutors', 'tutors.client', 'tutors.client.person',
      ],
    });

    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Paciente no encontrado.');
    }

    const [encounters, conditions, vaccinationPlan] = await Promise.all([
      this.encounterRepo.find({
        where: { patientId, deletedAt: IsNull() },
        relations: [
          'vet', 'vet.person',
          'consultationReason',
          'anamnesis',
          'clinicalExam',
          'environmentalData',
          'clinicalImpression',
          'plan',
          'treatments', 'treatments.items',
          'vaccinationEvents', 'vaccinationEvents.vaccine',
          'dewormingEvents', 'dewormingEvents.product',
          'surgeries', 'surgeries.catalog',
          'procedures',
        ],
        order: { startTime: 'DESC' },
      }),
      this.patientConditionRepo.find({
        where: { patientId, deletedAt: IsNull() },
      }),
      this.patientVaccinationPlanRepo.findOne({
        where: { patientId, deletedAt: IsNull() },
        relations: ['schemeVersion', 'schemeVersion.scheme', 'doses', 'doses.vaccine'],
        order: { assignedAt: 'DESC' },
      }),
    ]);

    const tutors = (patient.tutors ?? [])
      .filter((tutor) => tutor.isActive && !tutor.deletedAt)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    const tutorPersonIds = tutors
      .map((tutor) => tutor.client?.personId)
      .filter((id): id is number => typeof id === 'number');
    const tutorUsers = tutorPersonIds.length
      ? await this.userRepo.find({ where: { personId: In(tutorPersonIds) } })
      : [];
    const tutorEmailByPersonId = new Map<number, string>();
    tutorUsers
      .filter((u) => u.isActive && !u.deletedAt)
      .forEach((u) => {
        if (!tutorEmailByPersonId.has(u.personId)) tutorEmailByPersonId.set(u.personId, u.email);
      });

    const payload: ClinicalHistoryFullPdfData = {
      patient: {
        id: patient.id,
        name: noData(patient.name),
        species: noData(patient.species?.name),
        breed: noData(patient.breed?.name),
        color: noData(patient.color?.name),
        sex: patientSexLabel(patient.sex),
        ageYears: calculateAgeYears(patient.birthDate),
        birthDate: patient.birthDate ?? null,
        currentWeight: patient.currentWeight ? `${patient.currentWeight} kg` : '',
        isSterilized: patient.isSterilized,
        microchipCode: patient.microchipCode ?? '',
        generalAllergies: patient.generalAllergies ?? '',
        generalHistory: patient.generalHistory ?? '',
      },
      tutors: tutors.map((tutor) => ({
        fullName: fullName(tutor.client?.person?.firstName, tutor.client?.person?.lastName),
        documentId: tutor.client?.person?.documentId ?? '',
        phone: tutor.client?.person?.phone ?? '',
        email: tutor.client?.personId !== undefined
          ? (tutorEmailByPersonId.get(tutor.client.personId) ?? '')
          : '',
        relationship: tutor.relationship ?? '',
        isPrimary: tutor.isPrimary,
      })),
      conditions: conditions.map((c) => ({ name: c.name, type: c.type, active: c.isActive })),
      vaccinationPlan: vaccinationPlan
        ? {
            schemeName: vaccinationPlan.schemeVersion?.scheme?.name ?? '',
            schemeVersion: vaccinationPlan.schemeVersion?.version ?? 0,
            status: vaccinationPlan.status,
            doses: (vaccinationPlan.doses ?? [])
              .sort((a, b) => a.doseOrder - b.doseOrder)
              .map((d) => ({
                doseOrder: d.doseOrder,
                vaccineName: d.vaccine?.name ?? '',
                status: d.status,
                expectedDate: d.expectedDate ? String(d.expectedDate) : null,
                appliedAt: d.appliedAt ? String(d.appliedAt) : null,
              })),
          }
        : null,
      encounters: encounters.map((enc) => ({
        id: enc.id,
        startTime: enc.startTime,
        endTime: enc.endTime,
        vetName: fullName(enc.vet?.person?.firstName, enc.vet?.person?.lastName),
        status: enc.status,
        generalNotes: enc.generalNotes ?? '',
        consultationReason: enc.consultationReason
          ? {
              reason: enc.consultationReason.consultationReason ?? '',
              currentIllnessHistory: enc.consultationReason.currentIllnessHistory ?? '',
              previousDiagnoses: enc.consultationReason.referredPreviousDiagnoses ?? '',
              previousTreatments: enc.consultationReason.referredPreviousTreatments ?? '',
            }
          : null,
        clinicalExam: enc.clinicalExam
          ? {
              temperatureC: enc.clinicalExam.temperatureC != null ? String(enc.clinicalExam.temperatureC) : '',
              heartRate: enc.clinicalExam.heartRate != null ? String(enc.clinicalExam.heartRate) : '',
              pulse: enc.clinicalExam.pulse != null ? String(enc.clinicalExam.pulse) : '',
              respiratoryRate: enc.clinicalExam.respiratoryRate != null ? String(enc.clinicalExam.respiratoryRate) : '',
              weightKg: enc.clinicalExam.weightKg != null ? String(enc.clinicalExam.weightKg) : '',
              mucousMembranes: enc.clinicalExam.mucousMembranes ?? '',
              lymphNodes: enc.clinicalExam.lymphNodes ?? '',
              hydration: enc.clinicalExam.hydration ?? '',
              crtSeconds: enc.clinicalExam.crtSeconds != null ? String(enc.clinicalExam.crtSeconds) : '',
              notes: enc.clinicalExam.examNotes ?? '',
            }
          : null,
        anamnesis: enc.anamnesis
          ? {
              problemStart: enc.anamnesis.problemStartText ?? '',
              previousSurgeries: enc.anamnesis.previousSurgeriesText ?? '',
              howProblemStarted: enc.anamnesis.howProblemStartedText ?? '',
              vaccinesUpToDate: boolLabel(enc.anamnesis.vaccinesUpToDate),
              dewormingUpToDate: boolLabel(enc.anamnesis.dewormingUpToDate),
              hasPetAtHome: boolLabel(enc.anamnesis.hasPetAtHome),
              medication: enc.anamnesis.administeredMedicationText ?? '',
              appetite: enc.anamnesis.appetiteStatus ?? '',
              waterIntake: enc.anamnesis.waterIntakeStatus ?? '',
              feces: enc.anamnesis.fecesText ?? '',
              vomit: enc.anamnesis.vomitText ?? '',
              bowelMovements: enc.anamnesis.numberOfBowelMovements != null ? String(enc.anamnesis.numberOfBowelMovements) : '',
              urine: enc.anamnesis.urineText ?? '',
              respiratoryProblems: enc.anamnesis.respiratoryProblemsText ?? '',
              difficultyWalking: enc.anamnesis.difficultyWalkingText ?? '',
              notes: enc.anamnesis.notes ?? '',
            }
          : null,
        environmentalData: enc.environmentalData
          ? {
              environment: enc.environmentalData.environmentNotes ?? '',
              nutrition: enc.environmentalData.nutritionNotes ?? '',
              lifestyle: enc.environmentalData.lifestyleNotes ?? '',
              feedingType: enc.environmentalData.feedingTypeNotes ?? '',
            }
          : null,
        clinicalImpression: enc.clinicalImpression
          ? {
              presumptiveDiagnosis: enc.clinicalImpression.presumptiveDiagnosis ?? '',
              differentialDiagnosis: enc.clinicalImpression.differentialDiagnosis ?? '',
              prognosis: enc.clinicalImpression.prognosis ?? '',
              clinicalNotes: enc.clinicalImpression.clinicalNotes ?? '',
            }
          : null,
        plan: enc.plan
          ? {
              clinicalPlan: enc.plan.clinicalPlan ?? '',
              followUpDate: null,
              planNotes: enc.plan.planNotes ?? '',
            }
          : null,
        treatments: (enc.treatments ?? [])
          .filter((t) => !t.deletedAt)
          .map((t) => ({
            status: treatmentStatusLabel(t.status),
            startDate: t.startDate ? String(t.startDate) : null,
            endDate: t.endDate ? String(t.endDate) : null,
            instructions: t.generalInstructions ?? '',
            items: (t.items ?? [])
              .filter((item) => !item.deletedAt)
              .map((item) => ({
                medication: item.medication,
                dose: item.dose,
                frequency: item.frequency,
                durationDays: String(item.durationDays),
                route: item.administrationRoute ?? '',
              })),
          })),
        vaccinations: (enc.vaccinationEvents ?? [])
          .filter((v) => !v.deletedAt)
          .map((v) => ({
            vaccineName: v.vaccine?.name ?? '',
            applicationDate: v.applicationDate ? String(v.applicationDate) : null,
            nextDate: v.suggestedNextDate ? String(v.suggestedNextDate) : null,
            notes: v.notes ?? '',
          })),
        dewormings: (enc.dewormingEvents ?? [])
          .filter((d) => !d.deletedAt)
          .map((d) => ({
            productName: d.product?.name ?? '',
            applicationDate: d.applicationDate ? String(d.applicationDate) : null,
            nextDate: d.suggestedNextDate ? String(d.suggestedNextDate) : null,
            notes: d.notes ?? '',
          })),
        surgeries: (enc.surgeries ?? [])
          .filter((s) => !s.deletedAt)
          .map((s) => ({
            type: s.catalog?.name ?? s.surgeryType,
            performedDate: s.performedDate ? String(s.performedDate) : null,
            status: surgeryStatusLabel(s.surgeryStatus),
            description: s.description ?? '',
            postOp: s.postoperativeInstructions ?? '',
          })),
        procedures: (enc.procedures ?? [])
          .filter((p) => !p.deletedAt)
          .map((p) => ({
            type: p.procedureType,
            performedDate: p.performedDate ? String(p.performedDate) : null,
            description: p.description ?? '',
            result: p.result ?? '',
          })),
      })),
    };

    return this.clinicalHistoryFullPdfService.render(payload);
  }
}
