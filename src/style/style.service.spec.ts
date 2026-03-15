import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StyleService, STYLE_QUEUE_NAME } from './style.service';
import { StyleProfile } from './entities/style-profile.entity';
import { StyleSample } from './entities/style-sample.entity';
import { StyleTask } from './entities/style-task.entity';
import { StorageService } from '../storage/storage.service';
import { VectorStoreService } from './services/vector-store.service';

const userId = 'user-uuid-1';
const profileId = 'profile-uuid-1';
const taskId = 'task-uuid-1';

const mockProfile = {
  id: profileId,
  userId,
  name: '日常聊天风格',
  description: '轻松随意',
  traits: { formality: 0.3, humor: 0.7 },
  vectorCollection: 'style_profile_xxx',
  sampleCount: 150,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as StyleProfile;

const mockTask: StyleTask = {
  id: taskId,
  userId,
  profileId,
  fileId: 'file-uuid-1',
  status: 'processing',
  progress: 65,
  errorMessage: null,
  startedAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
} as StyleTask;

const mockSample: StyleSample = {
  id: 'sample-uuid-1',
  profileId,
  content: '哈哈好的',
  platform: 'wechat',
  role: 'user',
  metadata: null,
  createdAt: new Date(),
} as StyleSample;

describe('StyleService', () => {
  let service: StyleService;
  let profileRepo: Repository<StyleProfile>;
  let taskRepo: Repository<StyleTask>;
  let styleQueue: { add: jest.Mock };

  const mockProfileRepo = {
    create: jest.fn((dto) => ({ ...dto, id: profileId })),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockTaskRepo = {
    create: jest.fn((dto) => ({ ...dto, id: taskId })),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSampleRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockStorageService = {
    upload: jest.fn().mockResolvedValue({
      id: 'file-uuid-1',
      fileName: 'wechat_export.txt',
      fileSize: 1024,
    }),
  };

  const mockVectorStore = {
    deleteCollection: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    styleQueue = { add: jest.fn().mockResolvedValue({ id: taskId }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StyleService,
        { provide: getRepositoryToken(StyleProfile), useValue: mockProfileRepo },
        { provide: getRepositoryToken(StyleSample), useValue: mockSampleRepo },
        { provide: getRepositoryToken(StyleTask), useValue: mockTaskRepo },
        { provide: StorageService, useValue: mockStorageService },
        { provide: VectorStoreService, useValue: mockVectorStore },
        {
          provide: getQueueToken(STYLE_QUEUE_NAME),
          useValue: styleQueue,
        },
      ],
    }).compile();

    service = module.get<StyleService>(StyleService);
    profileRepo = module.get<Repository<StyleProfile>>(
      getRepositoryToken(StyleProfile),
    );
    taskRepo = module.get<Repository<StyleTask>>(getRepositoryToken(StyleTask));
    jest.clearAllMocks();
  });

  describe('getTaskStatus', () => {
    it('should return task status when found and user_id matches', async () => {
      (taskRepo.findOne as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.getTaskStatus(userId, taskId);

      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: taskId, userId },
      });
      expect(result.taskId).toBe(taskId);
      expect(result.status).toBe('processing');
      expect(result.progress).toBe(65);
      expect(result.startedAt).toBeDefined();
    });

    it('should throw NotFoundException when task not found', async () => {
      (taskRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getTaskStatus(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listProfiles', () => {
    it('should return paginated profiles with user_id filter', async () => {
      (profileRepo.findAndCount as jest.Mock).mockResolvedValue([
        [mockProfile],
        1,
      ]);

      const result = await service.listProfiles(userId, {
        page: 1,
        pageSize: 20,
      });

      expect(profileRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { updatedAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(profileId);
      expect(result.items[0].name).toBe(mockProfile.name);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getProfileDetail', () => {
    it('should return profile with samples when found', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(mockProfile);
      (mockSampleRepo.find as jest.Mock).mockResolvedValue([mockSample]);

      const result = await service.getProfileDetail(userId, profileId);

      expect(profileRepo.findOne).toHaveBeenCalledWith({
        where: { id: profileId, userId },
      });
      expect(result.id).toBe(profileId);
      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].content).toBe(mockSample.content);
      expect(result.samples[0].platform).toBe(mockSample.platform);
    });

    it('should throw NotFoundException when profile not found', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getProfileDetail(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneProfileOrFail', () => {
    it('should return profile when found', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.findOneProfileOrFail(userId, profileId);

      expect(profileRepo.findOne).toHaveBeenCalledWith({
        where: { id: profileId, userId },
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when profile not found', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOneProfileOrFail(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should merge and save profile', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue({ ...mockProfile });
      (profileRepo.save as jest.Mock).mockImplementation((p) =>
        Promise.resolve(p),
      );
      (mockSampleRepo.find as jest.Mock).mockResolvedValue([]);

      await service.updateProfile(userId, profileId, {
        name: '工作风格',
        traits: { formality: 0.8 },
      });

      expect(profileRepo.save).toHaveBeenCalled();
      const saved = (profileRepo.save as jest.Mock).mock.calls[0][0];
      expect(saved.name).toBe('工作风格');
      expect(saved.traits.formality).toBe(0.8);
    });
  });

  describe('deleteProfile', () => {
    it('should delete Qdrant collection and remove profile', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(mockProfile);
      (profileRepo.remove as jest.Mock).mockResolvedValue(undefined);

      await service.deleteProfile(userId, profileId);

      expect(mockVectorStore.deleteCollection).toHaveBeenCalledWith(profileId);
      expect(profileRepo.remove).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('reanalyze', () => {
    it('should create task and enqueue job', async () => {
      (profileRepo.findOne as jest.Mock).mockResolvedValue(mockProfile);
      (taskRepo.create as jest.Mock).mockReturnValue({
        id: taskId,
        userId,
        profileId,
        fileId: null,
        status: 'pending',
        progress: 0,
      });
      (taskRepo.save as jest.Mock).mockResolvedValue({ id: taskId });

      const result = await service.reanalyze(userId, profileId);

      expect(result.taskId).toBe(taskId);
      expect(styleQueue.add).toHaveBeenCalledWith(
        'analyze',
        expect.objectContaining({
          taskId,
          profileId,
          userId,
          reanalyze: true,
        }),
        { jobId: taskId },
      );
    });
  });

  describe('upload', () => {
    it('should reject invalid file extension', async () => {
      const file = {
        originalname: 'data.pdf',
        buffer: Buffer.from('x'),
        size: 100,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      await expect(
        service.upload(userId, file, 'wechat'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('should upload file, create profile and task, enqueue job for .txt', async () => {
      const file = {
        originalname: 'wechat_export_2026.txt',
        buffer: Buffer.from('hello'),
        size: 1024,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      (profileRepo.save as jest.Mock).mockResolvedValue({
        id: profileId,
        name: file.originalname,
      });
      (taskRepo.save as jest.Mock).mockResolvedValue({
        id: taskId,
        status: 'pending',
      });

      const result = await service.upload(userId, file, 'wechat', 'desc');

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        userId,
        file,
        'style_analysis',
      );
      expect(profileRepo.create).toHaveBeenCalled();
      expect(profileRepo.save).toHaveBeenCalled();
      expect(taskRepo.save).toHaveBeenCalled();
      expect(styleQueue.add).toHaveBeenCalledWith(
        'analyze',
        expect.objectContaining({
          taskId,
          profileId,
          fileId: 'file-uuid-1',
          userId,
          platform: 'wechat',
          description: 'desc',
        }),
        { jobId: taskId },
      );
      expect(result.fileId).toBe('file-uuid-1');
      expect(result.fileName).toBe('wechat_export.txt');
      expect(result.taskId).toBe(taskId);
      expect(result.status).toBe('pending');
    });
  });
});
