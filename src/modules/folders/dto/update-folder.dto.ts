import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @ApiPropertyOptional({
    example: 'Renamed Project',
    description: 'Updated folder name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'New parent folder UUID',
  })
  @IsOptional()
  @IsString()
  parentUuid?: string;

  @ApiPropertyOptional({
    example: '#FF5733',
    description: 'Folder color hex code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: true, description: 'Star or unstar folder' })
  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;
}
