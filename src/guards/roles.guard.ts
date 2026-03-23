import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { UsuarioRol } from '../entities/auth/usuario-rol.entity.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepo: Repository<UsuarioRol>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → allow (only JWT is needed)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('No se pudo identificar al usuario');
    }

    // Query user roles from DB (always fresh)
    const userRoles = await this.usuarioRolRepo.find({
      where: { usuarioId: userId },
      relations: ['rol'],
    });

    const userRoleNames = userRoles.map((ur) => ur.rol.nombre);
    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        'No tiene permisos suficientes para esta acción',
      );
    }

    return true;
  }
}
