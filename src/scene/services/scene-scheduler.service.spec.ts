import { Test, TestingModule } from '@nestjs/testing';
import { SceneSchedulerService } from './scene-scheduler.service';

describe('SceneSchedulerService', () => {
  let service: SceneSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SceneSchedulerService],
    }).compile();
    service = module.get<SceneSchedulerService>(SceneSchedulerService);
  });

  describe('isWithinSchedule', () => {
    it('should return true when schedule is disabled', () => {
      expect(service.isWithinSchedule({ schedule: { enabled: false } })).toBe(
        true,
      );
    });

    it('should return true when schedule is missing', () => {
      expect(service.isWithinSchedule({})).toBe(true);
      expect(service.isWithinSchedule(null)).toBe(true);
    });

    it('should return true when schedule enabled but no time/weekdays', () => {
      expect(
        service.isWithinSchedule({ schedule: { enabled: true } }),
      ).toBe(true);
    });
  });
});
