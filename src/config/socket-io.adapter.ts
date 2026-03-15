import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { Server } from 'socket.io';

const SOCKET_IO_PATH = '/api/v1/socket.io';

/**
 * Socket.io adapter with path under global prefix so Express forwards requests to it.
 * Use with middleware in main.ts that forwards /api/v1/socket.io to this server's engine.
 */
export class SocketIoAdapter extends IoAdapter {
  private ioServer: Server | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: Record<string, unknown>) {
    const opts = { ...options, path: SOCKET_IO_PATH };
    const server = super.createIOServer(port, opts) as Server;
    this.ioServer = server;
    return server;
  }

  getPath(): string {
    return SOCKET_IO_PATH;
  }
}
