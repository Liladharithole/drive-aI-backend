import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client-central-core';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.BLOCKED,
    description: 'Target status (ACTIVE, INACTIVE, PENDING, BLOCKED)',
  })
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status!: UserStatus;
}
