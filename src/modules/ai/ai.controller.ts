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
  Delete,
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

  @ApiOperation({
    summary:
      'Ask a natural language question across all user files (Global RAG)',
  })
  @ApiResponse({ status: 200, description: 'Grounding answer returned' })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async askGlobalQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Body('question') question: string,
    @Body('sessionUuid') sessionUuid?: string,
  ) {
    if (!question) {
      throw new BadRequestException('Question is required');
    }
    return this.aiService.askGlobalQuestion(
      user.uuid,
      user.email,
      question,
      sessionUuid,
    );
  }

  @ApiOperation({ summary: 'List all chat sessions for the current user' })
  @ApiResponse({ status: 200, description: 'List of chat sessions returned' })
  @Get('sessions')
  async getSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.getSessions(user.uuid);
  }

  @ApiOperation({ summary: 'Get all messages inside a specific chat session' })
  @ApiResponse({ status: 200, description: 'Messages list returned' })
  @Get('sessions/:uuid/messages')
  async getSessionMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    return this.aiService.getSessionMessages(user.uuid, uuid);
  }

  @ApiOperation({ summary: 'Delete a chat session and its message logs' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  @Delete('sessions/:uuid')
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    return this.aiService.deleteSession(user.uuid, uuid);
  }

  @ApiOperation({
    summary: 'Transcribe spoken audio recording to text',
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
    description: 'Audio transcribed successfully',
  })
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  @HttpCode(HttpStatus.OK)
  async transcribeAudio(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: ExpressFile,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Audio file recording is required');
    }

    const text = await this.aiService.transcribeAudioDirect(
      file.buffer,
      file.mimetype || 'audio/webm',
    );
    return { success: true, text };
  }
}
