import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ShareItemDto } from './dto/share-item.dto';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';
import { SharesService } from './shares.service';

@ApiTags('Shares & Collaboration')
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProductAccessGuard)
  @RequireProduct('DRIVE_AI')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Share a file or folder with another user by email',
  })
  @ApiResponse({
    status: 200,
    description: 'Share granted/updated successfully',
  })
  async shareItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ShareItemDto,
  ) {
    const result = await this.sharesService.shareItem(user.uuid, dto);
    return {
      success: true,
      message: 'Share created or updated successfully',
      data: result,
    };
  }

  @Get('shared-with-me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProductAccessGuard)
  @RequireProduct('DRIVE_AI')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all files and folders shared with the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared items retrieved successfully',
  })
  async getSharedWithMe(@CurrentUser() user: AuthenticatedUser) {
    // Note: in our system, AuthenticatedUser has access to their email
    const email = user.email || '';
    const result = await this.sharesService.getSharedWithMe(email);
    return {
      success: true,
      message: 'Shared items retrieved successfully',
      data: result,
    };
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProductAccessGuard)
  @RequireProduct('DRIVE_AI')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revoke access for a shared file or folder' })
  @ApiResponse({ status: 200, description: 'Share revoked successfully' })
  async revokeShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const email = user.email || '';
    const result = await this.sharesService.revokeShare(user.uuid, email, uuid);
    return result;
  }

  @Post('public')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, ProductAccessGuard)
  @RequireProduct('DRIVE_AI')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Generate a public, expiring access link for a file or folder',
  })
  @ApiResponse({ status: 201, description: 'Public link created successfully' })
  async createPublicLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePublicLinkDto,
  ) {
    const result = await this.sharesService.createPublicLink(user.uuid, dto);
    return {
      success: true,
      message: 'Public link created successfully',
      data: result,
    };
  }

  // NOTE: This is a Public, unauthenticated endpoint (NO JWT guard)
  @Get('public/:accessKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access or download shared items via public link' })
  @ApiQuery({
    name: 'password',
    required: false,
    description: 'Required if public link is password-protected',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns file stream or list of folder contents',
  })
  @ApiResponse({ status: 401, description: 'Password required or incorrect' })
  @ApiResponse({ status: 403, description: 'Public link has expired' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  async getPublicItem(
    @Param('accessKey') accessKey: string,
    @Query('password') password?: string,
    @Res() res?: ExpressResponse,
  ) {
    const result = await this.sharesService.getPublicItem(accessKey, password);

    if (result.type === 'FILE' && res) {
      res.setHeader(
        'Content-Type',
        result.mimeType || 'application/octet-stream',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.filename || 'download')}"`,
      );
      res.setHeader('Content-Length', result.sizeBytes?.toString() || '0');
      res.send(result.buffer);
      return;
    }

    if (res) {
      res.json({
        success: true,
        message: 'Public folder contents retrieved successfully',
        data: result,
      });
    }
  }
}
