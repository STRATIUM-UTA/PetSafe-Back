import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from '../services/auth/auth.service.js';
import { AuthController } from '../controllers/auth/auth.controller.js';
import { JwtStrategy } from '../strategies/jwt.strategy.js';
import { RolesGuard } from '../guards/roles.guard.js';

import { Usuario } from '../entities/auth/usuario.entity.js';
import { Role } from '../entities/auth/role.entity.js';
import { UsuarioRol } from '../entities/auth/usuario-rol.entity.js';
import { UsuarioRefreshToken } from '../entities/auth/usuario-refresh-token.entity.js';
import { Persona } from '../entities/personas/persona.entity.js';
import { Cliente } from '../entities/personas/cliente.entity.js';
import { UsuarioPasswordResetToken } from '../entities/auth/usuario-password-reset.entity.js';
import { NotificationsModule } from './notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Role,
      UsuarioRol,
      UsuarioRefreshToken,
      UsuarioPasswordResetToken,
      Persona,
      Cliente,
    ]),
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'fallback_secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PassportModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
