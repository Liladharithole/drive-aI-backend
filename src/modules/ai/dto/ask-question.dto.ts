import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({
    description:
      'Natural language question to ask about the document content (in any language)',
    example: 'इस दस्तावेज में कुल कीमत क्या है?',
  })
  @IsNotEmpty()
  @IsString()
  question!: string;

  @ApiPropertyOptional({
    description:
      'Target response language (e.g. English, Hindi, Marathi, Telugu, Tamil, Kannada)',
    example: 'Hindi',
    default: 'English',
  })
  @IsOptional()
  @IsString()
  targetLanguage?: string;
}
