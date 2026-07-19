import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client-central-core';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaCentralCore = {
    permission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    rolePermission: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    userRoleLink: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaCentralCoreService,
          useValue: mockPrismaCentralCore,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCustomRole', () => {
    it('should throw ConflictException if role code already exists', async () => {
      mockPrismaCentralCore.role.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'SUPPORT_AGENT',
      });

      await expect(
        service.createCustomRole({
          code: 'SUPPORT_AGENT',
          name: 'Customer Support Agent',
          permissionCodes: ['users.view'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create custom role with assigned permissions', async () => {
      mockPrismaCentralCore.role.findUnique.mockResolvedValue(null);
      mockPrismaCentralCore.permission.findMany.mockResolvedValue([
        { id: BigInt(10), code: 'users.view' },
      ]);
      mockPrismaCentralCore.role.create.mockResolvedValue({
        id: BigInt(100),
        uuid: 'role-uuid-100',
        code: 'SUPPORT_AGENT',
        name: 'Customer Support Agent',
        description: 'Support staff',
        isSystem: false,
      });

      const result = await service.createCustomRole({
        code: 'SUPPORT_AGENT',
        name: 'Customer Support Agent',
        permissionCodes: ['users.view'],
      });

      expect(result.code).toBe('SUPPORT_AGENT');
      expect(result.permissions).toContain('users.view');
    });
  });

  describe('updateUserStatus', () => {
    it('should throw NotFoundException if target user does not exist', async () => {
      mockPrismaCentralCore.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserStatus('invalid-uuid', {
          status: UserStatus.BLOCKED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user status to BLOCKED', async () => {
      mockPrismaCentralCore.user.findUnique.mockResolvedValue({
        id: BigInt(5),
        uuid: 'user-uuid-5',
      });
      mockPrismaCentralCore.user.update.mockResolvedValue({
        id: BigInt(5),
        uuid: 'user-uuid-5',
        email: 'blocked@example.com',
        status: UserStatus.BLOCKED,
      });

      const result = await service.updateUserStatus('user-uuid-5', {
        status: UserStatus.BLOCKED,
      });

      expect(result.status).toBe(UserStatus.BLOCKED);
    });
  });
});
