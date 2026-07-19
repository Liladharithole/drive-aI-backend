import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { formatDateResponse } from '../../common/utils/date.util';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prismaCentralCore: PrismaCentralCoreService) {}

  /**
   * Seed default system permissions and SUPER_ADMIN role on startup.
   */
  async onModuleInit() {
    await this.seedPermissionsAndSuperAdmin();
  }

  private async seedPermissionsAndSuperAdmin() {
    const defaultPermissions = [
      {
        code: 'users.view',
        module: 'Users',
        name: 'View System Users',
        description: 'Can view user list and profiles',
      },
      {
        code: 'users.block',
        module: 'Users',
        name: 'Block/Unblock Users',
        description: 'Can block or reactivate user accounts',
      },
      {
        code: 'users.roles',
        module: 'Users',
        name: 'Assign User Roles',
        description: 'Can assign roles to users',
      },
      {
        code: 'products.create',
        module: 'Products',
        name: 'Create SaaS Products',
        description: 'Can create new SaaS products',
      },
      {
        code: 'products.disable',
        module: 'Products',
        name: 'Disable Products',
        description: 'Can enable/disable SaaS products',
      },
      {
        code: 'roles.manage',
        module: 'Roles',
        name: 'Manage System Roles',
        description: 'Can create and manage custom roles',
      },
    ];

    for (const perm of defaultPermissions) {
      const existing = await this.prismaCentralCore.permission.findUnique({
        where: { code: perm.code },
      });
      if (!existing) {
        await this.prismaCentralCore.permission.create({
          data: {
            uuid: randomUUID(),
            code: perm.code,
            module: perm.module,
            name: perm.name,
            description: perm.description,
          },
        });
      }
    }

    // Seed SUPER_ADMIN system role
    let superAdminRole = await this.prismaCentralCore.role.findUnique({
      where: { code: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      superAdminRole = await this.prismaCentralCore.role.create({
        data: {
          uuid: randomUUID(),
          code: 'SUPER_ADMIN',
          name: 'Super Administrator',
          description: 'Master system owner with unrestricted access',
          isSystem: true,
        },
      });

      // Assign all permissions to SUPER_ADMIN
      const allPerms = await this.prismaCentralCore.permission.findMany();
      for (const perm of allPerms) {
        await this.prismaCentralCore.rolePermission.create({
          data: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        });
      }
      this.logger.log('Seeded SUPER_ADMIN role with all permissions');
    }
  }

  /**
   * Create a new custom role with a set of permission codes.
   */
  async createCustomRole(dto: CreateCustomRoleDto) {
    const existingRole = await this.prismaCentralCore.role.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });

    if (existingRole) {
      throw new ConflictException(`Role '${dto.code}' already exists`);
    }

    // Verify all specified permission codes exist
    const permissions = await this.prismaCentralCore.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });

    if (permissions.length !== dto.permissionCodes.length) {
      throw new NotFoundException(
        'One or more specified permission codes do not exist',
      );
    }

    const roleUuid = randomUUID();
    const role = await this.prismaCentralCore.role.create({
      data: {
        uuid: roleUuid,
        code: dto.code.toUpperCase().trim(),
        name: dto.name.trim(),
        description: dto.description || null,
        isSystem: false,
      },
    });

    // Link permissions to new custom role
    for (const perm of permissions) {
      await this.prismaCentralCore.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }

    this.logger.log(`Created custom role: ${role.code} (${role.name})`);

    return {
      id: role.id.toString(),
      uuid: role.uuid,
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: permissions.map((p) => p.code),
    };
  }

  /**
   * List all system roles and their assigned permission codes.
   */
  async listRoles() {
    const roles = await this.prismaCentralCore.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id.toString(),
      uuid: r.uuid,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.code),
    }));
  }

  /**
   * List all available permissions grouped by module.
   */
  async listPermissions() {
    const permissions = await this.prismaCentralCore.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id.toString(),
      uuid: p.uuid,
      code: p.code,
      module: p.module,
      name: p.name,
      description: p.description,
    }));
  }

  /**
   * Assign custom roles to a user.
   */
  async assignRolesToUser(dto: AssignRolesDto) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: dto.userUuid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.prismaCentralCore.role.findMany({
      where: { code: { in: dto.roleCodes } },
    });

    if (roles.length !== dto.roleCodes.length) {
      throw new NotFoundException(
        'One or more specified role codes do not exist',
      );
    }

    // Clear existing user roles and assign new role set
    await this.prismaCentralCore.userRoleLink.deleteMany({
      where: { userId: user.id },
    });

    for (const role of roles) {
      await this.prismaCentralCore.userRoleLink.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }

    this.logger.log(
      `Assigned roles [${dto.roleCodes.join(', ')}] to user ${dto.userUuid}`,
    );

    return {
      userUuid: dto.userUuid,
      assignedRoles: roles.map((r) => r.code),
    };
  }

  /**
   * Update user status (block, suspend, activate).
   */
  async updateUserStatus(userUuid: string, dto: UpdateUserStatusDto) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prismaCentralCore.user.update({
      where: { id: user.id },
      data: { status: dto.status },
    });

    this.logger.log(`Updated user ${userUuid} status to ${dto.status}`);

    return {
      uuid: updatedUser.uuid,
      email: updatedUser.email,
      status: updatedUser.status,
    };
  }

  /**
   * Create a new SaaS Product in central-core DB.
   */
  async createProduct(dto: CreateProductDto, userTimezone = 'Asia/Kolkata') {
    const existing = await this.prismaCentralCore.product.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });

    if (existing) {
      throw new ConflictException(`Product '${dto.code}' already exists`);
    }

    const product = await this.prismaCentralCore.product.create({
      data: {
        uuid: randomUUID(),
        code: dto.code.toUpperCase().trim(),
        name: dto.name.trim(),
        description: dto.description || null,
        isActive: true,
      },
    });

    this.logger.log(`Created new product: ${product.code} (${product.name})`);

    return {
      id: product.id.toString(),
      uuid: product.uuid,
      code: product.code,
      name: product.name,
      description: product.description,
      isActive: product.isActive,
      createdAt: formatDateResponse(product.createdAt, userTimezone),
    };
  }

  /**
   * List system users with pagination.
   */
  async listUsers(page = 1, limit = 20, userTimezone = 'Asia/Kolkata') {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prismaCentralCore.user.findMany({
        skip,
        take: limit,
        include: {
          profile: true,
          roles: {
            include: { role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaCentralCore.user.count(),
    ]);

    return {
      total,
      page,
      limit,
      users: users.map((u) => ({
        id: u.id.toString(),
        uuid: u.uuid,
        email: u.email,
        status: u.status,
        displayName: u.profile?.displayName || '',
        roles: u.roles.map((r) => r.role.code),
        createdAt: formatDateResponse(u.createdAt, userTimezone),
      })),
    };
  }
}
