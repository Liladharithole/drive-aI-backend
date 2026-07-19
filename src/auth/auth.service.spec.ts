import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaCentralCoreService } from '../prisma-central-core/prisma-central-core.service';
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
          });
        },
      );

      const result = await service.signUp({
        email: 'john.doe@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.id).toBe('100');
      expect(result.profile?.displayName).toBe('John Doe');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john.doe@example.com',
        passwordHash: hashedPassword,
        status: 'ACTIVE',
      });

      await expect(
        service.login({
          email: 'john.doe@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return accessToken and user data on valid login', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john.doe@example.com',
        phone: null,
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        profile: {
          displayName: 'John Doe',
          avatarUrl: null,
        },
      });

      mockPrismaService.user.update.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('valid-jwt-token');

      const result = await service.login({
        email: 'john.doe@example.com',
        password: 'CorrectPassword123!',
      });

      expect(result.accessToken).toBe('valid-jwt-token');
      expect(result.user.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.user.displayName).toBe('John Doe');
    });
  });

  describe('getProfile', () => {
    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return sanitized user profile by uuid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: false,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {
          id: BigInt(10),
          firstName: 'John',
          middleName: null,
          lastName: 'Doe',
          displayName: 'John Doe',
          avatarUrl: null,
          coverImageUrl: null,
          gender: 'MALE',
          dateOfBirth: null,
          timezone: 'Asia/Kolkata',
          language: 'en',
          countryCode: 'IN',
          bio: 'Software Engineer',
        },
      });

      const result = await service.getProfile(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.id).toBe('1');
      expect(result.profile?.displayName).toBe('John Doe');
      expect(result.profile?.bio).toBe('Software Engineer');
    });
  });

  describe('updateProfile', () => {
    it('should update profile and return updated data', async () => {
      const mockUser = {
        id: BigInt(1),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john.doe@example.com',
        phone: null,
        status: 'ACTIVE',
        profile: {
          id: BigInt(10),
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => {
          return cb({
            user: { update: jest.fn().mockResolvedValue({}) },
            userProfile: { upsert: jest.fn().mockResolvedValue({}) },
          });
        },
      );

      const result = await service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        { bio: 'Updated bio text' },
      );

      expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('softDeleteAccount', () => {
    it('should soft delete user account in transaction', async () => {
      const mockUser = {
        id: BigInt(1),
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        deletedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => {
          return cb({
            user: { update: jest.fn().mockResolvedValue({}) },
            userProfile: { updateMany: jest.fn().mockResolvedValue({}) },
          });
        },
      );

      const result = await service.softDeleteAccount(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account soft-deleted successfully');
    });
  });
});
