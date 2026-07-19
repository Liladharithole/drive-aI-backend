import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomRoleDto {
  @ApiProperty({
    example: 'SUPPORT_AGENT',
    description: 'Unique role code',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 'Customer Support Specialist',
    description: 'Human-readable role name',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'Can view users and respond to support tickets',
    description: 'Role description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['users.view', 'folders.view'],
    description: 'Array of permission codes assigned to this role',
  })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
