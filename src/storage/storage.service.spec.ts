import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StorageService } from './storage.service';
import { FileUpload } from './entities/file-upload.entity';

const mockMinioClient = {
  bucketExists: jest.fn().mockResolvedValue(true),
  makeBucket: jest.fn().mockResolvedValue(undefined),
  putObject: jest.fn().mockResolvedValue(undefined),
  presignedGetObject: jest.fn().mockResolvedValue('https://minio.example.com/presigned'),
  removeObject: jest.fn().mockResolvedValue(undefined),
};

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => mockMinioClient),
}));

describe('StorageService', () => {
  let service: StorageService;
  let repo: Repository<FileUpload>;

  const userId = 'user-uuid-1';
  const fileId = 'file-uuid-1';

  const mockFileUpload: FileUpload = {
    id: fileId,
    userId,
    fileName: 'test.txt',
    fileKey: `users/${userId}/${fileId}.txt`,
    fileSize: '1024',
    mimeType: 'text/plain',
    purpose: 'style_analysis',
    status: 'uploaded',
    expiresAt: null,
    createdAt: new Date(),
  } as FileUpload;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'minio') {
        return {
          endPoint: 'localhost',
          port: 9000,
          useSSL: false,
          accessKey: 'minioadmin',
          secretKey: 'minioadmin',
          bucket: 'digital-twin',
        };
      }
      return undefined;
    }),
  };

  const mockRepo = {
    create: jest.fn((dto) => ({ ...dto } as FileUpload)),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, createdAt: new Date() })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      buffer: Buffer.from('hello'),
      size: 5,
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(FileUpload), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    repo = module.get<Repository<FileUpload>>(getRepositoryToken(FileUpload));
    jest.clearAllMocks();
    mockMinioClient.putObject.mockResolvedValue(undefined);
    mockMinioClient.presignedGetObject.mockResolvedValue('https://presigned.example.com');
    mockMinioClient.bucketExists.mockResolvedValue(true);
  });

  describe('upload', () => {
    it('should upload file to MinIO and save file_uploads record with userId', async () => {
      (repo.create as jest.Mock).mockImplementation((dto) => ({ ...dto } as FileUpload));
      (repo.save as jest.Mock).mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: fileId, createdAt: new Date() }),
      );

      const file = createMockFile();
      const result = await service.upload(userId, file, 'style_analysis');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'digital-twin',
        expect.stringMatching(new RegExp(`users/${userId}/.+\\.txt`)),
        expect.any(Buffer),
        5,
        { 'Content-Type': 'text/plain' },
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          fileName: expect.any(String),
          fileKey: expect.stringContaining(`users/${userId}/`),
          fileSize: '5',
          mimeType: 'text/plain',
          purpose: 'style_analysis',
          status: 'uploaded',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.fileName).toBeDefined();
      expect(result.purpose).toBe('style_analysis');
      expect(result.status).toBe('uploaded');
    });

    it('should reject when file has no content', async () => {
      const file = createMockFile({ buffer: undefined as unknown as Buffer, size: 0 });
      delete (file as Partial<Express.Multer.File>).path;

      await expect(service.upload(userId, file, 'style_analysis')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockMinioClient.putObject).not.toHaveBeenCalled();
    });

    it('should reject when file size exceeds limit', async () => {
      const file = createMockFile({
        buffer: Buffer.alloc(51 * 1024 * 1024),
        size: 51 * 1024 * 1024,
      });

      await expect(service.upload(userId, file, 'export')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockMinioClient.putObject).not.toHaveBeenCalled();
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should return presigned URL when file belongs to userId', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockFileUpload);

      const url = await service.getPresignedDownloadUrl(userId, fileId, 7200);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: fileId, userId },
      });
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'digital-twin',
        mockFileUpload.fileKey,
        7200,
      );
      expect(url).toBe('https://presigned.example.com');
    });

    it('should throw NotFoundException when file not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getPresignedDownloadUrl(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);

      expect(mockMinioClient.presignedGetObject).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when file status is deleted', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockFileUpload,
        status: 'deleted',
      });

      await expect(
        service.getPresignedDownloadUrl(userId, fileId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneOrFail', () => {
    it('should return file when found with userId', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockFileUpload);

      const result = await service.findOneOrFail(userId, fileId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: fileId, userId },
      });
      expect(result).toEqual(mockFileUpload);
    });

    it('should throw NotFoundException when file not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOneOrFail(userId, 'other-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by userId and return paginated list', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockFileUpload], 1]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findAll(userId, { page: 1, pageSize: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('f');
      expect(qb.where).toHaveBeenCalledWith('f.userId = :userId', { userId });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply purpose and status filters when provided', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.findAll(userId, {
        page: 2,
        pageSize: 10,
        purpose: 'export',
        status: 'uploaded',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('f.purpose = :purpose', {
        purpose: 'export',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('f.status = :status', {
        status: 'uploaded',
      });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('remove', () => {
    it('should soft delete and remove object from MinIO', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockFileUpload);

      await service.remove(userId, fileId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: fileId, userId },
      });
      expect(repo.update).toHaveBeenCalledWith(
        { id: fileId, userId },
        { status: 'deleted' },
      );
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'digital-twin',
        mockFileUpload.fileKey,
      );
    });

    it('should throw NotFoundException when file not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(mockMinioClient.removeObject).not.toHaveBeenCalled();
    });
  });
});
