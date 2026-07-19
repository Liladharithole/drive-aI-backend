import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminService } from './admin.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary: 'Create a custom role with assigned permissions (Admin)',
  })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 409, description: 'Role code already exists' })
  async createCustomRole(@Body() dto: CreateCustomRoleDto) {
    const role = await this.adminService.createCustomRole(dto);
    return {
      success: true,
      message: 'Custom role created successfully',
      data: role,
    };
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary: 'List all system roles and their assigned permissions',
  })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  async listRoles() {
    const roles = await this.adminService.listRoles();
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: roles,
    };
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary: 'List all available system permissions grouped by module',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  async listPermissions() {
    const permissions = await this.adminService.listPermissions();
    return {
      success: true,
      message: 'Permissions retrieved successfully',
      data: permissions,
    };
  }

  @Post('users/roles')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.roles')
  @ApiOperation({ summary: 'Assign custom roles to a user (Admin)' })
  @ApiResponse({ status: 200, description: 'User roles assigned successfully' })
  async assignRolesToUser(@Body() dto: AssignRolesDto) {
    const result = await this.adminService.assignRolesToUser(dto);
    return {
      success: true,
      message: 'User roles assigned successfully',
      data: result,
    };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'List all system users with pagination (Admin)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default 20)',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const result = await this.adminService.listUsers(pageNum, limitNum);
    return {
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  @Patch('users/:uuid/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.block')
  @ApiOperation({
    summary: 'Update user status (block, suspend, activate) (Admin)',
  })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.adminService.updateUserStatus(uuid, dto);
    return {
      success: true,
      message: 'User status updated successfully',
      data: result,
    };
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('products.create')
  @ApiOperation({
    summary: 'Create a new SaaS product in central-core (Admin)',
  })
  @ApiResponse({
    status: 201,
    description: 'SaaS product created successfully',
  })
  @ApiResponse({ status: 409, description: 'Product code already exists' })
  async createProduct(@Body() dto: CreateProductDto) {
    const product = await this.adminService.createProduct(dto);
    return {
      success: true,
      message: 'SaaS product created successfully',
      data: product,
    };
  }
}
