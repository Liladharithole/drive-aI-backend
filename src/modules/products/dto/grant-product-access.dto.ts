import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAccessStatus } from '@prisma/client-central-core';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GrantProductAccessDto {
  @ApiProperty({
    example: 'user-uuid-1234',
    description: 'Target user UUID',
  })
  @IsString()
  @IsNotEmpty()
  userUuid!: string;

  @ApiProperty({
    example: 'DRIVE_AI',
    description: 'Product code (e.g. DRIVE_AI, FINANCE_LEDGER)',
  })
  @IsString()
  @IsNotEmpty()
  productCode!: string;

  @ApiPropertyOptional({
    enum: ProductAccessStatus,
    example: ProductAccessStatus.ACTIVE,
    description: 'Product access status (ACTIVE, SUSPENDED, REVOKED, EXPIRED)',
  })
  @IsOptional()
  @IsEnum(ProductAccessStatus)
  status?: ProductAccessStatus;
}
