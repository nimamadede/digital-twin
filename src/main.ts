import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './config/socket-io.adapter';
import { NotificationGateway } from './notification/gateways/notification.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.setGlobalPrefix('api/v1');

  // Forward /api/v1/socket.io to Socket.io engine (same path as adapter)
  const socketIoPath = '/api/v1/socket.io';
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.url?.startsWith(socketIoPath)) return next();
    try {
      const gateway = app.get(NotificationGateway);
      const s = gateway.server as unknown as {
        server?: { engine?: { handleRequest(r: unknown, r2: unknown): void } };
        engine?: { handleRequest(r: unknown, r2: unknown): void };
      };
      const engine = s?.server?.engine ?? s?.engine;
      if (engine?.handleRequest) {
        engine.handleRequest(req, res);
      } else {
        next();
      }
    } catch {
      next();
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
