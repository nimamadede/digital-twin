import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  const mockRes = () => {
    const res = { setHeader: jest.fn() } as unknown as Response;
    return res;
  };

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate X-Request-Id if not present', () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(typeof req.headers['x-request-id']).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('should preserve existing X-Request-Id', () => {
    const req = { headers: { 'x-request-id': 'existing-id' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBe('existing-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id');
    expect(next).toHaveBeenCalled();
  });
});
