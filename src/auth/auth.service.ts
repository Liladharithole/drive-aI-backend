import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getUtcDate } from '../common/utils/date.util';
import { PrismaCentralCoreService } from '../prisma-central-core/prisma-central-core.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaCentralCore: PrismaCentralCoreService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user and create their profile in the central-core database.
   */
  async signUp(dto: SignUpDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await this.prismaCentralCore.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new ConflictException('User with this email already exists');
      }
      if (dto.phone && existingUser.phone === dto.phone) {
        throw new ConflictException(
          'User with this phone number already exists',
        );
      }
    }

    // Hash password securely
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const uuid = randomUUID();

    try {
      // Create User and UserProfile atomically in a transaction
      const newUser = await this.prismaCentralCore.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            uuid,
            email: normalizedEmail,
            phone: dto.phone || null,
            passwordHash,
            status: 'ACTIVE',
            profile: {
              create: {
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                middleName: dto.middleName?.trim() || null,
                displayName: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
                gender: dto.gender || null,
                timezone: dto.timezone || 'Asia/Kolkata',
                language: dto.language || 'en',
              },
            },
          },
          include: {
            profile: true,
          },
        });
      });

      this.logger.log(`User created successfully: ${newUser.uuid}`);

      // Sanitize output (exclude passwordHash, safely convert BigInt to string)
      return {
        id: newUser.id.toString(),
        uuid: newUser.uuid,
        email: newUser.email,
        phone: newUser.phone,
        status: newUser.status,
        emailVerified: newUser.emailVerified,
        phoneVerified: newUser.phoneVerified,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        profile: newUser.profile
          ? {
              id: newUser.profile.id.toString(),
              firstName: newUser.profile.firstName,
              middleName: newUser.profile.middleName,
              lastName: newUser.profile.lastName,
              displayName: newUser.profile.displayName,
              gender: newUser.profile.gender,
              timezone: newUser.profile.timezone,
              language: newUser.profile.language,
            }
          : null,
      };
    } catch (error) {
      this.logger.error('Failed to create user during signup', error);
      throw new InternalServerErrorException('Failed to create user account');
    }
  }

  /**
   * Authenticate a user by credentials and return a signed JWT access token.
   */
  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // 1. Fetch user from central-core DB
    const user = await this.prismaCentralCore.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    // 2. Validate password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Update lastLoginAt in UTC
    const nowUtc = getUtcDate();
    await this.prismaCentralCore.user.update({
      where: { id: user.id },
      data: { lastLoginAt: nowUtc },
    });

    // 4. Generate JWT payload & sign token
    const payload = {
      sub: user.uuid,
      email: user.email,
    };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User logged in successfully: ${user.uuid}`);

    return {
      accessToken,
      user: {
        id: user.id.toString(),
        uuid: user.uuid,
        email: user.email,
        phone: user.phone,
        status: user.status,
        displayName: user.profile?.displayName || '',
        avatarUrl: user.profile?.avatarUrl || null,
        lastLoginAt: nowUtc,
      },
    };
  }

  /**
   * Fetch user profile data by user UUID.
   */
  async getProfile(uuid: string) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid },
      include: { profile: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user.id.toString(),
      uuid: user.uuid,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile
        ? {
            id: user.profile.id.toString(),
            firstName: user.profile.firstName,
            middleName: user.profile.middleName,
            lastName: user.profile.lastName,
            displayName: user.profile.displayName,
            avatarUrl: user.profile.avatarUrl,
            coverImageUrl: user.profile.coverImageUrl,
            gender: user.profile.gender,
            dateOfBirth: user.profile.dateOfBirth,
            timezone: user.profile.timezone,
            language: user.profile.language,
            countryCode: user.profile.countryCode,
            bio: user.profile.bio,
          }
        : null,
    };
  }

  /**
   * Update profile information for an authenticated user.
   */
  async updateProfile(uuid: string, dto: UpdateProfileDto) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid },
      include: { profile: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User profile not found');
    }

    // Check if phone number is being changed to an existing phone
    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.prismaCentralCore.user.findFirst({
        where: { phone: dto.phone, id: { not: user.id } },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number is already in use');
      }
    }

    // Determine displayName
    const newFirstName = dto.firstName ?? user.profile?.firstName ?? '';
    const newLastName = dto.lastName ?? user.profile?.lastName ?? '';
    const computedDisplayName =
      dto.displayName || `${newFirstName} ${newLastName}`.trim();

    await this.prismaCentralCore.$transaction(async (tx) => {
      // Update phone if provided
      if (dto.phone !== undefined) {
        await tx.user.update({
          where: { id: user.id },
          data: { phone: dto.phone || null },
        });
      }

      // Upsert profile
      await tx.userProfile.upsert({
        where: { userId: user.id },
        update: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          displayName: computedDisplayName,
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
          ...(dto.coverImageUrl !== undefined && {
            coverImageUrl: dto.coverImageUrl,
          }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.dateOfBirth !== undefined && {
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.language !== undefined && { language: dto.language }),
          ...(dto.countryCode !== undefined && {
            countryCode: dto.countryCode,
          }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
        },
        create: {
          userId: user.id,
          firstName: dto.firstName || '',
          lastName: dto.lastName || '',
          middleName: dto.middleName || null,
          displayName: computedDisplayName,
          avatarUrl: dto.avatarUrl || null,
          coverImageUrl: dto.coverImageUrl || null,
          gender: dto.gender || null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          timezone: dto.timezone || 'Asia/Kolkata',
          language: dto.language || 'en',
          countryCode: dto.countryCode || null,
          bio: dto.bio || null,
        },
      });
    });

    this.logger.log(`User profile updated: ${uuid}`);
    return this.getProfile(uuid);
  }

  /**
   * Soft delete user account and profile by setting deletedAt timestamp and BLOCKED status.
   */
  async softDeleteAccount(uuid: string) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User profile not found');
    }

    const nowUtc = getUtcDate();

    await this.prismaCentralCore.$transaction(async (tx) => {
      // Mark user as BLOCKED and soft deleted
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'BLOCKED',
          deletedAt: nowUtc,
        },
      });

      // Mark user profile as soft deleted
      await tx.userProfile.updateMany({
        where: { userId: user.id },
        data: { deletedAt: nowUtc },
      });
    });

    this.logger.log(`User account soft-deleted: ${uuid}`);
    return {
      success: true,
      message: 'Account soft-deleted successfully',
      deletedAt: nowUtc,
    };
  }
}
