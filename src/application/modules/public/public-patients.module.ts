import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity.js';
import { MediaFile } from '../../../domain/entities/media/media-file.entity.js';
import { PublicPatientsService } from '../../services/public/public-patients.service.js';
import { PublicPatientsController } from '../../../presentation/controllers/public/public-patients.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, MediaFile])],
  controllers: [PublicPatientsController],
  providers: [PublicPatientsService],
})
export class PublicPatientsModule {}
