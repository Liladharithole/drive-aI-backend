import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
import { AuditLogService } from './audit.service';

@ApiTags('Activity Logs & Audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, ProductAccessGuard)
@RequireProduct('DRIVE_AI')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated activity feed logs for the current user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of logs to return (default: 20)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page index starting from 1 (default: 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated activity logs retrieved successfully',
  })
  async getActivityLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const pageNum = page ? parseInt(page, 10) : 1;

    const result = await this.auditLogService.getActivityLogs(
      user.uuid,
      limitNum,
      pageNum,
    );

    return {
      success: true,
      message: 'Activity logs retrieved successfully',
      data: result,
    };
  }
}
