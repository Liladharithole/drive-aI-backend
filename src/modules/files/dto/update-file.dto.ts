import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFileDto {
  @ApiPropertyOptional({
    example: 'Renamed Document.pdf',
    description: 'Updated file name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Target folder UUID to move file to',
  })
  @IsOptional()
  @IsString()
  folderUuid?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Star or unstar file',
  })
  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;
}
