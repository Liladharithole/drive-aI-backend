import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({
    example: 'user-uuid-1234',
    description: 'Target user UUID',
  })
  @IsString()
  @IsNotEmpty()
  userUuid!: string;

  @ApiProperty({
    example: ['SUPPORT_AGENT'],
    description: 'Array of role codes to assign to this user',
  })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}
