import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants';
import type { ApiErrorDto } from '../dto/api-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.normalize(exception);

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${body.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    body: ApiErrorDto;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res
          ? Array.isArray((res as { message: unknown }).message)
            ? (res as { message: string[] }).message.join(', ')
            : (res as { message: string }).message
          : exception.message;
      return {
        status,
        body: {
          data: null,
          code: this.statusToCode(status),
          message: String(message),
        },
      };
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        data: null,
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
        error:
          process.env.NODE_ENV === 'development' && exception instanceof Error
            ? exception.stack
            : undefined,
      },
    };
  }

  private statusToCode(status: number): number {
    const map: Record<number, number> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION_FAILED,
    };
    return map[status] ?? ERROR_CODES.INTERNAL_ERROR;
  }
}
