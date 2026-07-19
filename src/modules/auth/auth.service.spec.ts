import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthProvider } from '@prisma/client-central-core';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userProfile: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userOAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaCentralCoreService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should throw ConflictException if user email already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: BigInt(1),
        email: 'test@example.com',
      });

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create user and user profile', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const mockCreatedUser = {
        id: BigInt(100),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john.doe@example.com',
        phone: null,
        status: 'ACTIVE',
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {
          id: BigInt(101),
          firstName: 'John',
          middleName: null,
          lastName: 'Doe',
          displayName: 'John Doe',
          gender: null,
          timezone: 'Asia/Kolkata',
          language: 'en',
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => {
          return cb({
            user: {
              create: jest.fn().mockResolvedValue(mockCreatedUser),
            },
            product: {
              findUnique: jest.fn().mockResolvedValue({
                id: BigInt(1),
                code: 'DRIVE_AI',
              }),
            },
            userProductAccess: {
              create: jest.fn().mockResolvedValue({ id: BigInt(10) }),
            },
          });
        },
      );

      const result = await service.signUp({
        email: 'john.doe@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.user.id).toBe('100');
      expect(result.user.profile?.displayName).toBe('John Doe');
    });
  });

  describe('validateOAuthUser', () => {
    it('should authenticate user if OAuth account exists', async () => {
      const mockOAuthAccount = {
        id: BigInt(1),
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-12345',
        user: {
          id: BigInt(10),
          uuid: 'user-uuid-10',
          email: 'googleuser@example.com',
          status: 'ACTIVE',
          profile: {
            id: BigInt(20),
            firstName: 'Google',
            lastName: 'User',
            displayName: 'Google User',
          },
        },
      };

      mockPrismaService.userOAuthAccount.findUnique.mockResolvedValue(
        mockOAuthAccount,
      );
      mockPrismaService.user.update.mockResolvedValue(mockOAuthAccount.user);

      const result = await service.validateOAuthUser({
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-12345',
        email: 'googleuser@example.com',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.uuid).toBe('user-uuid-10');
    });
  });
});
