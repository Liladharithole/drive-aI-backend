import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { REQUIRE_PRODUCT_KEY } from '../../../common/decorators/require-product.decorator';
import { PrismaCentralCoreService } from '../../../prisma-central-core/prisma-central-core.service';

@Injectable()
export class ProductAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaCentralCore: PrismaCentralCoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredProductCode = this.reflector.getAllAndOverride<string>(
      REQUIRE_PRODUCT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint doesn't require a specific product entitlement, allow
    if (!requiredProductCode) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !user.uuid) {
      throw new UnauthorizedException(
        'Authentication required to access this product',
      );
    }

    // Check user product entitlement in central-core DB
    const access = await this.prismaCentralCore.userProductAccess.findFirst({
      where: {
        user: { uuid: user.uuid },
        product: { code: requiredProductCode, isActive: true },
        status: 'ACTIVE',
      },
    });

    if (!access) {
      throw new ForbiddenException(
        `Access to product '${requiredProductCode}' has been revoked, suspended, or not granted.`,
      );
    }

    return true;
  }
}
