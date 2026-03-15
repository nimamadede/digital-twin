import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') ?? '-';
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? '-';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const elapsed = Date.now() - start;
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} ${elapsed}ms - ${ip} "${userAgent}" [${requestId}]`,
        );
      }),
    );
  }
}
