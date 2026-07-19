import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account and profile' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async signUp(@Body() dto: SignUpDto) {
    const user = await this.authService.signUp(dto);
    return {
      success: true,
      message: 'User account created successfully',
      data: user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user credentials and issue JWT token',
  })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive user',
  })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Logged in successfully',
      data: result,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized / Invalid Bearer token',
  })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.authService.getProfile(user.uuid);
    return {
      success: true,
      message: 'User profile retrieved successfully',
      data: profile,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update profile info for current authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized / Invalid Bearer token',
  })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updatedProfile = await this.authService.updateProfile(user.uuid, dto);
    return {
      success: true,
      message: 'User profile updated successfully',
      data: updatedProfile,
    };
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Soft delete account for current authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Account soft-deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized / Invalid Bearer token',
  })
  async softDeleteAccount(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.authService.softDeleteAccount(user.uuid);
    return result;
  }
}
