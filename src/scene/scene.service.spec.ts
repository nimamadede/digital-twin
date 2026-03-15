import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SceneService } from './scene.service';
import { SceneMode } from './entities/scene-mode.entity';

describe('SceneService', () => {
  let service: SceneService;
  let repo: Repository<SceneMode>;

  const userId = 'user-uuid-1';
  const sceneId = 'scene-uuid-1';
  const otherSceneId = 'scene-uuid-2';

  const mockScene = {
    id: sceneId,
    userId,
    name: '工作模式',
    description: '工作时间',
    replyStyle: 'formal',
    autoReply: true,
    isActive: false,
    rules: { schedule: { enabled: true } },
    profileId: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as SceneMode;

  const mockActiveScene: SceneMode = {
    ...mockScene,
    id: otherSceneId,
    name: '休息模式',
    isActive: true,
  } as SceneMode;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneService,
        {
          provide: getRepositoryToken(SceneMode),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SceneService>(SceneService);
    repo = module.get<Repository<SceneMode>>(getRepositoryToken(SceneMode));
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return scenes for user only', async () => {
      (repo.find as jest.Mock).mockResolvedValue([mockScene]);

      const result = await service.findAll(userId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(sceneId);
      expect(result[0].name).toBe('工作模式');
      expect(result[0].isActive).toBe(false);
    });
  });

  describe('findOneOrFail', () => {
    it('should return scene when found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockScene);

      const result = await service.findOneOrFail(userId, sceneId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: sceneId, userId },
      });
      expect(result).toEqual(mockScene);
    });

    it('should throw NotFoundException when not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOneOrFail(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActive', () => {
    it('should return active scene when exists', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockActiveScene);

      const result = await service.findActive(userId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId, isActive: true },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe(otherSceneId);
      expect(result!.isActive).toBe(true);
    });

    it('should return null when no active scene', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findActive(userId);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create scene with userId and isActive false', async () => {
      const created = { ...mockScene, id: 'new-id' };
      (repo.create as jest.Mock).mockReturnValue(created);
      (repo.save as jest.Mock).mockResolvedValue(created);

      const result = await service.create(userId, {
        name: '会议模式',
        replyStyle: 'brief',
        autoReply: true,
        rules: {},
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          name: '会议模式',
          replyStyle: 'brief',
          autoReply: true,
          isActive: false,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('should update and save scene', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockScene);
      (repo.save as jest.Mock).mockImplementation((s) => Promise.resolve(s));

      await service.update(userId, sceneId, {
        name: '新名称',
        replyStyle: 'casual',
      });

      expect(mockScene.name).toBe('新名称');
      expect(mockScene.replyStyle).toBe('casual');
      expect(repo.save).toHaveBeenCalledWith(mockScene);
    });
  });

  describe('remove', () => {
    it('should remove scene after findOneOrFail', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockScene);
      (repo.remove as jest.Mock).mockResolvedValue(undefined);

      await service.remove(userId, sceneId);

      expect(repo.remove).toHaveBeenCalledWith(mockScene);
    });
  });

  describe('activate', () => {
    it('should activate scene and deactivate previous active', async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockScene)
        .mockResolvedValueOnce(mockActiveScene);
      (repo.save as jest.Mock).mockImplementation((s) => Promise.resolve(s));

      const result = await service.activate(userId, sceneId);

      expect(result.activatedScene).toBe(sceneId);
      expect(result.deactivatedScene).toBe(otherSceneId);
      expect(mockActiveScene.isActive).toBe(false);
      expect(mockScene.isActive).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(2);
    });

    it('should only activate when no previous active', async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockScene)
        .mockResolvedValueOnce(null);
      (repo.save as jest.Mock).mockImplementation((s) => Promise.resolve(s));

      const result = await service.activate(userId, sceneId);

      expect(result.activatedScene).toBe(sceneId);
      expect(result.deactivatedScene).toBeNull();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivate', () => {
    it('should set isActive false', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockActiveScene);
      (repo.save as jest.Mock).mockImplementation((s) => Promise.resolve(s));

      const result = await service.deactivate(userId, otherSceneId);

      expect(mockActiveScene.isActive).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(mockActiveScene);
      expect(result).toEqual(mockActiveScene);
    });
  });
});
