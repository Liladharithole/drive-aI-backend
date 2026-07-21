import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShareAccessLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ShareItemDto } from './dto/share-item.dto';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';
import { StorageService } from '../files/storage/storage.service';
import { formatDateResponse } from '../../common/utils/date.util';
import { AuditLogService } from '../audit/audit.service';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Share a file or folder with another user by email.
   */
  async shareItem(
    ownerUuid: string,
    dto: ShareItemDto,
  ): Promise<{
    uuid: string;
    fileUuid?: string | null;
    folderUuid?: string | null;
    sharedWithEmail: string;
    accessLevel: ShareAccessLevel;
    action: string;
  }> {
    const {
      sharedWithEmail,
      accessLevel = ShareAccessLevel.VIEWER,
      fileUuid,
      folderUuid,
    } = dto;

    if (!fileUuid && !folderUuid) {
      throw new BadRequestException(
        'Either fileUuid or folderUuid must be provided',
      );
    }
    if (fileUuid && folderUuid) {
      throw new BadRequestException(
        'Cannot share both file and folder in one share action',
      );
    }

    const uuid = randomUUID();

    // 1. Verify ownership of File or Folder
    if (fileUuid) {
      const file = await this.prisma.file.findFirst({
        where: { uuid: fileUuid, userUuid: ownerUuid, deletedAt: null },
      });
      if (!file) {
        throw new NotFoundException('File not found or not owned by you');
      }

      // Upsert share
      const existing = await this.prisma.fileShare.findFirst({
        where: { fileUuid, sharedWithEmail },
      });

      let shareResult: {
        uuid: string;
        fileUuid?: string | null;
        folderUuid?: string | null;
        sharedWithEmail: string;
        accessLevel: ShareAccessLevel;
        action: string;
      };

      if (existing) {
        const updated = await this.prisma.fileShare.update({
          where: { id: existing.id },
          data: { accessLevel },
        });
        shareResult = {
          uuid: updated.uuid,
          fileUuid: updated.fileUuid,
          sharedWithEmail: updated.sharedWithEmail,
          accessLevel: updated.accessLevel,
          action: 'updated',
        };
      } else {
        const created = await this.prisma.fileShare.create({
          data: {
            uuid,
            fileUuid,
            sharedByUuid: ownerUuid,
            sharedWithEmail,
            accessLevel,
          },
        });
        shareResult = {
          uuid: created.uuid,
          fileUuid: created.fileUuid,
          sharedWithEmail: created.sharedWithEmail,
          accessLevel: created.accessLevel,
          action: 'created',
        };
      }

      // Audit Log
      await this.auditLogService.logShareAction(
        ownerUuid,
        'FILE',
        file.uuid,
        sharedWithEmail,
        'SHARE_FILE',
        `Shared file "${file.name}" with ${sharedWithEmail} as ${accessLevel}`,
      );

      return shareResult;
    } else {
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: folderUuid, userUuid: ownerUuid, deletedAt: null },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found or not owned by you');
      }

      // Upsert share
      const existing = await this.prisma.fileShare.findFirst({
        where: { folderUuid, sharedWithEmail },
      });

      let shareResult: {
        uuid: string;
        fileUuid?: string | null;
        folderUuid?: string | null;
        sharedWithEmail: string;
        accessLevel: ShareAccessLevel;
        action: string;
      };

      if (existing) {
        const updated = await this.prisma.fileShare.update({
          where: { id: existing.id },
          data: { accessLevel },
        });
        shareResult = {
          uuid: updated.uuid,
          folderUuid: updated.folderUuid,
          sharedWithEmail: updated.sharedWithEmail,
          accessLevel: updated.accessLevel,
          action: 'updated',
        };
      } else {
        const created = await this.prisma.fileShare.create({
          data: {
            uuid,
            folderUuid,
            sharedByUuid: ownerUuid,
            sharedWithEmail,
            accessLevel,
          },
        });
        shareResult = {
          uuid: created.uuid,
          folderUuid: created.folderUuid,
          sharedWithEmail: created.sharedWithEmail,
          accessLevel: created.accessLevel,
          action: 'created',
        };
      }

      // Audit Log
      await this.auditLogService.logShareAction(
        ownerUuid,
        'FOLDER',
        folder.uuid,
        sharedWithEmail,
        'SHARE_FOLDER',
        `Shared folder "${folder.name}" with ${sharedWithEmail} as ${accessLevel}`,
      );

      return shareResult;
    }
  }

  /**
   * Revoke a shared permission.
   */
  async revokeShare(userUuid: string, userEmail: string, shareUuid: string) {
    const share = await this.prisma.fileShare.findFirst({
      where: { uuid: shareUuid },
    });

    if (!share) {
      throw new NotFoundException('Share record not found');
    }

    // Only owner of file/folder or the recipient can revoke the share
    if (
      share.sharedByUuid !== userUuid &&
      share.sharedWithEmail !== userEmail
    ) {
      throw new ForbiddenException(
        'You do not have permission to revoke this share',
      );
    }

    await this.prisma.fileShare.delete({
      where: { id: share.id },
    });

    // Audit Log (Log under the owner's account or the revoking user)
    if (share.fileUuid) {
      const file = await this.prisma.file.findFirst({
        where: { uuid: share.fileUuid },
      });
      if (file) {
        await this.auditLogService.logShareAction(
          userUuid,
          'FILE',
          file.uuid,
          share.sharedWithEmail,
          'REVOKE_SHARE_FILE',
          `Revoked share permission for ${share.sharedWithEmail} on file "${file.name}"`,
        );
      }
    } else if (share.folderUuid) {
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: share.folderUuid },
      });
      if (folder) {
        await this.auditLogService.logShareAction(
          userUuid,
          'FOLDER',
          folder.uuid,
          share.sharedWithEmail,
          'REVOKE_SHARE_FOLDER',
          `Revoked share permission for ${share.sharedWithEmail} on folder "${folder.name}"`,
        );
      }
    }

    return {
      success: true,
      message: 'Share revoked successfully',
    };
  }

  /**
   * Get items shared with me.
   */
  async getSharedWithMe(
    userEmail: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<unknown[]> {
    const shares = await this.prisma.fileShare.findMany({
      where: { sharedWithEmail: userEmail },
      orderBy: { createdAt: 'desc' },
    });

    const results: unknown[] = [];

    for (const share of shares) {
      if (share.fileUuid) {
        const file = await this.prisma.file.findFirst({
          where: { uuid: share.fileUuid, deletedAt: null, isTrashed: false },
        });
        if (file) {
          results.push({
            shareUuid: share.uuid,
            accessLevel: share.accessLevel,
            type: 'FILE',
            sharedBy: share.sharedByUuid,
            sharedAt: formatDateResponse(share.createdAt, userTimezone),
            item: {
              uuid: file.uuid,
              name: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.size.toString(),
              extension: file.extension,
              createdAt: formatDateResponse(file.createdAt, userTimezone),
            },
          });
        }
      } else if (share.folderUuid) {
        const folder = await this.prisma.folder.findFirst({
          where: { uuid: share.folderUuid, deletedAt: null, isTrashed: false },
        });
        if (folder) {
          results.push({
            shareUuid: share.uuid,
            accessLevel: share.accessLevel,
            type: 'FOLDER',
            sharedBy: share.sharedByUuid,
            sharedAt: formatDateResponse(share.createdAt, userTimezone),
            item: {
              uuid: folder.uuid,
              name: folder.name,
              color: folder.color,
              createdAt: formatDateResponse(folder.createdAt, userTimezone),
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Recursive check for hierarchical access verification (Permission Inheritance).
   */
  async hasAccess(
    userUuid: string,
    userEmail: string,
    fileUuid?: string,
    folderUuid?: string,
    requiredLevel: 'VIEWER' | 'EDITOR' = 'VIEWER',
    depth = 0,
  ): Promise<boolean> {
    // Avoid infinite loops
    if (depth > 30) return false;

    if (fileUuid) {
      const file = await this.prisma.file.findFirst({
        where: { uuid: fileUuid, deletedAt: null },
      });
      if (!file) return false;

      // 1. Owner always has full access
      if (file.userUuid === userUuid) return true;

      // 2. Direct share match
      const share = await this.prisma.fileShare.findFirst({
        where: { fileUuid, sharedWithEmail: userEmail },
      });

      if (share) {
        if (requiredLevel === 'EDITOR') {
          return share.accessLevel === ShareAccessLevel.EDITOR;
        }
        return true;
      }

      // 3. Fallback to parent folder checks if file sits inside a folder
      if (file.folderUuid) {
        return this.hasAccess(
          userUuid,
          userEmail,
          undefined,
          file.folderUuid,
          requiredLevel,
          depth + 1,
        );
      }

      return false;
    }

    if (folderUuid) {
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: folderUuid, deletedAt: null },
      });
      if (!folder) return false;

      // 1. Owner always has full access
      if (folder.userUuid === userUuid) return true;

      // 2. Direct folder share match
      const share = await this.prisma.fileShare.findFirst({
        where: { folderUuid, sharedWithEmail: userEmail },
      });

      if (share) {
        if (requiredLevel === 'EDITOR') {
          return share.accessLevel === ShareAccessLevel.EDITOR;
        }
        return true;
      }

      // 3. Fallback to parent folder check (Hierarchical Inheritance)
      if (folder.parentId) {
        const parent = await this.prisma.folder.findFirst({
          where: { id: folder.parentId, deletedAt: null },
        });
        if (parent) {
          return this.hasAccess(
            userUuid,
            userEmail,
            undefined,
            parent.uuid,
            requiredLevel,
            depth + 1,
          );
        }
      }

      return false;
    }

    return false;
  }

  /**
   * Create a public shareable expiring access link.
   */
  async createPublicLink(userUuid: string, dto: CreatePublicLinkDto) {
    const { fileUuid, folderUuid, password, expiresInSeconds } = dto;

    if (!fileUuid && !folderUuid) {
      throw new BadRequestException(
        'Either fileUuid or folderUuid must be provided',
      );
    }
    if (fileUuid && folderUuid) {
      throw new BadRequestException(
        'Cannot share both file and folder in one public link',
      );
    }

    let itemName = '';
    let targetUuid = '';

    // Verify ownership
    if (fileUuid) {
      const file = await this.prisma.file.findFirst({
        where: { uuid: fileUuid, userUuid, deletedAt: null },
      });
      if (!file) {
        throw new NotFoundException('File not found or not owned by you');
      }
      itemName = file.name;
      targetUuid = file.uuid;
    } else {
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: folderUuid, userUuid, deletedAt: null },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found or not owned by you');
      }
      itemName = folder.name;
      targetUuid = folder.uuid;
    }

    const uuid = randomUUID();
    const accessKey =
      randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''); // 64 chars long unique key
    let passwordHash: string | null = null;

    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    let expiresAt: Date | null = null;
    if (expiresInSeconds) {
      expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    const publicLink = await this.prisma.publicLink.create({
      data: {
        uuid,
        accessKey,
        fileUuid: fileUuid || null,
        folderUuid: folderUuid || null,
        createdBy: userUuid,
        passwordHash,
        expiresAt,
      },
    });

    // Audit Log
    await this.auditLogService.logShareAction(
      userUuid,
      fileUuid ? 'FILE' : 'FOLDER',
      targetUuid,
      null,
      'CREATE_PUBLIC_LINK',
      `Generated public access link for ${fileUuid ? 'file' : 'folder'} "${itemName}"`,
    );

    return {
      uuid: publicLink.uuid,
      accessKey: publicLink.accessKey,
      expiresAt: publicLink.expiresAt,
      isPasswordProtected: !!password,
    };
  }

  /**
   * Get contents or stream data of a public link.
   */
  async getPublicItem(
    accessKey: string,
    password?: string,
    userTimezone = 'Asia/Kolkata',
  ) {
    const publicLink = await this.prisma.publicLink.findUnique({
      where: { accessKey },
    });

    if (!publicLink) {
      throw new NotFoundException('Public link not found');
    }

    // Check expiration
    if (publicLink.expiresAt && new Date() > publicLink.expiresAt) {
      throw new ForbiddenException('This public link has expired');
    }

    // Check password
    if (publicLink.passwordHash) {
      if (!password) {
        throw new UnauthorizedException(
          'Password required to access this public link',
        );
      }
      const match = await bcrypt.compare(password, publicLink.passwordHash);
      if (!match) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    if (publicLink.fileUuid) {
      const file = await this.prisma.file.findFirst({
        where: { uuid: publicLink.fileUuid, deletedAt: null },
      });
      if (!file) {
        throw new NotFoundException('Shared file no longer exists');
      }

      // Download file payload
      const buffer = await this.storageService.getFileBuffer(file.storageKey);

      // Audit Log under the creator's account showing it was publicly accessed
      await this.auditLogService.logFileAction(
        publicLink.createdBy,
        file.uuid,
        'DOWNLOAD_FILE',
        `File "${file.name}" downloaded publicly via share link`,
      );

      return {
        type: 'FILE',
        filename: file.name,
        mimeType: file.mimeType,
        sizeBytes: Number(file.size),
        buffer,
      };
    } else {
      if (!publicLink.folderUuid) {
        throw new NotFoundException('Shared folder no longer exists');
      }
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: publicLink.folderUuid, deletedAt: null },
      });
      if (!folder) {
        throw new NotFoundException('Shared folder no longer exists');
      }

      // Retrieve child folders and files
      const folders = await this.prisma.folder.findMany({
        where: { parentId: folder.id, deletedAt: null, isTrashed: false },
        orderBy: { name: 'asc' },
      });

      const files = await this.prisma.file.findMany({
        where: { folderUuid: folder.uuid, deletedAt: null, isTrashed: false },
        orderBy: { name: 'asc' },
      });

      // Audit Log under the creator's account showing folder was viewed publicly
      await this.auditLogService.logFolderAction(
        publicLink.createdBy,
        folder.uuid,
        'VIEW_FOLDER',
        `Folder "${folder.name}" viewed publicly via share link`,
      );

      return {
        type: 'FOLDER',
        name: folder.name,
        folders: folders.map((f) => ({
          uuid: f.uuid,
          name: f.name,
          color: f.color,
          createdAt: formatDateResponse(f.createdAt, userTimezone),
        })),
        files: files.map((f) => ({
          uuid: f.uuid,
          name: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.size.toString(),
          extension: f.extension,
          createdAt: formatDateResponse(f.createdAt, userTimezone),
        })),
      };
    }
  }
}

// Custom simple UnauthorizedException if not imported from common
import { UnauthorizedException } from '@nestjs/common';
