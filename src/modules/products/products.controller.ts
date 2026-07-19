import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { GrantProductAccessDto } from './dto/grant-product-access.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all available SaaS products' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async listProducts() {
    const products = await this.productsService.listProducts();
    return {
      success: true,
      message: 'Products retrieved successfully',
      data: products,
    };
  }

  @Get('entitlements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user product entitlements' })
  @ApiResponse({
    status: 200,
    description: 'Product entitlements retrieved successfully',
  })
  async getMyEntitlements(@CurrentUser() user: AuthenticatedUser) {
    const entitlements = await this.productsService.getUserEntitlements(
      user.uuid,
    );
    return {
      success: true,
      message: 'Product entitlements retrieved successfully',
      data: entitlements,
    };
  }

  @Post('access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant, suspend, or revoke product access for a user (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Product access updated successfully',
  })
  @ApiResponse({ status: 404, description: 'User or Product not found' })
  async grantOrUpdateProductAccess(@Body() dto: GrantProductAccessDto) {
    const result = await this.productsService.grantOrUpdateProductAccess(dto);
    return {
      success: true,
      message: 'Product access updated successfully',
      data: result,
    };
  }
}
