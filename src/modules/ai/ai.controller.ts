import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { TranslateDocumentDto } from './dto/translate-document.dto';

interface ExpressFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('AI Document Intelligence & RAG')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({
    summary:
      'Queue document for AI text extraction, chunking, vector embedding, and summary',
  })
  @ApiResponse({
    status: 202,
    description: 'AI processing job queued successfully',
  })
  @Post('files/:fileUuid/process')
  @HttpCode(HttpStatus.ACCEPTED)
  async processDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
  ) {
    return this.aiService.queueDocumentProcessing(
      user.uuid,
      user.email,
      fileUuid,
    );
  }

  @ApiOperation({ summary: 'Get AI document processing job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.aiService.getJobStatus(jobId);
  }

  @ApiOperation({
    summary: 'Get 1-page summary, key takeaways, and document classification',
  })
  @ApiResponse({ status: 200, description: 'Summary retrieved' })
  @Get('files/:fileUuid/summary')
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
    @Headers('x-timezone') timezone?: string,
  ) {
    return this.aiService.getSummary(
      user.uuid,
      user.email,
      fileUuid,
      timezone || 'Asia/Kolkata',
    );
  }

  @ApiOperation({
    summary:
      'Ask a natural language question about document content (RAG Engine)',
  })
  @ApiResponse({
    status: 200,
    description: 'Grounding answer and source citations returned',
  })
  @Post('files/:fileUuid/ask')
  @HttpCode(HttpStatus.OK)
  async askQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
    @Body() dto: AskQuestionDto,
  ) {
    return this.aiService.askQuestion(
      user.uuid,
      user.email,
      fileUuid,
      dto.question,
      dto.targetLanguage,
    );
  }

  @ApiOperation({
    summary:
      'Ask a question using recorded voice/audio input (Voice-to-Text STT RAG)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Spoken audio clip (.mp3, .wav, .webm, .m4a)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio transcribed and RAG answer returned',
  })
  @Post('files/:fileUuid/ask-voice')
  @UseInterceptors(FileInterceptor('audio'))
  @HttpCode(HttpStatus.OK)
  async askQuestionFromVoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
    @UploadedFile() file: ExpressFile,
    @Query('targetLanguage') targetLanguage?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Spoken audio file recording is required');
    }

    return this.aiService.askQuestionFromVoice(
      user.uuid,
      user.email,
      fileUuid,
      file.buffer,
      file.mimetype || 'audio/webm',
      targetLanguage || 'English',
    );
  }

  @ApiOperation({
    summary:
      'Translate document into target language and export as PDF/DOCX to Drive',
  })
  @ApiResponse({
    status: 200,
    description: 'Document translated and exported to drive successfully',
  })
  @Post('files/:fileUuid/translate')
  @HttpCode(HttpStatus.OK)
  async translateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
    @Body() dto: TranslateDocumentDto,
    @Headers('x-timezone') timezone?: string,
  ) {
    return this.aiService.translateAndExportDocument(
      user.uuid,
      user.email,
      fileUuid,
      dto.targetLanguage,
      dto.exportFormat || 'pdf',
      dto.saveToDrive !== false,
      timezone || 'Asia/Kolkata',
    );
  }

  @ApiOperation({ summary: 'Get Q&A conversation history for a document' })
  @ApiResponse({ status: 200, description: 'Chat history returned' })
  @Get('files/:fileUuid/chat-history')
  async getChatHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileUuid') fileUuid: string,
    @Headers('x-timezone') timezone?: string,
  ) {
    return this.aiService.getChatHistory(
      user.uuid,
      user.email,
      fileUuid,
      timezone || 'Asia/Kolkata',
    );
  }
}
