import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class TranslateDocumentDto {
  @ApiProperty({
    description:
      'Target language for translation (e.g. Hindi, Marathi, Telugu, Tamil, Kannada, English, Spanish, French, German)',
    example: 'Hindi',
  })
  @IsNotEmpty()
  @IsString()
  targetLanguage!: string;

  @ApiPropertyOptional({
    description: 'Export file format (pdf, docx, txt)',
    example: 'pdf',
    default: 'pdf',
  })
  @IsOptional()
  @IsString()
  @IsIn(['pdf', 'docx', 'txt'])
  exportFormat?: 'pdf' | 'docx' | 'txt';

  @ApiPropertyOptional({
    description:
      'Whether to save the translated file to the user drive folder automatically',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveToDrive?: boolean;
}
