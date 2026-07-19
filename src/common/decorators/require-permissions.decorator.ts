import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/**
 * Decorator to enforce Dynamic RBAC permission checks on controller routes.
 * Usage: `@RequirePermissions('users.view', 'users.update')`
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
