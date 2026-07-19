import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client-central-core';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:7001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { id, name, emails, photos } = profile;

    const user = {
      provider: OAuthProvider.GOOGLE,
      providerAccountId: id,
      email: emails && emails[0] ? emails[0].value : '',
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      avatarUrl: photos && photos[0] ? photos[0].value : undefined,
    };

    done(null, user);
  }
}
