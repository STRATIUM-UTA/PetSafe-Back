import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './infra/config/typeorm.config.js';
import { AuthModule } from './application/modules/auth/auth.module.js';
import { PatientsModule } from './application/modules/patients/patients.module.js';
import { ClientsModule } from './application/modules/clients/clients.module.js';
import { SpeciesModule } from './application/modules/species/species.module.js';
import { BreedsModule } from './application/modules/breeds/breeds.module.js';
import { ColorsModule } from './application/modules/colors/colors.module.js';
import { ZootecnicalGroupsModule } from './application/modules/zootecnical-groups/zootecnical-groups.module.js';
import { AppointmentsModule } from './application/modules/appointments/appointments.module.js';
import { QueueModule } from './application/modules/queue/queue.module.js';
import { ReportsModule } from './application/modules/reports/reports.module.js';
import { EncountersModule } from './application/modules/encounters/encounters.module.js';
import { DashboardModule } from './application/modules/dashboard/dashboard.module.js';
import { AdoptionsModule } from './application/modules/adoptions/adoptions.module.js';
import { MetadataModule } from './application/modules/metadata/metadata.module.js';
import { VaccinationModule } from './application/modules/vaccinations/vaccination.module.js';

import { UsersModule } from './application/modules/users/users.module.js';
import { ProcedureSurgeryCatalogModule } from './application/modules/catalogs/procedure-surgery-catalog.module.js';
import { HealthController } from './presentation/controllers/health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    UsersModule,
    AuthModule,
    PatientsModule,
    ClientsModule,
    SpeciesModule,
    BreedsModule,
    ColorsModule,
    ZootecnicalGroupsModule,
    AppointmentsModule,
    QueueModule,
    ReportsModule,
    EncountersModule,
    DashboardModule,
    AdoptionsModule,
    MetadataModule,
    VaccinationModule,
    ProcedureSurgeryCatalogModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
