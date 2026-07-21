import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductAccessGuard } from '../auth/guards/product-access.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequireProduct } from '../../common/decorators/require-product.decorator';
import { DriveService } from './drive.service';

@ApiTags('Drive')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, ProductAccessGuard)
@RequireProduct('DRIVE_AI')
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('starred')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unified list of starred folders and files' })
  @ApiResponse({
    status: 200,
    description: 'Starred items retrieved successfully',
  })
  async getStarredItems(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.driveService.getStarredItems(user.uuid);
    return {
      success: true,
      message: 'Starred items retrieved successfully',
      data: items,
    };
  }

  @Get('trash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unified list of trashed folders and files' })
  @ApiResponse({
    status: 200,
    description: 'Trashed items retrieved successfully',
  })
  async getTrashedItems(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.driveService.getTrashedItems(user.uuid);
    return {
      success: true,
      message: 'Trashed items retrieved successfully',
      data: items,
    };
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get recently modified files (last 30 files)' })
  @ApiResponse({
    status: 200,
    description: 'Recent files retrieved successfully',
  })
  async getRecentFiles(@CurrentUser() user: AuthenticatedUser) {
    const files = await this.driveService.getRecentFiles(user.uuid);
    return {
      success: true,
      message: 'Recent files retrieved successfully',
      data: files,
    };
  }

  @Get('storage-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get total user storage size used vs limit (15 GB)',
  })
  @ApiResponse({
    status: 200,
    description: 'Storage summary calculated successfully',
  })
  async getStorageSummary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.driveService.getStorageSummary(user.uuid);
    return {
      success: true,
      message: 'Storage summary calculated successfully',
      data: summary,
    };
  }
}
