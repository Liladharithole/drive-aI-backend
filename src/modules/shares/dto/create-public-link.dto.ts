import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePublicLinkDto {
  @ApiProperty({
    description: 'UUID of the file to share publicly',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  fileUuid?: string;

  @ApiProperty({
    description: 'UUID of the folder to share publicly',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  folderUuid?: string;

  @ApiProperty({
    description: 'Optional password to lock access',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    description: 'Expiration duration in seconds (e.g. 3600 for 1 hour)',
    required: false,
  })
  @IsInt()
  @Min(10)
  @IsOptional()
  expiresInSeconds?: number;
}
