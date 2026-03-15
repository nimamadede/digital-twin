import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockHealthResult: HealthCheckResult = {
    status: 'ok',
    info: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
    },
    error: {},
    details: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue(mockHealthResult),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: {
            pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health check result', async () => {
    const result = await controller.check();

    expect(healthCheckService.check).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.info).toHaveProperty('database');
    expect(result.info).toHaveProperty('memory_heap');
  });

  it('should call check with database and memory indicators', async () => {
    await controller.check();

    const checkFn = healthCheckService.check as jest.Mock;
    expect(checkFn).toHaveBeenCalledWith(expect.any(Array));
    const indicators = checkFn.mock.calls[0][0] as Array<() => unknown>;
    expect(indicators).toHaveLength(2);
  });

  it('should handle unhealthy status', async () => {
    const unhealthyResult: HealthCheckResult = {
      status: 'error',
      info: {},
      error: { database: { status: 'down', message: 'Connection refused' } },
      details: { database: { status: 'down', message: 'Connection refused' } },
    };
    (healthCheckService.check as jest.Mock).mockResolvedValue(unhealthyResult);

    const result = await controller.check();

    expect(result.status).toBe('error');
    expect(result.error).toHaveProperty('database');
  });
});
