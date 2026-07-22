import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaCentralCoreService } from '../../../prisma-central-core/prisma-central-core.service';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prismaCentralCore: PrismaCentralCoreService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          if (req && req.query && req.query.token) {
            return req.query.token as string;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: payload.sub },
      include: { profile: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    return {
      id: user.id.toString(),
      uuid: user.uuid,
      email: user.email,
      phone: user.phone,
      status: user.status,
      displayName: user.profile?.displayName || '',
    };
  }
}
