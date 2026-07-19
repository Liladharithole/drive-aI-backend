import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'LEGAL_AI',
    description: 'Unique product code',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 'Legal Assistant AI SaaS',
    description: 'Product display name',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'Automated legal document review and contract analysis',
    description: 'Product description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
