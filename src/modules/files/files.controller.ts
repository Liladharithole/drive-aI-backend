import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductAccessGuard } from '../auth/guards/product-access.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequireProduct } from '../../common/decorators/require-product.decorator';
import { UploadFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FilesService } from './files.service';

export interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, ProductAccessGuard)
@RequireProduct('DRIVE_AI')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Queue a file upload job (Asynchronous)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderUuid: { type: 'string', description: 'Target folder UUID' },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'File upload job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Empty file or validation error' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate filename in target location',
  })
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: UploadFileDto,
  ) {
    const jobResult = await this.filesService.queueUploadJob(
      user.uuid,
      file.buffer,
      file.originalname,
      file.mimetype,
      dto,
    );

    return {
      success: true,
      message: 'File upload job queued successfully',
      data: jobResult,
    };
  }

  @Post('upload/bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Queue multiple file upload jobs (up to 20 files, Asynchronous)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        folderUuid: { type: 'string', description: 'Target folder UUID' },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'File upload jobs queued successfully',
  })
  async uploadFilesBulk(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: UploadedMulterFile[],
    @Body() dto: UploadFileDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const queuedJobs: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        const job = await this.filesService.queueUploadJob(
          user.uuid,
          file.buffer,
          file.originalname,
          file.mimetype,
          dto,
        );
        queuedJobs.push(job);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Queueing failed';
        errors.push({
          filename: file.originalname,
          error: errMsg,
        });
      }
    }

    return {
      success: true,
      message: `Successfully queued ${queuedJobs.length} jobs. Failed to queue: ${errors.length}.`,
      data: {
        queued: queuedJobs,
        failed: errors,
      },
    };
  }

  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check the status of a background file upload job' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const jobStatus = await this.filesService.getJobStatus(jobId);
    return {
      success: true,
      message: 'Job status retrieved successfully',
      data: jobStatus,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List files in a folder (or root drive if folderUuid is omitted)',
  })
  @ApiQuery({ name: 'folderUuid', required: false, description: 'Folder UUID' })
  @ApiQuery({
    name: 'isStarred',
    required: false,
    type: Boolean,
    description: 'Filter starred files',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Natural language semantic search query',
  })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  async getFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderUuid') folderUuid?: string,
    @Query('isStarred') isStarred?: string,
    @Query('isTrashed') isTrashed?: string,
    @Query('search') search?: string,
  ) {
    const starredBool =
      isStarred !== undefined ? isStarred === 'true' : undefined;
    const trashedBool =
      isTrashed !== undefined ? isTrashed === 'true' : undefined;

    const files = await this.filesService.getFiles(
      user.uuid,
      folderUuid,
      starredBool,
      trashedBool,
      'Asia/Kolkata', // fallback timezone
      search,
    );

    return {
      success: true,
      message: 'Files retrieved successfully',
      data: files,
    };
  }

  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get file details and metadata' })
  @ApiResponse({
    status: 200,
    description: 'File details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileByUuid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const file = await this.filesService.getFileByUuid(user.uuid, uuid);
    return {
      success: true,
      message: 'File details retrieved successfully',
      data: file,
    };
  }

  @Get(':uuid/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download or stream physical file' })
  @ApiResponse({ status: 200, description: 'File stream download' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Query('download') download: string,
    @Res() res: ExpressResponse,
  ) {
    const payload = await this.filesService.getDownloadPayload(user.uuid, uuid);
    const isDownload = download === 'true';

    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(payload.filename)}"`,
    );
    res.setHeader('Content-Length', payload.size.toString());
    res.send(payload.buffer);
  }

  @Patch(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rename, star/unstar, or move file to a new folder',
  })
  @ApiResponse({ status: 200, description: 'File updated successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async updateFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateFileDto,
  ) {
    const file = await this.filesService.updateFile(user.uuid, uuid, dto);
    return {
      success: true,
      message: 'File updated successfully',
      data: file,
    };
  }

  @Patch(':uuid/trash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move file to Trash Bin' })
  @ApiResponse({ status: 200, description: 'File moved to trash successfully' })
  async trashFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const file = await this.filesService.trashFile(user.uuid, uuid);
    return {
      success: true,
      message: 'File moved to trash successfully',
      data: file,
    };
  }

  @Patch(':uuid/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore file from Trash Bin' })
  @ApiResponse({
    status: 200,
    description: 'File restored from trash successfully',
  })
  async restoreFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const file = await this.filesService.restoreFile(user.uuid, uuid);
    return {
      success: true,
      message: 'File restored from trash successfully',
      data: file,
    };
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete file from storage and database',
  })
  @ApiResponse({ status: 200, description: 'File permanently deleted' })
  async deletePermanently(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const result = await this.filesService.deletePermanently(user.uuid, uuid);
    return result;
  }
}
