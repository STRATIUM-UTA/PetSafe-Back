import { Controller, Get, Param } from '@nestjs/common';
import { PublicPatientsService } from '../../../application/services/public/public-patients.service.js';
import { PublicPatientProfileResponse } from '../../dto/public/public-patient-response.dto.js';

@Controller('public/patients')
export class PublicPatientsController {
  constructor(private readonly publicPatientsService: PublicPatientsService) {}

  @Get(':qrToken')
  findByQrToken(@Param('qrToken') qrToken: string): Promise<PublicPatientProfileResponse> {
    return this.publicPatientsService.findByQrToken(qrToken);
  }
}
