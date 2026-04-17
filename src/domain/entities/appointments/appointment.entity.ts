import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { AppointmentReasonEnum, AppointmentStatusEnum } from '../../enums/index.js';
import { Patient } from '../patients/patient.entity.js';
import { Employee } from '../persons/employee.entity.js';
import { User } from '../auth/user.entity.js';

@Entity({ name: 'appointments' })
export class Appointment extends BaseAuditEntity {
  @Column({ name: 'patient_id', type: 'int' })
  patientId!: number;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  // Columna en BD: vet_id  (la migración usa vet_id, NO veterinarian_id)
  @Column({ name: 'vet_id', type: 'int' })
  vetId!: number;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vet_id' })
  veterinarian!: Employee;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate!: string;

  @Column({ name: 'scheduled_time', type: 'time without time zone' })
  scheduledTime!: string;

  @Column({ name: 'end_time', type: 'time without time zone' })
  endTime!: string;

  @Column({
    name: 'reason',
    type: 'enum',
    enum: AppointmentReasonEnum,
    enumName: 'appointment_reason_enum',
  })
  reason!: AppointmentReasonEnum;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // Columna en BD: status  (la migración usa status, NO appointment_status)
  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentStatusEnum,
    enumName: 'appointment_status_enum',
    default: AppointmentStatusEnum.PROGRAMADA,
  })
  status!: AppointmentStatusEnum;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User | null;
}
