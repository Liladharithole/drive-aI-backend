import {
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
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FoldersService, FormattedFolder } from './folders.service';

@ApiTags('Folders')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, ProductAccessGuard)
@RequireProduct('DRIVE_AI')
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new folder or sub-folder' })
  @ApiResponse({ status: 201, description: 'Folder created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate folder name in location',
  })
  async createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFolderDto,
  ) {
    const folder: FormattedFolder = await this.foldersService.createFolder(
      user.uuid,
      dto,
    );
    return {
      success: true,
      message: 'Folder created successfully',
      data: folder,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List folders in a directory (or root if parentUuid is omitted)',
  })
  @ApiQuery({
    name: 'parentUuid',
    required: false,
    description: 'Parent folder UUID',
  })
  @ApiQuery({
    name: 'isStarred',
    required: false,
    type: Boolean,
    description: 'Filter starred folders',
  })
  @ApiQuery({
    name: 'isTrashed',
    required: false,
    type: Boolean,
    description: 'Filter trashed folders',
  })
  @ApiResponse({ status: 200, description: 'Folders retrieved successfully' })
  async getFolders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('parentUuid') parentUuid?: string,
    @Query('isStarred') isStarred?: string,
    @Query('isTrashed') isTrashed?: string,
  ) {
    const starredBool =
      isStarred !== undefined ? isStarred === 'true' : undefined;
    const trashedBool =
      isTrashed !== undefined ? isTrashed === 'true' : undefined;

    const folders: FormattedFolder[] = await this.foldersService.getFolders(
      user.uuid,
      parentUuid,
      starredBool,
      trashedBool,
    );

    return {
      success: true,
      message: 'Folders retrieved successfully',
      data: folders,
    };
  }

  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get details of a single folder and its sub-folders',
  })
  @ApiResponse({
    status: 200,
    description: 'Folder details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async getFolderByUuid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const folder: FormattedFolder = await this.foldersService.getFolderByUuid(
      user.uuid,
      uuid,
    );
    return {
      success: true,
      message: 'Folder details retrieved successfully',
      data: folder,
    };
  }

  @Patch(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update folder name, color, starred state, or move folder',
  })
  @ApiResponse({ status: 200, description: 'Folder updated successfully' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateFolderDto,
  ) {
    const updatedFolder: FormattedFolder =
      await this.foldersService.updateFolder(user.uuid, uuid, dto);
    return {
      success: true,
      message: 'Folder updated successfully',
      data: updatedFolder,
    };
  }

  @Patch(':uuid/trash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move folder to Trash Bin' })
  @ApiResponse({
    status: 200,
    description: 'Folder moved to trash successfully',
  })
  async trashFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const folder: FormattedFolder = await this.foldersService.trashFolder(
      user.uuid,
      uuid,
    );
    return {
      success: true,
      message: 'Folder moved to trash successfully',
      data: folder,
    };
  }

  @Patch(':uuid/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore folder from Trash Bin' })
  @ApiResponse({
    status: 200,
    description: 'Folder restored from trash successfully',
  })
  async restoreFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const folder: FormattedFolder = await this.foldersService.restoreFolder(
      user.uuid,
      uuid,
    );
    return {
      success: true,
      message: 'Folder restored from trash successfully',
      data: folder,
    };
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete folder' })
  @ApiResponse({ status: 200, description: 'Folder permanently deleted' })
  async deletePermanently(
    @CurrentUser() user: AuthenticatedUser,
    @Param('uuid') uuid: string,
  ) {
    const result = await this.foldersService.deletePermanently(user.uuid, uuid);
    return result;
  }
}
