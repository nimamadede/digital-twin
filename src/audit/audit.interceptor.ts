import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Only audit mutating requests
    if (!METHOD_ACTION_MAP[method]) {
      return next.handle();
    }

    const user = request.user as { sub?: string } | undefined;
    const userId = user?.sub ?? null;
    const resourceType = this.extractResourceType(request.path);
    const verb = METHOD_ACTION_MAP[method];
    const resourceId = this.extractResourceId(request.params as Record<string, string>);
    const action = `${resourceType}.${verb}`;

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            userId,
            action,
            resourceType,
            resourceId,
            details: method === 'DELETE' ? null : (request.body as Record<string, unknown>),
            ipAddress: request.ip ?? null,
            userAgent: request.headers['user-agent'] ?? null,
          })
          .catch(() => {
            // Audit logging should never break the request
          });
      }),
    );
  }

  private extractResourceType(path: string): string {
    // /api/v1/scenes/uuid/activate → scenes
    const segments = path
      .replace(/^\/api\/v\d+\//, '')
      .split('/')
      .filter(Boolean);
    return segments[0] ?? 'unknown';
  }

  private extractResourceId(
    params: Record<string, string>,
  ): string | null {
    return params?.id ?? null;
  }
}
