import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../../../common/decorators/require-permissions.decorator';
import { PrismaCentralCoreService } from '../../../prisma-central-core/prisma-central-core.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaCentralCore: PrismaCentralCoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint doesn't require specific permissions, allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !user.uuid) {
      throw new UnauthorizedException('Authentication required');
    }

    // Fetch user roles and permissions from central-core DB
    const userRoleLinks = await this.prismaCentralCore.userRoleLink.findMany({
      where: {
        user: { uuid: user.uuid },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Super Admin bypass check
    const isSuperAdmin = userRoleLinks.some(
      (link) => link.role.code === 'SUPER_ADMIN',
    );
    if (isSuperAdmin) {
      return true;
    }

    // Collect all permission codes assigned to the user
    const userPermissionCodes = new Set<string>();
    for (const link of userRoleLinks) {
      for (const rolePerm of link.role.permissions) {
        userPermissionCodes.add(rolePerm.permission.code);
      }
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissionCodes.has(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
