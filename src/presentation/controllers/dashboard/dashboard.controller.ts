import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from '../../../application/services/dashboard/dashboard.service.js';
import { JwtAuthGuard } from '../../../infra/security/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics() {
    return this.dashboardService.getMetrics();
  }
}
