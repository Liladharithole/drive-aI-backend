import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthService, OAuthUserPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AppleAuthGuard } from './guards/apple-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email/Phone already exists' })
  async signUp(@Body() dto: SignUpDto) {
    const user = await this.authService.signUp(dto);
    return {
      success: true,
      message: 'User registered successfully',
      data: user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and return JWT Access Token' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Logged in successfully',
      data: result,
    };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 Social Login redirect' })
  async googleAuth() {
    // Passport automatically redirects user to Google accounts login page
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  @ApiResponse({
    status: 302,
    description:
      'Authenticated with Google successfully, redirecting to frontend',
  })
  async googleAuthCallback(
    @Req() req: { user: OAuthUserPayload },
    @Res() res: Response,
  ) {
    const result = await this.authService.validateOAuthUser(req.user);
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/login?token=${result.accessToken}&user=${encodeURIComponent(
      JSON.stringify(result.user),
    )}`;
    return res.redirect(redirectUrl);
  }

  @Get('apple')
  @UseGuards(AppleAuthGuard)
  @ApiOperation({ summary: 'Initiate Sign in with Apple redirect' })
  async appleAuth() {
    // Passport automatically redirects user to Apple ID login page
  }

  @Get('apple/callback')
  @UseGuards(AppleAuthGuard)
  @ApiOperation({ summary: 'Apple OAuth callback handler' })
  @ApiResponse({
    status: 302,
    description:
      'Authenticated with Apple successfully, redirecting to frontend',
  })
  async appleAuthCallback(
    @Req() req: { user: OAuthUserPayload },
    @Res() res: Response,
  ) {
    const result = await this.authService.validateOAuthUser(req.user);
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/login?token=${result.accessToken}&user=${encodeURIComponent(
      JSON.stringify(result.user),
    )}`;
    return res.redirect(redirectUrl);
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
