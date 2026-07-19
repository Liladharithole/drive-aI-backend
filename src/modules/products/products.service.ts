import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ProductAccessStatus } from '@prisma/client-central-core';
import { randomUUID } from 'node:crypto';
import { formatDateResponse, getUtcDate } from '../../common/utils/date.util';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { GrantProductAccessDto } from './dto/grant-product-access.dto';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prismaCentralCore: PrismaCentralCoreService) {}

  /**
   * Seed default products on application startup if missing.
   */
  async onModuleInit() {
    await this.seedDefaultProducts();
  }

  private async seedDefaultProducts() {
    const defaultProducts = [
      {
        code: 'DRIVE_AI',
        name: 'AI Drive SaaS Platform',
        description:
          'Cloud document storage with document intelligence and AI chat.',
      },
      {
        code: 'FINANCE_LEDGER',
        name: 'Payment Orchestration & Ledger Engine',
        description:
          'Multi-gateway routing and double-entry accounting ledger.',
      },
    ];

    for (const prod of defaultProducts) {
      const existing = await this.prismaCentralCore.product.findUnique({
        where: { code: prod.code },
      });

      if (!existing) {
        await this.prismaCentralCore.product.create({
          data: {
            uuid: randomUUID(),
            code: prod.code,
            name: prod.name,
            description: prod.description,
            isActive: true,
          },
        });
        this.logger.log(`Seeded default product: ${prod.code} (${prod.name})`);
      }
    }
  }

  /**
   * Automatically grant default access to a product upon user registration.
   */
  async autoGrantDefaultProduct(userUuid: string, productCode = 'DRIVE_AI') {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
    });
    const product = await this.prismaCentralCore.product.findUnique({
      where: { code: productCode },
    });

    if (!user || !product) {
      return null;
    }

    const existingAccess =
      await this.prismaCentralCore.userProductAccess.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId: product.id,
          },
        },
      });

    if (!existingAccess) {
      await this.prismaCentralCore.userProductAccess.create({
        data: {
          uuid: randomUUID(),
          userId: user.id,
          productId: product.id,
          status: 'ACTIVE',
        },
      });
      this.logger.log(
        `Granted product access '${productCode}' to user ${userUuid}`,
      );
    }
  }

  /**
   * List all available products.
   */
  async listProducts(userTimezone = 'Asia/Kolkata') {
    const products = await this.prismaCentralCore.product.findMany({
      orderBy: { code: 'asc' },
    });

    return products.map((p) => ({
      id: p.id.toString(),
      uuid: p.uuid,
      code: p.code,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      createdAt: formatDateResponse(p.createdAt, userTimezone),
      updatedAt: formatDateResponse(p.updatedAt, userTimezone),
    }));
  }

  /**
   * Fetch active & revoked product entitlements for a specific user.
   */
  async getUserEntitlements(userUuid: string, userTimezone = 'Asia/Kolkata') {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: userUuid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accesses = await this.prismaCentralCore.userProductAccess.findMany({
      where: { userId: user.id },
      include: { product: true },
    });

    return accesses.map((a) => ({
      id: a.id.toString(),
      uuid: a.uuid,
      productCode: a.product.code,
      productName: a.product.name,
      status: a.status,
      grantedAt: formatDateResponse(a.grantedAt, userTimezone),
      expiresAt: formatDateResponse(a.expiresAt, userTimezone),
      revokedAt: formatDateResponse(a.revokedAt, userTimezone),
    }));
  }

  /**
   * Grant, suspend, or revoke a user's product access (Admin Operation).
   */
  async grantOrUpdateProductAccess(
    dto: GrantProductAccessDto,
    userTimezone = 'Asia/Kolkata',
  ) {
    const user = await this.prismaCentralCore.user.findUnique({
      where: { uuid: dto.userUuid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const product = await this.prismaCentralCore.product.findUnique({
      where: { code: dto.productCode },
    });

    if (!product) {
      throw new NotFoundException(`Product '${dto.productCode}' not found`);
    }

    const targetStatus = dto.status || ProductAccessStatus.ACTIVE;
    const nowUtc = getUtcDate();

    const access = await this.prismaCentralCore.userProductAccess.upsert({
      where: {
        userId_productId: {
          userId: user.id,
          productId: product.id,
        },
      },
      update: {
        status: targetStatus,
        ...(targetStatus === ProductAccessStatus.REVOKED && {
          revokedAt: nowUtc,
        }),
      },
      create: {
        uuid: randomUUID(),
        userId: user.id,
        productId: product.id,
        status: targetStatus,
        ...(targetStatus === ProductAccessStatus.REVOKED && {
          revokedAt: nowUtc,
        }),
      },
      include: { product: true },
    });

    this.logger.log(
      `Updated product entitlement '${product.code}' for user ${dto.userUuid} to ${targetStatus}`,
    );

    return {
      id: access.id.toString(),
      uuid: access.uuid,
      userUuid: dto.userUuid,
      productCode: access.product.code,
      productName: access.product.name,
      status: access.status,
      grantedAt: formatDateResponse(access.grantedAt, userTimezone),
      revokedAt: formatDateResponse(access.revokedAt, userTimezone),
    };
  }
}
