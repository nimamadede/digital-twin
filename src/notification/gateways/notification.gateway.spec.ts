import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { ReplyService } from '../../reply/reply.service';
import { SceneService } from '../../scene/scene.service';

const userId = 'user-uuid-1';
const replyId = 'reply-uuid-1';
const sceneId = 'scene-uuid-1';

const makeClient = (uid?: string) =>
  ({
    data: uid ? { userId: uid } : {},
    id: 'socket-1',
    handshake: { auth: {} },
    join: jest.fn(),
    disconnect: jest.fn(),
  }) as never;

describe('NotificationGateway - event handlers', () => {
  let gateway: NotificationGateway;
  let replyService: { review: jest.Mock };
  let sceneService: { activate: jest.Mock };
  let wsEmit: jest.Mock;

  beforeEach(async () => {
    replyService = { review: jest.fn() };
    sceneService = { activate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ReplyService, useValue: replyService },
        { provide: SceneService, useValue: sceneService },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    wsEmit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit: wsEmit }) } as never;
  });

  // --- reply:approve ---

  describe('reply:approve', () => {
    it('should call replyService.review with approve and emit reply:sent', async () => {
      const reviewResult = { replyId, status: 'sent', sentContent: '好的', sentAt: '2026-03-15T00:00:00.000Z' };
      replyService.review.mockResolvedValue(reviewResult);

      const result = await gateway.handleReplyApprove(
        makeClient(userId),
        { replyId, selectedIndex: 0 },
      );

      expect(replyService.review).toHaveBeenCalledWith(userId, replyId, {
        action: 'approve',
        selectedIndex: 0,
      });
      expect(result).toEqual({ ok: true, data: reviewResult });
      expect(gateway.server.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(wsEmit).toHaveBeenCalledWith(
        'reply:sent',
        expect.objectContaining({
          replyId,
          status: 'sent',
          sentContent: '好的',
          sentAt: '2026-03-15T00:00:00.000Z',
        }),
      );
    });

    it('should return error when not authenticated', async () => {
      const result = await gateway.handleReplyApprove(
        makeClient(),
        { replyId, selectedIndex: 0 },
      );

      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
      expect(replyService.review).not.toHaveBeenCalled();
    });

    it('should return error when service throws', async () => {
      replyService.review.mockRejectedValue(new BadRequestException('Invalid selectedIndex for approve'));

      const result = await gateway.handleReplyApprove(
        makeClient(userId),
        { replyId, selectedIndex: 99 },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // --- reply:reject ---

  describe('reply:reject', () => {
    it('should call replyService.review with reject', async () => {
      const reviewResult = { replyId, status: 'rejected', sentContent: null, sentAt: null };
      replyService.review.mockResolvedValue(reviewResult);

      const result = await gateway.handleReplyReject(
        makeClient(userId),
        { replyId },
      );

      expect(replyService.review).toHaveBeenCalledWith(userId, replyId, {
        action: 'reject',
      });
      expect(result).toEqual({ ok: true, data: reviewResult });
    });

    it('should return error when not authenticated', async () => {
      const result = await gateway.handleReplyReject(makeClient(), { replyId });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    });

    it('should return error when reply not found', async () => {
      replyService.review.mockRejectedValue(new NotFoundException('NOT_FOUND'));

      const result = await gateway.handleReplyReject(makeClient(userId), { replyId });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // --- reply:edit ---

  describe('reply:edit', () => {
    it('should call replyService.review with edit and emit reply:sent', async () => {
      const reviewResult = { replyId, status: 'edited', sentContent: '改后内容', sentAt: '2026-03-15T00:00:00.000Z' };
      replyService.review.mockResolvedValue(reviewResult);

      const result = await gateway.handleReplyEdit(
        makeClient(userId),
        { replyId, content: '改后内容' },
      );

      expect(replyService.review).toHaveBeenCalledWith(userId, replyId, {
        action: 'edit',
        editedContent: '改后内容',
      });
      expect(result).toEqual({ ok: true, data: reviewResult });
      expect(gateway.server.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(wsEmit).toHaveBeenCalledWith(
        'reply:sent',
        expect.objectContaining({
          replyId,
          status: 'edited',
          sentContent: '改后内容',
        }),
      );
    });

    it('should return error when not authenticated', async () => {
      const result = await gateway.handleReplyEdit(makeClient(), { replyId, content: 'x' });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    });
  });

  // --- scene:switch ---

  describe('scene:switch', () => {
    it('should call sceneService.activate and emit scene:switched', async () => {
      const activateResult = { activatedScene: sceneId, deactivatedScene: 'old-scene' };
      sceneService.activate.mockResolvedValue(activateResult);

      const result = await gateway.handleSceneSwitch(
        makeClient(userId),
        { sceneId },
      );

      expect(sceneService.activate).toHaveBeenCalledWith(userId, sceneId);
      expect(result).toEqual({ ok: true, data: activateResult });
      expect(gateway.server.to).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('should return error when not authenticated', async () => {
      const result = await gateway.handleSceneSwitch(makeClient(), { sceneId });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    });

    it('should return error when scene not found', async () => {
      sceneService.activate.mockRejectedValue(new NotFoundException('NOT_FOUND'));

      const result = await gateway.handleSceneSwitch(makeClient(userId), { sceneId });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
