import { ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common';
import { of, delay } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor();
  });

  const mockContext = {} as ExecutionContext;

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through fast responses', (done) => {
    const handler: CallHandler = { handle: () => of('ok') };
    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => expect(val).toBe('ok'),
      complete: done,
    });
  });

  it('should throw RequestTimeoutException on timeout', (done) => {
    jest.useFakeTimers();
    const handler: CallHandler = {
      handle: () => of('slow').pipe(delay(20000)),
    };
    interceptor.intercept(mockContext, handler).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(RequestTimeoutException);
        jest.useRealTimers();
        done();
      },
    });
    jest.advanceTimersByTime(16000);
  });
});
