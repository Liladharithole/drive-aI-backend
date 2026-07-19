import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({
    example: 'Projects',
    description: 'Folder name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Folder name is required' })
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Parent folder UUID (leave empty for root folder)',
  })
  @IsOptional()
  @IsString()
  parentUuid?: string;

  @ApiPropertyOptional({
    example: '#4285F4',
    description: 'Folder color hex code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
