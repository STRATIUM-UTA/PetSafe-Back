import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from '../base-audit.entity.js';
import { AppointmentRequestStatusEnum } from '../../enums/index.js';
import { User } from '../auth/user.entity.js';
import { Patient } from '../patients/patient.entity.js';

@Entity({ name: 'appointment_requests' })
export class AppointmentRequest extends BaseAuditEntity {
  @Column({ name: 'client_user_id', type: 'int' })
  clientUserId!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_user_id' })
  clientUser!: User;

  @Column({ name: 'patient_id', type: 'int', nullable: true })
  patientId!: number | null;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'preferred_date', type: 'date', nullable: true })
  preferredDate!: string | null;

  @Column({ name: 'preferred_time', type: 'time without time zone', nullable: true })
  preferredTime!: string | null;

  @Column({
    type: 'enum',
    enum: AppointmentRequestStatusEnum,
    enumName: 'appointment_request_status_enum',
    default: AppointmentRequestStatusEnum.PENDIENTE,
  })
  status!: AppointmentRequestStatusEnum;

  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes!: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'int', nullable: true })
  reviewedByUserId!: number | null;
}
