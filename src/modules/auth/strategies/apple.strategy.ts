import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client-central-core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Strategy = require('passport-apple');

export interface AppleIdTokenPayload {
  sub?: string;
  email?: string;
}

export interface AppleProfilePayload {
  id?: string;
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      clientID: process.env.APPLE_CLIENT_ID || 'mock-apple-client-id',
      teamID: process.env.APPLE_TEAM_ID || 'mock-apple-team-id',
      keyID: process.env.APPLE_KEY_ID || 'mock-apple-key-id',
      callbackURL:
        process.env.APPLE_CALLBACK_URL ||
        'http://localhost:7001/auth/apple/callback',
      scope: ['email', 'name'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    idToken: AppleIdTokenPayload,
    profile: AppleProfilePayload,
    done: (err: Error | null, user?: any) => void,
  ): void {
    const providerAccountId = idToken?.sub || profile?.id || 'apple-user';
    const email = idToken?.email || profile?.email || '';

    const user = {
      provider: OAuthProvider.APPLE,
      providerAccountId,
      email,
      firstName: profile?.name?.firstName || 'Apple',
      lastName: profile?.name?.lastName || 'User',
    };

    done(null, user);
  }
}
