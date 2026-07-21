import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Target folder UUID where file will be saved (leave empty for root drive)',
  })
  @IsOptional()
  @IsString()
  folderUuid?: string;
}
