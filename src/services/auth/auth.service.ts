import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Usuario } from '../../entities/auth/usuario.entity.js';
import { Persona } from '../../entities/personas/persona.entity.js';
import { Cliente } from '../../entities/personas/cliente.entity.js';
import { Role } from '../../entities/auth/role.entity.js';
import { UsuarioRol } from '../../entities/auth/usuario-rol.entity.js';
import { PersonTypeEnum, RoleEnum } from '../../common/enums/index.js';
import { RegisterDto } from '../../dto/auth/register.dto.js';
import { LoginDto } from '../../dto/auth/login.dto.js';
import { JwtPayload } from '../../strategies/jwt.strategy.js';

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
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

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
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.password, salt);

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
      }

      // 5. Return JWT
      const payload: JwtPayload = {
        sub: savedUsuario.id,
        correo: savedUsuario.correo,
      };

      return {
        access_token: this.jwtService.sign(payload),
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
      relations: ['persona'],
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

    const payload: JwtPayload = {
      sub: usuario.id,
      correo: usuario.correo,
    };

    return {
      access_token: this.jwtService.sign(payload),
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
}
