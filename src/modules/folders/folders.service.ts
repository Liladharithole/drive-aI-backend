import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Folder } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  FormattedDateResponse,
  formatDateResponse,
  getUtcDate,
} from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

export type FolderWithRelations = Folder & {
  parent?: Folder | null;
  children?: FolderWithRelations[];
  _count?: { children: number };
};

export interface FormattedFolder {
  id: string;
  uuid: string;
  name: string;
  color: string | null;
  userUuid: string;
  parentId: string | null;
  parentUuid: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: FormattedDateResponse | null;
  createdAt: FormattedDateResponse | null;
  updatedAt: FormattedDateResponse | null;
  subFoldersCount?: number;
  children?: FormattedFolder[];
}

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format raw Prisma folder object into clean API response.
   */
  private formatFolder(
    folder: FolderWithRelations,
    userTimezone = 'Asia/Kolkata',
  ): FormattedFolder {
    return {
      id: folder.id.toString(),
      uuid: folder.uuid,
      name: folder.name,
      color: folder.color,
      userUuid: folder.userUuid,
      parentId: folder.parentId ? folder.parentId.toString() : null,
      parentUuid: folder.parent ? folder.parent.uuid : null,
      isStarred: folder.isStarred,
      isTrashed: folder.isTrashed,
      trashedAt: formatDateResponse(folder.trashedAt, userTimezone),
      createdAt: formatDateResponse(folder.createdAt, userTimezone),
      updatedAt: formatDateResponse(folder.updatedAt, userTimezone),
      subFoldersCount: folder._count?.children ?? undefined,
      children: folder.children
        ? folder.children.map((child) => this.formatFolder(child, userTimezone))
        : undefined,
    };
  }

  /**
   * Create a new folder for an authenticated user.
   */
  async createFolder(
    userUuid: string,
    dto: CreateFolderDto,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder> {
    let parentId: bigint | null = null;

    if (dto.parentUuid) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: {
          uuid: dto.parentUuid,
          userUuid,
          isTrashed: false,
          deletedAt: null,
        },
      });

      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
      parentId = parentFolder.id;
    }

    // Check duplicate folder name in same parent directory
    const duplicate = await this.prisma.folder.findFirst({
      where: {
        name: dto.name.trim(),
        userUuid,
        parentId,
        isTrashed: false,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'A folder with this name already exists in this location',
      );
    }

    const uuid = randomUUID();
    const folder = await this.prisma.folder.create({
      data: {
        uuid,
        name: dto.name.trim(),
        userUuid,
        parentId,
        color: dto.color || '#4285F4',
      },
      include: {
        parent: true,
      },
    });

    this.logger.log(
      `Folder created: ${folder.name} (${folder.uuid}) for user ${userUuid}`,
    );
    return this.formatFolder(folder, userTimezone);
  }

  /**
   * List folders in a parent directory (or root directory if parentUuid is omitted).
   */
  async getFolders(
    userUuid: string,
    parentUuid?: string,
    isStarred?: boolean,
    isTrashed?: boolean,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder[]> {
    let parentId: bigint | null = null;

    if (parentUuid) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: { uuid: parentUuid, userUuid },
      });
      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
      parentId = parentFolder.id;
    }

    const folders = await this.prisma.folder.findMany({
      where: {
        userUuid,
        deletedAt: null,
        ...(isTrashed !== undefined ? { isTrashed } : { isTrashed: false }),
        ...(isStarred !== undefined ? { isStarred } : {}),
        ...(parentUuid
          ? { parentId }
          : isStarred || isTrashed
            ? {}
            : { parentId: null }),
      },
      include: {
        parent: true,
        _count: {
          select: { children: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return folders.map((f) => this.formatFolder(f, userTimezone));
  }

  /**
   * Get single folder details by UUID with children sub-folders.
   */
  async getFolderByUuid(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder> {
    const folder = await this.prisma.folder.findFirst({
      where: { uuid, userUuid, deletedAt: null },
      include: {
        parent: true,
        children: {
          where: { isTrashed: false, deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.formatFolder(folder, userTimezone);
  }

  /**
   * Update folder name, color, starred state, or move to new parent folder.
   */
  async updateFolder(
    userUuid: string,
    uuid: string,
    dto: UpdateFolderDto,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder> {
    const folder = await this.prisma.folder.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    let newParentId = folder.parentId;

    if (dto.parentUuid !== undefined) {
      if (dto.parentUuid === null || dto.parentUuid === '') {
        newParentId = null;
      } else {
        const parentFolder = await this.prisma.folder.findFirst({
          where: {
            uuid: dto.parentUuid,
            userUuid,
            isTrashed: false,
            deletedAt: null,
          },
        });

        if (!parentFolder) {
          throw new NotFoundException('Target parent folder not found');
        }
        if (parentFolder.id === folder.id) {
          throw new ConflictException('Cannot set a folder as its own parent');
        }
        newParentId = parentFolder.id;
      }
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id: folder.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isStarred !== undefined && { isStarred: dto.isStarred }),
        parentId: newParentId,
      },
      include: {
        parent: true,
      },
    });

    return this.formatFolder(updatedFolder, userTimezone);
  }

  /**
   * Move folder to Trash Bin (soft delete for Google Drive trash feature).
   */
  async trashFolder(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder> {
    const folder = await this.prisma.folder.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const nowUtc = getUtcDate();
    const trashedFolder = await this.prisma.folder.update({
      where: { id: folder.id },
      data: {
        isTrashed: true,
        trashedAt: nowUtc,
      },
      include: {
        parent: true,
      },
    });

    this.logger.log(`Folder trashed: ${folder.name} (${folder.uuid})`);
    return this.formatFolder(trashedFolder, userTimezone);
  }

  /**
   * Restore folder from Trash Bin.
   */
  async restoreFolder(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFolder> {
    const folder = await this.prisma.folder.findFirst({
      where: { uuid, userUuid, deletedAt: null, isTrashed: true },
    });

    if (!folder) {
      throw new NotFoundException('Trashed folder not found');
    }

    const restoredFolder = await this.prisma.folder.update({
      where: { id: folder.id },
      data: {
        isTrashed: false,
        trashedAt: null,
      },
      include: {
        parent: true,
      },
    });

    return this.formatFolder(restoredFolder, userTimezone);
  }

  /**
   * Permanently delete folder.
   */
  async deletePermanently(userUuid: string, uuid: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { uuid, userUuid },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    await this.prisma.folder.delete({
      where: { id: folder.id },
    });

    this.logger.log(`Folder permanently deleted: ${folder.uuid}`);
    return {
      success: true,
      message: 'Folder permanently deleted',
    };
  }
}
