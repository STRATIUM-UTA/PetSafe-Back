import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { Usuario } from '../../entities/auth/usuario.entity.js';
import { UsuarioRefreshToken } from '../../entities/auth/usuario-refresh-token.entity.js';
import { UsuarioPasswordResetToken } from '../../entities/auth/usuario-password-reset.entity.js';
import { Persona } from '../../entities/personas/persona.entity.js';
import { Cliente } from '../../entities/personas/cliente.entity.js';
import { Role } from '../../entities/auth/role.entity.js';
import { UsuarioRol } from '../../entities/auth/usuario-rol.entity.js';
import { PersonTypeEnum, RoleEnum } from '../../common/enums/index.js';
import { RegisterDto } from '../../dto/auth/register.dto.js';
import { LoginDto } from '../../dto/auth/login.dto.js';
import { RefreshTokenDto } from '../../dto/auth/refresh-token.dto.js';
import { LogoutDto } from '../../dto/auth/logout.dto.js';
import { UpdateProfileDto } from '../../dto/auth/update-profile.dto.js';
import { UpdatePasswordDto } from '../../dto/auth/update-password.dto.js';
import { RequestPasswordResetDto } from '../../dto/auth/request-password-reset.dto.js';
import { ConfirmPasswordResetDto } from '../../dto/auth/confirm-password-reset.dto.js';
import { JwtPayload } from '../../strategies/jwt.strategy.js';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service.js';
import { AuthNotificationContentFactory } from '../notifications/templates/auth-notification-content.factory.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepo: Repository<UsuarioRol>,
    @InjectRepository(UsuarioRefreshToken)
    private readonly refreshTokenRepo: Repository<UsuarioRefreshToken>,
    @InjectRepository(UsuarioPasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<UsuarioPasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly authNotificationContentFactory: AuthNotificationContentFactory,
  ) {}

  private async generateTokens(usuario: Usuario, manager?: EntityManager) {
    const roles = usuario.usuariosRoles?.map((ur) => ur.rol.nombre) || [];

    const payload: JwtPayload = {
      sub: usuario.id,
      correo: usuario.correo,
      roles,
    };
    const accessToken = this.jwtService.sign(payload);

    // Refresh Token: 40 bytes random text
    const plainRefreshToken = crypto.randomBytes(40).toString('hex');
    // SHA-256 (suficiente para random tokens largos, rápido de buscar sin iterar como bcrypt)
    const tokenHash = crypto.createHash('sha256').update(plainRefreshToken).digest('hex');

    const expiresDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7', 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    const tokenData = {
      usuarioId: usuario.id,
      tokenHash,
      expiresAt,
    };

    if (manager) {
      const entity = manager.create(UsuarioRefreshToken, tokenData);
      await manager.save(UsuarioRefreshToken, entity);
    } else {
      const entity = this.refreshTokenRepo.create(tokenData);
      await this.refreshTokenRepo.save(entity);
    }

    return { access_token: accessToken, refresh_token: plainRefreshToken };
  }

  async register(dto: RegisterDto) {
    return this.dataSource.transaction(async (manager) => {
      // Pessimistic check: lock existing user row with this email
      // Prevents race condition where two concurrent requests create the same email
      const existing = await manager
        .createQueryBuilder(Usuario, 'u')
        .setLock('pessimistic_write')
        .where('u.correo = :correo', { correo: dto.correo })
        .andWhere('u.deleted_at IS NULL')
        .getOne();

      if (existing) {
        throw new ConflictException('El correo ya se encuentra registrado');
      }

      // 1. Create Persona (CLIENTE)
      const persona = manager.create(Persona, {
        tipoPersona: PersonTypeEnum.CLIENTE,
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        cedula: dto.cedula ?? null,
        telefono: dto.telefono ?? null,
        direccion: dto.direccion ?? null,
        genero: dto.genero ?? null,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : null,
      });
      const savedPersona = await manager.save(Persona, persona);

      // 2. Create Usuario
      const passwordHash = await this.hashPassword(dto.password);

      const usuario = manager.create(Usuario, {
        personaId: savedPersona.id,
        correo: dto.correo,
        passwordHash,
      });
      const savedUsuario = await manager.save(Usuario, usuario);

      // 3. Create Cliente profile
      const cliente = manager.create(Cliente, {
        personaId: savedPersona.id,
      });
      await manager.save(Cliente, cliente);

      // 4. Assign CLIENTE_APP role
      const clienteRole = await manager.findOne(Role, {
        where: { nombre: RoleEnum.CLIENTE_APP },
      });
      if (clienteRole) {
        const usuarioRol = manager.create(UsuarioRol, {
          usuarioId: savedUsuario.id,
          rolId: clienteRole.id,
        });
        await manager.save(UsuarioRol, usuarioRol);
        // Manually add the role to the savedUsuario for generateTokens to pick it up
        savedUsuario.usuariosRoles = savedUsuario.usuariosRoles || [];
        savedUsuario.usuariosRoles.push(usuarioRol);
        usuarioRol.rol = clienteRole; // Ensure the role object is available
      }

      // 5. Build JWT & Refresh tokens
      const tokens = await this.generateTokens(savedUsuario, manager);

      return {
        ...tokens,
        usuario: {
          id: savedUsuario.id,
          correo: savedUsuario.correo,
          nombres: savedPersona.nombres,
          apellidos: savedPersona.apellidos,
        },
      };
    });
  }

  async login(dto: LoginDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { correo: dto.correo },
      relations: ['persona', 'usuariosRoles', 'usuariosRoles.rol'],
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Update ultimo_login atomically
    await this.usuarioRepo.update(usuario.id, {
      ultimoLoginAt: new Date(),
    });

    const tokens = await this.generateTokens(usuario);

    return {
      ...tokens,
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombres: usuario.persona.nombres,
        apellidos: usuario.persona.apellidos,
      },
    };
  }

  async getProfile(userId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId },
      relations: ['persona', 'usuariosRoles', 'usuariosRoles.rol'],
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: usuario.id,
      correo: usuario.correo,
      ultimoLoginAt: usuario.ultimoLoginAt,
      persona: {
        id: usuario.persona.id,
        nombres: usuario.persona.nombres,
        apellidos: usuario.persona.apellidos,
        cedula: usuario.persona.cedula,
        telefono: usuario.persona.telefono,
        direccion: usuario.persona.direccion,
        genero: usuario.persona.genero,
        fechaNacimiento: usuario.persona.fechaNacimiento,
      },
      roles: usuario.usuariosRoles.map((ur) => ur.rol.nombre),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId },
      relations: ['persona'],
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const persona = usuario.persona;

    if (dto.nombres !== undefined) persona.nombres = dto.nombres;
    if (dto.apellidos !== undefined) persona.apellidos = dto.apellidos;
    if (dto.cedula !== undefined) persona.cedula = dto.cedula ?? null;
    if (dto.telefono !== undefined) persona.telefono = dto.telefono ?? null;
    if (dto.direccion !== undefined) persona.direccion = dto.direccion ?? null;
    if (dto.genero !== undefined) persona.genero = dto.genero ?? null;
    if (dto.fechaNacimiento !== undefined) {
      persona.fechaNacimiento = dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null;
    }

    await this.personaRepo.save(persona);

    return { message: 'Perfil actualizado exitosamente' };
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, usuario.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, usuario.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    usuario.passwordHash = await this.hashPassword(dto.newPassword);

    await this.usuarioRepo.save(usuario);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const hash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');

    const entity = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash },
      relations: ['usuario', 'usuario.persona'],
    });

    if (!entity || entity.revoked || entity.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido, expirado o revocado');
    }

    // Revoke old token (Rotación de tokens de un solo uso por seguridad)
    entity.revoked = true;
    entity.revokedAt = new Date();
    await this.refreshTokenRepo.save(entity);

    // Actualizar último login
    await this.usuarioRepo.update(entity.usuario.id, {
      ultimoLoginAt: new Date(),
    });

    // Generar nuevos tokens
    const tokens = await this.generateTokens(entity.usuario);

    return {
      ...tokens,
      usuario: {
        id: entity.usuario.id,
        correo: entity.usuario.correo,
        nombres: entity.usuario.persona.nombres,
        apellidos: entity.usuario.persona.apellidos,
      },
    };
  }

  async logout(userId: string, dto: LogoutDto) {
    const hash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');
    const entity = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash, usuarioId: userId },
    });

    if (entity && !entity.revoked) {
      entity.revoked = true;
      entity.revokedAt = new Date();
      await this.refreshTokenRepo.save(entity);
    }

    return { message: 'Sesión cerrada exitosamente en este dispositivo' };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { correo: dto.correo },
      relations: ['persona'],
    });

    const genericResponse = {
      message:
        'Si el correo existe, se ha enviado un PIN de recuperación con instrucciones.',
    };

    if (!usuario) {
      return genericResponse;
    }

    const expiresInMinutes = this.getPasswordResetExpiryMinutes();
    const maxAttempts = this.getPasswordResetMaxAttempts();
    const pinLength = this.getPasswordResetPinLength();
    const pin = this.generateNumericPin(pinLength);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const resetToken = this.passwordResetTokenRepo.create({
      usuarioId: usuario.id,
      codeHash: this.hashValue(pin),
      channel: 'email',
      destination: usuario.correo,
      expiresAt,
      maxAttempts,
    });

    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(UsuarioPasswordResetToken)
        .set({ invalidatedAt: new Date() })
        .where('usuario_id = :usuarioId', { usuarioId: usuario.id })
        .andWhere('used_at IS NULL')
        .andWhere('invalidated_at IS NULL')
        .execute();

      await manager.save(UsuarioPasswordResetToken, resetToken);
    });

    try {
      await this.notificationDispatcher.send(
        this.authNotificationContentFactory.buildPasswordResetPinMessage({
          email: usuario.correo,
          fullName: `${usuario.persona.nombres} ${usuario.persona.apellidos}`.trim(),
          pin,
          expiresInMinutes,
        }),
      );
    } catch (error) {
      await this.passwordResetTokenRepo.update(resetToken.id, {
        invalidatedAt: new Date(),
      });
      throw error;
    }

    return genericResponse;
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { correo: dto.correo },
    });

    if (!usuario) {
      throw new UnauthorizedException('El PIN es inválido o ha expirado');
    }

    const token = await this.passwordResetTokenRepo.findOne({
      where: {
        usuarioId: usuario.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!token || !this.isPasswordResetTokenUsable(token)) {
      throw new UnauthorizedException('El PIN es inválido o ha expirado');
    }

    if (token.codeHash !== this.hashValue(dto.pin)) {
      token.attempts += 1;
      if (token.attempts >= token.maxAttempts) {
        token.invalidatedAt = new Date();
      }
      await this.passwordResetTokenRepo.save(token);
      throw new UnauthorizedException('El PIN es inválido o ha expirado');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, usuario.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      token.usedAt = new Date();
      await manager.save(UsuarioPasswordResetToken, token);

      usuario.passwordHash = await this.hashPassword(dto.newPassword);
      await manager.save(Usuario, usuario);

      await manager
        .createQueryBuilder()
        .update(UsuarioRefreshToken)
        .set({
          revoked: true,
          revokedAt: new Date(),
        })
        .where('usuario_id = :usuarioId', { usuarioId: usuario.id })
        .andWhere('revoked = false')
        .execute();
    });

    return {
      message:
        'La contraseña se restableció correctamente. Inicia sesión nuevamente.',
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private generateNumericPin(length: number): string {
    let pin = '';

    while (pin.length < length) {
      pin += crypto.randomInt(0, 10).toString();
    }

    return pin.slice(0, length);
  }

  private getPasswordResetExpiryMinutes(): number {
    return parseInt(process.env.PASSWORD_RESET_PIN_EXPIRES_IN_MINUTES ?? '10', 10);
  }

  private getPasswordResetMaxAttempts(): number {
    return parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? '5', 10);
  }

  private getPasswordResetPinLength(): number {
    return parseInt(process.env.PASSWORD_RESET_PIN_LENGTH ?? '6', 10);
  }

  private isPasswordResetTokenUsable(
    token: UsuarioPasswordResetToken,
  ): boolean {
    return (
      token.usedAt === null &&
      token.invalidatedAt === null &&
      token.expiresAt >= new Date() &&
      token.attempts < token.maxAttempts
    );
  }
}
