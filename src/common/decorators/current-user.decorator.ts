import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class AuthenticatedUser {
  id!: string;
  uuid!: string;
  email!: string;
  phone?: string | null;
  status!: string;
  displayName!: string;
}

/**
 * Custom decorator to extract authenticated user details from request object.
 * Usage: `@CurrentUser() user: AuthenticatedUser` or `@CurrentUser('uuid') uuid: string`
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
