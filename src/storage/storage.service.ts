import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { FileUpload } from './entities/file-upload.entity';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { FileQueryDto } from './dto/file-query.dto';

const ALLOWED_PURPOSES = ['style_analysis', 'export'] as const;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export interface FileUploadResult {
  id: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  purpose: string;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface FileListItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  purpose: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FileUpload)
    private readonly fileUploadRepo: Repository<FileUpload>,
  ) {
    const minio = this.config.get<{
      endPoint: string;
      port: number;
      useSSL: boolean;
      accessKey: string;
      secretKey: string;
      bucket: string;
    }>('minio');
    if (!minio) {
      throw new Error('MinIO config is required');
    }
    this.bucket = minio.bucket;
    this.client = new Minio.Client({
      endPoint: minio.endPoint,
      port: minio.port,
      useSSL: minio.useSSL,
      accessKey: minio.accessKey,
      secretKey: minio.secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  /**
   * Upload file to MinIO and create file_uploads record. All operations scoped by userId.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    purpose: (typeof ALLOWED_PURPOSES)[number],
    expiresIn?: number,
  ): Promise<FileUploadResult> {
    if (!file?.buffer && !file?.path) {
      throw new BadRequestException('No file content');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds limit (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`,
      );
    }
    if (!ALLOWED_PURPOSES.includes(purpose)) {
      throw new BadRequestException(`Invalid purpose: ${purpose}`);
    }

    const id = randomUUID();
    const ext = file.originalname?.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '';
    const safeName = file.originalname
      ?.replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200) ?? 'file';
    const fileKey = `users/${userId}/${id}${ext || ''}`;

    let buffer: Buffer;
    if (file.buffer && file.buffer.length > 0) {
      buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    } else if (file.path) {
      buffer = await readFile(file.path);
    } else {
      throw new BadRequestException('File content is empty');
    }
    const size = buffer.length;
    await this.client.putObject(
      this.bucket,
      fileKey,
      buffer,
      size,
      { 'Content-Type': file.mimetype || 'application/octet-stream' },
    );

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    const entity = this.fileUploadRepo.create({
      id,
      userId,
      fileName: safeName,
      fileKey,
      fileSize: String(size),
      mimeType: file.mimetype || 'application/octet-stream',
      purpose,
      status: 'uploaded',
      expiresAt,
    });
    const saved = await this.fileUploadRepo.save(entity);

    return {
      id: saved.id,
      fileName: saved.fileName,
      fileKey: saved.fileKey,
      fileSize: size,
      mimeType: saved.mimeType,
      purpose: saved.purpose,
      status: saved.status,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Upload from buffer (e.g. export file). All operations scoped by userId.
   */
  async uploadFromBuffer(
    userId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    purpose: (typeof ALLOWED_PURPOSES)[number],
    expiresIn?: number,
  ): Promise<FileUploadResult> {
    if (!buffer?.length) {
      throw new BadRequestException('Buffer is empty');
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds limit (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`,
      );
    }
    if (!ALLOWED_PURPOSES.includes(purpose)) {
      throw new BadRequestException(`Invalid purpose: ${purpose}`);
    }

    const id = randomUUID();
    const ext = fileName?.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.'))
      : '';
    const safeName = fileName
      ?.replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200) ?? 'file';
    const fileKey = `users/${userId}/${id}${ext || ''}`;
    const size = buffer.length;

    await this.client.putObject(
      this.bucket,
      fileKey,
      buffer,
      size,
      { 'Content-Type': mimeType },
    );

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    const entity = this.fileUploadRepo.create({
      id,
      userId,
      fileName: safeName,
      fileKey,
      fileSize: String(size),
      mimeType,
      purpose,
      status: 'uploaded',
      expiresAt,
    });
    const saved = await this.fileUploadRepo.save(entity);

    return {
      id: saved.id,
      fileName: saved.fileName,
      fileKey: saved.fileKey,
      fileSize: size,
      mimeType: saved.mimeType,
      purpose: saved.purpose,
      status: saved.status,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Get presigned download URL. Enforces user_id isolation.
   */
  async getPresignedDownloadUrl(
    userId: string,
    fileId: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    const file = await this.findOneOrFail(userId, fileId);
    if (file.status === 'deleted') {
      throw new NotFoundException('File not found or deleted');
    }
    return this.client.presignedGetObject(
      this.bucket,
      file.fileKey,
      expirySeconds,
    );
  }

  /**
   * Get file content as Buffer for server-side processing (e.g. style analysis).
   * Enforces user_id isolation.
   */
  async getFileBuffer(userId: string, fileId: string): Promise<Buffer> {
    const file = await this.findOneOrFail(userId, fileId);
    if (file.status === 'deleted') {
      throw new NotFoundException('File not found or deleted');
    }
    const stream = await this.client.getObject(this.bucket, file.fileKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Find file by id. All queries must filter by userId (data isolation).
   */
  async findOneOrFail(userId: string, fileId: string): Promise<FileUpload> {
    const file = await this.fileUploadRepo.findOne({
      where: { id: fileId, userId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  /**
   * List files with pagination. All queries must filter by userId.
   */
  async findAll(
    userId: string,
    query: FileQueryDto,
  ): Promise<PaginatedResult<FileListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.fileUploadRepo
      .createQueryBuilder('f')
      .where('f.userId = :userId', { userId })
      .orderBy('f.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.purpose) {
      qb.andWhere('f.purpose = :purpose', { purpose: query.purpose });
    }
    if (query.status) {
      qb.andWhere('f.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: Number(f.fileSize),
        mimeType: f.mimeType,
        purpose: f.purpose,
        status: f.status,
        expiresAt: f.expiresAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Soft delete: set status to 'deleted'. Optionally remove object from MinIO.
   */
  async remove(userId: string, fileId: string): Promise<void> {
    const file = await this.findOneOrFail(userId, fileId);
    await this.fileUploadRepo.update(
      { id: fileId, userId },
      { status: 'deleted' },
    );
    try {
      await this.client.removeObject(this.bucket, file.fileKey);
    } catch {
      // object may already be removed; soft delete still applied
    }
  }
}
