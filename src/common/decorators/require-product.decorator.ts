import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PRODUCT_KEY = 'require_product';

/**
 * Decorator to enforce Product Entitlement access check on a controller or route handler.
 * Usage: `@RequireProduct('DRIVE_AI')`
 */
export const RequireProduct = (productCode: string) =>
  SetMetadata(REQUIRE_PRODUCT_KEY, productCode);
