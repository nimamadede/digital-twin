import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { ReplyService } from '../../reply/reply.service';
import { SceneService } from '../../scene/scene.service';

const WS_NAMESPACE = '/ws';
const USER_ROOM_PREFIX = 'user:';

/** Server → client. Matches api-spec.md §9 `message:received`. */
export interface WsMessageReceivedPayload {
  messageId: string;
  contactId: string;
  contactNickname: string;
  content: string;
  platform: string;
  msgType: string;
  timestamp: string;
}

/** Server → client. Matches api-spec.md §9 `reply:generated`. */
export interface WsReplyGeneratedPayload {
  replyId: string;
  messageId: string;
  contactNickname: string;
  incomingMessage: string;
  candidates: Array<{ index: number; content: string; confidence: number }>;
  autoApprove: boolean;
  expiresAt: string;
}

/** Server → client. Matches api-spec.md §9 `reply:sent`. */
export interface WsReplySentPayload {
  replyId: string;
  status: string;
  sentContent: string | null;
  sentAt: string | null;
}

export interface WsAuthPayload {
  sub: string;
  phone: string;
  type: string;
}

/**
 * WebSocket Gateway for real-time events.
 * Connect: wss://<host>/ws with auth: { token: 'Bearer <jwt>' }.
 * Server->Client: message:received, reply:generated, reply:sent, style:analysis:progress,
 *   style:analysis:completed, platform:status, notification.
 * Client->Server: reply:approve, reply:reject, reply:edit, scene:switch.
 */
@WebSocketGateway({
  namespace: WS_NAMESPACE,
  cors: { origin: true },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly replyService: ReplyService,
    private readonly sceneService: SceneService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.getTokenFromHandshake(client);
      if (!token) {
        this.logger.warn('WS connection rejected: no token');
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync<WsAuthPayload>(token);
      if (payload.type !== 'access' || !payload.sub) {
        this.logger.warn('WS connection rejected: invalid token type or sub');
        client.disconnect();
        return;
      }
      const userId = payload.sub;
      (client.data as { userId: string }).userId = userId;
      const room = `${USER_ROOM_PREFIX}${userId}`;
      await client.join(room);
      this.logger.log(`WS client connected: userId=${userId}, socketId=${client.id}`);
    } catch {
      this.logger.warn('WS connection rejected: invalid or expired token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    this.logger.log(`WS client disconnected: userId=${userId ?? 'unknown'}, socketId=${client.id}`);
  }

  /**
   * Emit event to a single user (all their connected sockets). Use for real-time push.
   */
  emitToUser<T>(userId: string, event: string, payload: T): void {
    const room = `${USER_ROOM_PREFIX}${userId}`;
    this.server.to(room).emit(event, payload);
  }

  /**
   * Emit notification event (API payload shape).
   */
  emitNotification(userId: string, payload: {
    id: string;
    type: string;
    title: string;
    content: string;
    actionUrl?: string | null;
    timestamp: string;
  }): void {
    this.emitToUser(userId, 'notification', payload);
  }

  emitMessageReceived(userId: string, payload: WsMessageReceivedPayload): void {
    this.emitToUser(userId, 'message:received', payload);
  }

  emitReplyGenerated(userId: string, payload: WsReplyGeneratedPayload): void {
    this.emitToUser(userId, 'reply:generated', payload);
  }

  emitReplySent(userId: string, payload: WsReplySentPayload): void {
    this.emitToUser(userId, 'reply:sent', payload);
  }

  private getTokenFromHandshake(client: Socket): string | null {
    const auth = client.handshake?.auth as { token?: string } | undefined;
    const raw = auth?.token;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }

  // --- Client -> Server event handlers ---

  @SubscribeMessage('reply:approve')
  async handleReplyApprove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { replyId: string; selectedIndex: number },
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const userId = this.getUserId(client);
    if (!userId) return { ok: false, error: 'Unauthorized' };
    try {
      const result = await this.replyService.review(userId, payload.replyId, {
        action: 'approve',
        selectedIndex: payload.selectedIndex,
      });
      this.emitReplySent(userId, {
        replyId: result.replyId,
        status: result.status,
        sentContent: result.sentContent,
        sentAt: result.sentAt,
      });
      return { ok: true, data: result };
    } catch (err) {
      this.logger.warn(`reply:approve failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('reply:reject')
  async handleReplyReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { replyId: string },
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const userId = this.getUserId(client);
    if (!userId) return { ok: false, error: 'Unauthorized' };
    try {
      const result = await this.replyService.review(userId, payload.replyId, {
        action: 'reject',
      });
      return { ok: true, data: result };
    } catch (err) {
      this.logger.warn(`reply:reject failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('reply:edit')
  async handleReplyEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { replyId: string; content: string },
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const userId = this.getUserId(client);
    if (!userId) return { ok: false, error: 'Unauthorized' };
    try {
      const result = await this.replyService.review(userId, payload.replyId, {
        action: 'edit',
        editedContent: payload.content,
      });
      this.emitReplySent(userId, {
        replyId: result.replyId,
        status: result.status,
        sentContent: result.sentContent,
        sentAt: result.sentAt,
      });
      return { ok: true, data: result };
    } catch (err) {
      this.logger.warn(`reply:edit failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('scene:switch')
  async handleSceneSwitch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sceneId: string },
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const userId = this.getUserId(client);
    if (!userId) return { ok: false, error: 'Unauthorized' };
    try {
      const result = await this.sceneService.activate(userId, payload.sceneId);
      this.emitToUser(userId, 'scene:switched', result);
      return { ok: true, data: result };
    } catch (err) {
      this.logger.warn(`scene:switch failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message };
    }
  }

  private getUserId(client: Socket): string | null {
    return (client.data as { userId?: string }).userId ?? null;
  }
}
