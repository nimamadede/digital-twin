import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';

const WS_NAMESPACE = '/ws';
const USER_ROOM_PREFIX = 'user:';

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

  // --- Client -> Server event handlers (delegate to services via injection in future) ---

  @SubscribeMessage('reply:approve')
  handleReplyApprove(
    _client: Socket,
    payload: { replyId: string; selectedIndex: number },
  ): void {
    this.logger.debug('reply:approve', payload);
    // TODO: inject ReplyService and call approve
  }

  @SubscribeMessage('reply:reject')
  handleReplyReject(_client: Socket, payload: { replyId: string }): void {
    this.logger.debug('reply:reject', payload);
    // TODO: inject ReplyService and call reject
  }

  @SubscribeMessage('reply:edit')
  handleReplyEdit(
    _client: Socket,
    payload: { replyId: string; content: string },
  ): void {
    this.logger.debug('reply:edit', payload);
    // TODO: inject ReplyService and call edit+send
  }

  @SubscribeMessage('scene:switch')
  handleSceneSwitch(_client: Socket, payload: { sceneId: string }): void {
    this.logger.debug('scene:switch', payload);
    // TODO: inject SceneService and switch active scene
  }
}
