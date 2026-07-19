import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client-central-core';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Alexander', description: 'Middle name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiPropertyOptional({
    example: 'John D. Senior Dev',
    description: 'Display name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional({ example: '+19876543210', description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar image URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/cover.jpg',
    description: 'Cover image URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Gender' })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be a valid option' })
  gender?: Gender;

  @ApiPropertyOptional({
    example: '1995-05-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO date string' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: 'Asia/Kolkata',
    description: 'Preferred IANA timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Preferred language' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @ApiPropertyOptional({
    example: 'IN',
    description: 'Country code (2 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({
    example: 'Software engineer building scalable cloud systems.',
    description: 'User biography',
  })
  @IsOptional()
  @IsString()
  bio?: string;
}
