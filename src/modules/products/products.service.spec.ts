import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductAccessStatus } from '@prisma/client-central-core';
import { PrismaCentralCoreService } from '../../prisma-central-core/prisma-central-core.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockPrismaCentralCore = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userProductAccess: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaCentralCoreService,
          useValue: mockPrismaCentralCore,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listProducts', () => {
    it('should return a list of available products', async () => {
      mockPrismaCentralCore.product.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          uuid: 'prod-uuid-1',
          code: 'DRIVE_AI',
          name: 'AI Drive SaaS Platform',
          description: 'Document intelligence',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listProducts();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('DRIVE_AI');
    });
  });

  describe('grantOrUpdateProductAccess', () => {
    it('should throw NotFoundException if target user does not exist', async () => {
      mockPrismaCentralCore.user.findUnique.mockResolvedValue(null);

      await expect(
        service.grantOrUpdateProductAccess({
          userUuid: 'invalid-user-uuid',
          productCode: 'DRIVE_AI',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update product access status to REVOKED', async () => {
      mockPrismaCentralCore.user.findUnique.mockResolvedValue({
        id: BigInt(10),
        uuid: 'user-uuid-10',
      });
      mockPrismaCentralCore.product.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'DRIVE_AI',
        name: 'AI Drive SaaS Platform',
      });
      mockPrismaCentralCore.userProductAccess.upsert.mockResolvedValue({
        id: BigInt(100),
        uuid: 'access-uuid-100',
        userId: BigInt(10),
        productId: BigInt(1),
        status: ProductAccessStatus.REVOKED,
        grantedAt: new Date(),
        revokedAt: new Date(),
        product: {
          code: 'DRIVE_AI',
          name: 'AI Drive SaaS Platform',
        },
      });

      const result = await service.grantOrUpdateProductAccess({
        userUuid: 'user-uuid-10',
        productCode: 'DRIVE_AI',
        status: ProductAccessStatus.REVOKED,
      });

      expect(result.status).toBe(ProductAccessStatus.REVOKED);
      expect(result.productCode).toBe('DRIVE_AI');
    });
  });
});
