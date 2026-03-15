import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  const mockContext = (method = 'GET', url = '/api/v1/test') => {
    const request = {
      method,
      originalUrl: url,
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('jest-agent'),
      headers: { 'x-request-id': 'req-123' },
    };
    const response = { statusCode: 200 };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const mockHandler: CallHandler = { handle: () => of({ ok: true }) };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through data unchanged', (done) => {
    interceptor.intercept(mockContext(), mockHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ ok: true });
      },
      complete: done,
    });
  });

  it('should log the request', (done) => {
    const logSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    interceptor.intercept(mockContext('POST', '/api/v1/auth/login'), mockHandler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('POST /api/v1/auth/login 200'),
        );
        logSpy.mockRestore();
        done();
      },
    });
  });
});
