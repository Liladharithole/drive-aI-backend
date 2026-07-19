import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuthProvider, User, UserProfile } from '@prisma/client-central-core';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { formatDateResponse, getUtcDate } from '../../common/utils/date.util';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface OAuthUserPayload {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaCentralCore: PrismaCentralCoreService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Format User and UserProfile into standardized API response.
   */
  private formatUserResponse(user: User, profile: UserProfile | null) {
    const userTimezone = profile?.timezone || 'Asia/Kolkata';
    return {
      id: user.id.toString(),
      uuid: user.uuid,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      lastLoginAt: formatDateResponse(user.lastLoginAt, userTimezone),
      createdAt: formatDateResponse(user.createdAt, userTimezone),
      profile: profile
        ? {
            id: profile.id.toString(),
            firstName: profile.firstName,
            middleName: profile.middleName,
            lastName: profile.lastName,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            coverImageUrl: profile.coverImageUrl,
            gender: profile.gender,
            dateOfBirth: profile.dateOfBirth
              ? profile.dateOfBirth.toISOString().split('T')[0]
              : null,
            timezone: profile.timezone,
            language: profile.language,
            countryCode: profile.countryCode,
            bio: profile.bio,
          }
        : null,
    };
  }

  /**
   * Helper to generate signed 24h JWT Access Token.
   */
  private generateJwtToken(userUuid: string, email: string) {
    return this.jwtService.sign({ sub: userUuid, email }, { expiresIn: '1d' });
  }

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
    const userTimezone = dto.timezone || 'Asia/Kolkata';

    try {
      // Create User, UserProfile, and default Product Access atomically in a transaction
      const newUser = await this.prismaCentralCore.$transaction(async (tx) => {
        const user = await tx.user.create({
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
                timezone: userTimezone,
                language: dto.language || 'en',
              },
            },
          },
          include: {
            profile: true,
          },
        });

        // Automatically grant ACTIVE access to default DRIVE_AI product
        const driveProduct = await tx.product.findUnique({
          where: { code: 'DRIVE_AI' },
        });

        if (driveProduct) {
          await tx.userProductAccess.create({
            data: {
              uuid: randomUUID(),
              userId: user.id,
              productId: driveProduct.id,
              status: 'ACTIVE',
            },
          });
        }

        return user;
      });

      this.logger.log(`User created successfully: ${newUser.uuid}`);
      const token = this.generateJwtToken(newUser.uuid, newUser.email);

      return {
        accessToken: token,
        user: this.formatUserResponse(newUser, newUser.profile),
      };
    } catch (error) {
      this.logger.error('Failed to create user during signup', error);
      throw new InternalServerErrorException('Failed to create user account');
    }
  }

  /**
   * Authenticate user credentials and return a signed JWT token.
   */
  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prismaCentralCore.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'BLOCKED') {
      throw new UnauthorizedException(
        'Your account has been blocked or deleted',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update lastLoginAt timestamp in UTC
    const nowUtc = getUtcDate();
    await this.prismaCentralCore.user.update({
      where: { id: user.id },
      data: { lastLoginAt: nowUtc },
    });

    this.logger.log(`User logged in successfully: ${user.uuid}`);
    const token = this.generateJwtToken(user.uuid, user.email);

    return {
      accessToken: token,
      user: this.formatUserResponse(user, user.profile),
    };
  }

  /**
   * Handle OAuth Social Login / Registration (Google, Apple).
   */
  async validateOAuthUser(payload: OAuthUserPayload) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // 1. Check if OAuth account link already exists
    const existingOAuth =
      await this.prismaCentralCore.userOAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: payload.provider,
            providerAccountId: payload.providerAccountId,
          },
        },
        include: {
          user: {
            include: { profile: true },
          },
        },
      });

    if (existingOAuth && existingOAuth.user) {
      if (existingOAuth.user.status === 'BLOCKED') {
        throw new UnauthorizedException(
          'Your account has been blocked or deleted',
        );
      }

      const nowUtc = getUtcDate();
      await this.prismaCentralCore.user.update({
        where: { id: existingOAuth.user.id },
        data: { lastLoginAt: nowUtc },
      });

      const token = this.generateJwtToken(
        existingOAuth.user.uuid,
        existingOAuth.user.email,
      );

      return {
        accessToken: token,
        user: this.formatUserResponse(
          existingOAuth.user,
          existingOAuth.user.profile,
        ),
      };
    }

    // 2. Check if user with same email exists
    let user = await this.prismaCentralCore.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      // 3. Create new User + Profile + DRIVE_AI entitlement + OAuth Account link
      const userUuid = randomUUID();
      const firstName = payload.firstName || 'Social';
      const lastName = payload.lastName || 'User';

      user = await this.prismaCentralCore.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            uuid: userUuid,
            email: normalizedEmail,
            passwordHash: null,
            status: 'ACTIVE',
            emailVerified: true,
            profile: {
              create: {
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim(),
                avatarUrl: payload.avatarUrl || null,
              },
            },
          },
          include: { profile: true },
        });

        const driveProduct = await tx.product.findUnique({
          where: { code: 'DRIVE_AI' },
        });

        if (driveProduct) {
          await tx.userProductAccess.create({
            data: {
              uuid: randomUUID(),
              userId: newUser.id,
              productId: driveProduct.id,
              status: 'ACTIVE',
            },
          });
        }

        await tx.userOAuthAccount.create({
          data: {
            uuid: randomUUID(),
            userId: newUser.id,
            provider: payload.provider,
            providerAccountId: payload.providerAccountId,
            email: normalizedEmail,
          },
        });

        return newUser;
      });
      this.logger.log(
        `Created new OAuth user: ${user.uuid} via ${payload.provider}`,
      );
    } else {
      // Link OAuth provider to existing user
      await this.prismaCentralCore.userOAuthAccount.create({
        data: {
          uuid: randomUUID(),
          userId: user.id,
          provider: payload.provider,
          providerAccountId: payload.providerAccountId,
          email: normalizedEmail,
        },
      });
      this.logger.log(
        `Linked ${payload.provider} OAuth to existing user: ${user.uuid}`,
      );
    }

    const token = this.generateJwtToken(user.uuid, user.email);

    return {
      accessToken: token,
      user: this.formatUserResponse(user, user.profile),
    };
  }

  /**
   * Get authenticated user profile by UUID.
   */
  async getProfile(userUuid: string) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return this.formatUserResponse(user, user.profile);
  }

  /**
   * Update user profile fields.
   */
  async updateProfile(userUuid: string, dto: UpdateProfileDto) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.prismaCentralCore.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already in use');
      }
    }

    if (dto.phone !== undefined) {
      await this.prismaCentralCore.user.update({
        where: { id: user.id },
        data: { phone: dto.phone },
      });
    }

    const firstName = dto.firstName || user.profile?.firstName || '';
    const lastName = dto.lastName || user.profile?.lastName || '';
    const computedDisplayName = `${firstName} ${lastName}`.trim();

    const updatedProfile = await this.prismaCentralCore.userProfile.upsert({
      where: { userId: user.id },
      update: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.middleName !== undefined && {
          middleName: dto.middleName?.trim(),
        }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.countryCode !== undefined && { countryCode: dto.countryCode }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        displayName: computedDisplayName,
      },
      create: {
        userId: user.id,
        firstName: dto.firstName?.trim() || '',
        lastName: dto.lastName?.trim() || '',
        displayName: computedDisplayName,
        gender: dto.gender || null,
        timezone: dto.timezone || 'Asia/Kolkata',
        language: dto.language || 'en',
      },
    });

    const updatedUser = await this.prismaCentralCore.user.findUnique({
      where: { id: user.id },
    });

    return this.formatUserResponse(updatedUser!, updatedProfile);
  }

  /**
   * Soft-delete user account (sets status to BLOCKED and records deletedAt timestamp).
   */
  async softDeleteAccount(userUuid: string) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nowUtc = getUtcDate();

    await this.prismaCentralCore.user.update({
      where: { id: user.id },
      data: {
        status: 'BLOCKED',
        deletedAt: nowUtc,
      },
    });

    this.logger.log(`User account soft-deleted: ${userUuid}`);

    return {
      success: true,
      message: 'User account has been soft-deleted successfully',
    };
  }
}
