import { ApiProperty } from '@nestjs/swagger';
import { ShareAccessLevel } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';

export { ShareAccessLevel };

export class ShareItemDto {
  @ApiProperty({ description: 'Email of the user to share with' })
  @IsEmail()
  sharedWithEmail!: string;

  @ApiProperty({
    enum: ShareAccessLevel,
    default: ShareAccessLevel.VIEWER,
    description: 'Access permission level',
  })
  @IsEnum(ShareAccessLevel)
  @IsOptional()
  accessLevel?: ShareAccessLevel;

  @ApiProperty({ description: 'UUID of the file to share', required: false })
  @IsUUID()
  @IsOptional()
  fileUuid?: string;

  @ApiProperty({ description: 'UUID of the folder to share', required: false })
  @IsUUID()
  @IsOptional()
  folderUuid?: string;
}
